"""Email verification routes."""

from datetime import UTC, datetime, timedelta
import secrets

from fastapi import APIRouter, HTTPException, Request, status

from backend.audit.schemas import AuditAction, LogLevel, Target
from backend.audit.service import audit_service
from backend.auth import (
    ResendVerificationRequest,
    SendVerificationCodeRequest,
    SessionDep,
    UpdateSignupEmailRequest,
    VerificationStatusResponse,
    VerifyEmailRequest,
    get_user_by_email,
)
from backend.core.config import settings
from backend.core.logging import get_logger
from backend.core.rate_limit import AUTH_RATE_LIMIT, limiter
from backend.email import email_service
from backend.email.schemas import VerificationCodeData

router = APIRouter()
logger = get_logger(__name__)


@router.post("/send-verification-code", response_model=VerificationStatusResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def send_verification_code(
    request: Request,
    session: SessionDep,
    body: SendVerificationCodeRequest,
) -> VerificationStatusResponse:
    """Send email verification code.

    This endpoint is called during signup to send the initial verification code.
    The code expires after a configurable time (default 30 minutes).
    """
    user = get_user_by_email(session=session, email=body.email)
    if not user:
        # Don't reveal whether user exists
        return VerificationStatusResponse(
            email_verified=False,
            verification_sent=True,
        )

    if user.email_verified:
        return VerificationStatusResponse(
            email_verified=True,
            verification_sent=False,
        )

    # Generate and store verification code
    code = email_service.generate_verification_code()
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )

    user.email_verification_code = code
    user.email_verification_code_expires_at = expires_at
    user.email_verification_sent_at = datetime.now(UTC)
    session.add(user)
    session.commit()

    # Send verification email
    verification_data = VerificationCodeData(
        email=user.email,
        code=code,
        username=user.full_name,
        expires_in_minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES,
        locale=user.language,
    )

    result = await email_service.send_verification_email(
        data=verification_data,
        request=request,
        actor=user,
    )

    if result.success:
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_SENT,
            actor=user,
            request=request,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            metadata={"expires_in_minutes": settings.EMAIL_VERIFICATION_EXPIRE_MINUTES},
        )
        logger.info("verification_code_sent", email=user.email)
    else:
        await audit_service.log(
            AuditAction.EMAIL_FAILED,
            actor=user,
            request=request,
            outcome="failure",
            severity=LogLevel.ERROR,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            error_code="EMAIL_SEND_FAILED",
            error_message=result.error_message,
        )
        logger.error(
            "verification_email_failed", email=user.email, error=result.error_message
        )

    return VerificationStatusResponse(
        email_verified=False,
        verification_sent=result.success,
    )


@router.post("/verify-email", response_model=VerificationStatusResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def verify_email(
    request: Request,
    session: SessionDep,
    body: VerifyEmailRequest,
) -> VerificationStatusResponse:
    """Verify email with the provided code.

    The code must match and not be expired.
    """
    user = get_user_by_email(session=session, email=body.email)
    if not user:
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_FAILED,
            request=request,
            outcome="failure",
            severity=LogLevel.WARNING,
            error_code="USER_NOT_FOUND",
            error_message="Email verification attempted for non-existent user",
            metadata={"email": body.email},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or code",
        )

    if user.email_verified:
        return VerificationStatusResponse(
            email_verified=True,
            verification_sent=False,
        )

    # Check if code matches using timing-safe comparison
    if not secrets.compare_digest(user.email_verification_code or "", body.code):
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_FAILED,
            actor=user,
            request=request,
            outcome="failure",
            severity=LogLevel.WARNING,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            error_code="INVALID_CODE",
            error_message="Invalid verification code provided",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid email or code",
        )

    # Check if code has expired
    # Database stores naive datetimes, treat as UTC for comparison
    if (
        user.email_verification_code_expires_at
        and user.email_verification_code_expires_at.replace(tzinfo=UTC)
        < datetime.now(UTC)
    ):
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_FAILED,
            actor=user,
            request=request,
            outcome="failure",
            severity=LogLevel.WARNING,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            error_code="CODE_EXPIRED",
            error_message="Verification code has expired",
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code.",
        )

    # Mark email as verified
    user.email_verified = True
    user.email_verification_code = None
    user.email_verification_code_expires_at = None
    session.add(user)
    session.commit()

    await audit_service.log(
        AuditAction.EMAIL_VERIFICATION_COMPLETED,
        actor=user,
        request=request,
        targets=[Target(type="user", id=str(user.id), name=user.email)],
    )
    logger.info("email_verified", email=user.email)

    return VerificationStatusResponse(
        email_verified=True,
        verification_sent=False,
    )


