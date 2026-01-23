"""Email service for sending emails via configured provider."""

from pathlib import Path
import secrets
from typing import TYPE_CHECKING, Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from backend.audit.schemas import AuditAction, Target
from backend.audit.service import audit_service
from backend.core.config import settings
from backend.core.logging import get_logger
from backend.email.resend_provider import ResendProvider
from backend.email.schemas import (
    EmailMessage,
    EmailResult,
    EmailType,
    InvitationEmailData,
    PasswordResetData,
    VerificationCodeData,
)
from backend.i18n import SUPPORTED_LOCALE_CODES, translate

if TYPE_CHECKING:
    from fastapi import Request

    from backend.auth.models import User

logger = get_logger(__name__)

# Default locale for emails when none specified
DEFAULT_EMAIL_LOCALE = "en"

# Template directory
TEMPLATES_DIR = Path(__file__).parent.parent / "email-templates"

# Verification code settings
VERIFICATION_CODE_LENGTH = 6


class EmailService:
    """Service for sending emails with template rendering and audit logging."""

    def __init__(self) -> None:
        """Initialize the email service with configured provider."""
        self._provider = ResendProvider()
        self._jinja_env = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html", "xml"]),
        )

    def _render_template(
        self,
        template_name: str,
        context: dict[str, Any],
        locale: str = DEFAULT_EMAIL_LOCALE,
    ) -> str:
        """Render an email template with i18n support.

        Args:
            template_name: Name of the template file
            context: Template context variables
            locale: BCP 47 language code

        Returns:
            Rendered HTML content
        """
        normalized_locale = (
            locale if locale in SUPPORTED_LOCALE_CODES else DEFAULT_EMAIL_LOCALE
        )

        def t(key: str, **kwargs: str | int) -> str:
            """Translate a key with the current locale."""
            return translate(key, normalized_locale, **kwargs)

        template_context = {
            **context,
            "t": t,
            "lang": normalized_locale,
            "dir": "rtl" if normalized_locale == "ar" else None,
            "project_name": settings.PROJECT_NAME,
        }

        template = self._jinja_env.get_template(template_name)
        return template.render(template_context)

    @staticmethod
    def generate_verification_code() -> str:
        """Generate a secure 6-digit verification code.

        Returns:
            6-digit numeric string
        """
        # Generate a cryptographically secure random number
        code = secrets.randbelow(10**VERIFICATION_CODE_LENGTH)
        return str(code).zfill(VERIFICATION_CODE_LENGTH)

    async def send_verification_email(
        self,
        data: VerificationCodeData,
        request: "Request | None" = None,
        actor: "User | None" = None,
    ) -> EmailResult:
        """Send email verification code.

        Args:
            data: Verification code email data
            request: Optional request for audit logging
            actor: Optional user for audit logging

        Returns:
            EmailResult with send status
        """
        subject = translate(
            "email_verification_subject",
            data.locale,
            project_name=settings.PROJECT_NAME,
        )

        html_content = self._render_template(
            "email_verification.html",
            {
                "code": data.code,
                "username": data.username or data.email.split("@")[0],
                "valid_minutes": data.expires_in_minutes,
            },
            data.locale,
        )

        message = EmailMessage(
            to=[data.email],
            subject=subject,
            html_content=html_content,
            email_type=EmailType.VERIFICATION,
        )

        result = await self._provider.send(message)

        # Audit log
        await audit_service.log(
            AuditAction.EMAIL_VERIFICATION_SENT
            if result.success
            else AuditAction.EMAIL_FAILED,
            actor=actor,
            request=request,
            targets=[Target(type="email", id=str(data.email), name="verification")],
            outcome="success" if result.success else "failure",
            metadata={
                "email_type": EmailType.VERIFICATION.value,
                "recipient": str(data.email),
                "expires_in_minutes": data.expires_in_minutes,
            },
            error_message=result.error_message if not result.success else None,
        )

        return result

    async def send_password_reset_email(
        self,
        data: PasswordResetData,
        request: "Request | None" = None,
        actor: "User | None" = None,
        organization_id: str | None = None,
    ) -> EmailResult:
        """Send password reset email.

        Args:
            data: Password reset email data
            request: Optional request for audit logging
            actor: Optional user for audit logging
            organization_id: Optional org ID for audit scoping

        Returns:
            EmailResult with send status
        """
        # Choose subject based on whether admin-initiated
        if data.is_admin_initiated:
            subject = translate(
                "email_admin_password_reset_subject",
                data.locale,
                project_name=settings.PROJECT_NAME,
            )
            template = "admin_password_reset.html"
        else:
            subject = translate(
                "email_reset_password_subject",
                data.locale,
                project_name=settings.PROJECT_NAME,
            )
            template = "reset_password.html"

        html_content = self._render_template(
            template,
            {
                "username": data.username or data.email.split("@")[0],
                "link": data.reset_link,
                "valid_hours": data.expires_in_hours,
                "admin_name": data.admin_name,
                "is_admin_initiated": data.is_admin_initiated,
            },
            data.locale,
        )

        message = EmailMessage(
            to=[data.email],
            subject=subject,
            html_content=html_content,
            email_type=EmailType.ADMIN_PASSWORD_RESET
            if data.is_admin_initiated
            else EmailType.PASSWORD_RESET,
            organization_id=organization_id,
        )

        result = await self._provider.send(message)

        # Choose audit action based on whether admin-initiated
        if data.is_admin_initiated:
            action = (
                AuditAction.ADMIN_PASSWORD_RESET_SENT
                if result.success
                else AuditAction.EMAIL_FAILED
            )
        else:
            action = (
                AuditAction.EMAIL_PASSWORD_RESET_SENT
                if result.success
                else AuditAction.EMAIL_FAILED
            )

        await audit_service.log(
            action,
            actor=actor,
            request=request,
            targets=[Target(type="email", id=str(data.email), name="password_reset")],
            outcome="success" if result.success else "failure",
            metadata={
                "email_type": message.email_type.value,
                "recipient": str(data.email),
                "is_admin_initiated": data.is_admin_initiated,
                "admin_name": data.admin_name if data.is_admin_initiated else None,
            },
            error_message=result.error_message if not result.success else None,
        )

        return result

    async def send_invitation_email(
        self,
        data: InvitationEmailData,
        request: "Request | None" = None,
        actor: "User | None" = None,
        organization_id: str | None = None,
        team_id: str | None = None,
    ) -> EmailResult:
        """Send invitation email.

        Args:
            data: Invitation email data
            request: Optional request for audit logging
            actor: Optional user (inviter) for audit logging
            organization_id: Org ID for audit scoping
            team_id: Optional team ID for audit scoping

        Returns:
            EmailResult with send status
        """
        subject = translate(
            "email_invitation_subject",
            data.locale,
            org_name=data.organization_name,
            project_name=settings.PROJECT_NAME,
        )

        html_content = self._render_template(
            "invitation.html",
            {
                "organization_name": data.organization_name,
                "team_name": data.team_name,
                "org_role": data.org_role,
                "team_role": data.team_role,
                "inviter_name": data.inviter_name,
                "code": data.code,
                "link": data.invitation_link,
                "expires_in_days": data.expires_in_days,
            },
            data.locale,
        )

        message = EmailMessage(
            to=[data.email],
            subject=subject,
            html_content=html_content,
            email_type=EmailType.INVITATION,
            organization_id=organization_id,
            team_id=team_id,
        )

        result = await self._provider.send(message)

        await audit_service.log(
            AuditAction.EMAIL_INVITATION_SENT
            if result.success
            else AuditAction.EMAIL_FAILED,
            actor=actor,
            request=request,
            organization_id=organization_id if organization_id else None,
            team_id=team_id if team_id else None,
            targets=[Target(type="email", id=str(data.email), name="invitation")],
            outcome="success" if result.success else "failure",
            metadata={
                "email_type": EmailType.INVITATION.value,
                "recipient": str(data.email),
                "organization_name": data.organization_name,
                "team_name": data.team_name,
                "org_role": data.org_role,
                "team_role": data.team_role,
                "inviter_name": data.inviter_name,
            },
            error_message=result.error_message if not result.success else None,
        )

        return result

    @property
    def is_configured(self) -> bool:
        """Check if email service is properly configured."""
        return bool(settings.RESEND_API_KEY and settings.EMAILS_FROM_EMAIL)


# Global email service instance
email_service = EmailService()