@router.post("/resend-verification", response_model=VerificationStatusResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def resend_verification(
    request: Request,
    session: SessionDep,
    body: ResendVerificationRequest,
) -> VerificationStatusResponse:
    """Resend verification code with cooldown.

    Enforces a cooldown period between resends (default 60 seconds).
    """
    user = get_user_by_email(session=session, email=body.email)
    if not user:
        # Don't reveal whether user exists
        return VerificationStatusResponse(
            email_verified=False,
            verification_sent=True,
        )

    if user.email_verified:
        return VerificationStatusResponse(
            email_verified=True,
            verification_sent=False,
        )

    # Check cooldown
    # Database stores naive datetimes, treat as UTC for comparison
    if user.email_verification_sent_at:
        cooldown_end = user.email_verification_sent_at.replace(tzinfo=UTC) + timedelta(
            seconds=settings.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
        )
        if datetime.now(UTC) < cooldown_end:
            return VerificationStatusResponse(
                email_verified=False,
                verification_sent=False,
                can_resend_at=cooldown_end,
            )

    # Generate new code and send
    code = email_service.generate_verification_code()
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )

    user.email_verification_code = code
    user.email_verification_code_expires_at = expires_at
    user.email_verification_sent_at = datetime.now(UTC)
    session.add(user)
    session.commit()

    # Send verification email
    verification_data = VerificationCodeData(
        email=user.email,
        code=code,
        username=user.full_name,
        expires_in_minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES,
        locale=user.language,
    )

    result = await email_service.send_verification_email(
        data=verification_data,
        request=request,
        actor=user,
    )

    if result.success:
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_RESENT,
            actor=user,
            request=request,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            metadata={"expires_in_minutes": settings.EMAIL_VERIFICATION_EXPIRE_MINUTES},
        )
        logger.info("verification_code_resent", email=user.email)
    else:
        await audit_service.log(
            AuditAction.EMAIL_FAILED,
            actor=user,
            request=request,
            outcome="failure",
            severity=LogLevel.ERROR,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            error_code="EMAIL_SEND_FAILED",
            error_message=result.error_message,
        )

    return VerificationStatusResponse(
        email_verified=False,
        verification_sent=result.success,
    )


@router.post("/update-signup-email", response_model=VerificationStatusResponse)
@limiter.limit(AUTH_RATE_LIMIT)
async def update_signup_email(
    request: Request,
    session: SessionDep,
    body: UpdateSignupEmailRequest,
) -> VerificationStatusResponse:
    """Update email during signup (before verification).

    Allows users who entered the wrong email to correct it before completing
    verification. Only works for unverified users.
    """
    # Find user by current email
    user = get_user_by_email(session=session, email=body.current_email)
    if not user:
        # Don't reveal whether user exists
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid request",
        )

    # Only allow for unverified users
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified",
        )

    # Check if new email is already taken
    existing_user = get_user_by_email(session=session, email=body.new_email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    # Update email and generate new verification code
    old_email = user.email
    user.email = body.new_email
    code = email_service.generate_verification_code()
    expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )

    user.email_verification_code = code
    user.email_verification_code_expires_at = expires_at
    user.email_verification_sent_at = datetime.now(UTC)
    session.add(user)
    session.commit()

    # Send verification email to new address
    verification_data = VerificationCodeData(
        email=user.email,
        code=code,
        username=user.full_name,
        expires_in_minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES,
        locale=user.language,
    )

    result = await email_service.send_verification_email(
        data=verification_data,
        request=request,
        actor=user,
    )

    if result.success:
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_SENT,
            actor=user,
            request=request,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            metadata={
                "old_email": old_email,
                "new_email": user.email,
                "expires_in_minutes": settings.EMAIL_VERIFICATION_EXPIRE_MINUTES,
            },
        )
        logger.info("signup_email_updated", old_email=old_email, new_email=user.email)
    else:
        await audit_service.log(
            AuditAction.EMAIL_FAILED,
            actor=user,
            request=request,
            outcome="failure",
            severity=LogLevel.ERROR,
            targets=[Target(type="user", id=str(user.id), name=user.email)],
            error_code="EMAIL_SEND_FAILED",
            error_message=result.error_message,
        )

    return VerificationStatusResponse(
        email_verified=False,
        verification_sent=result.success,
    )
