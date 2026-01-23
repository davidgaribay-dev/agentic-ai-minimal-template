"""Email schemas for the email service."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class EmailType(str, Enum):
    """Types of emails sent by the system."""

    VERIFICATION = "verification"
    PASSWORD_RESET = "password_reset"
    INVITATION = "invitation"
    WELCOME = "welcome"
    ADMIN_PASSWORD_RESET = "admin_password_reset"


class EmailMessage(BaseModel):
    """Email message to be sent."""

    to: list[EmailStr] = Field(min_length=1)
    subject: str
    html_content: str
    text_content: str | None = None

    # Metadata for tracking
    email_type: EmailType
    recipient_user_id: str | None = None
    organization_id: str | None = None
    team_id: str | None = None

    # Optional headers
    reply_to: EmailStr | None = None
    tags: list[str] = Field(default_factory=list)


class EmailResult(BaseModel):
    """Result of sending an email."""

    success: bool
    message_id: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    sent_at: datetime | None = None


class VerificationCodeData(BaseModel):
    """Data for verification code email."""

    email: EmailStr
    code: str
    username: str | None = None
    expires_in_minutes: int = 30
    locale: str = "en"


class PasswordResetData(BaseModel):
    """Data for password reset email."""

    email: EmailStr
    token: str
    username: str | None = None
    reset_link: str
    expires_in_hours: int = 48
    locale: str = "en"
    is_admin_initiated: bool = False
    admin_name: str | None = None


class InvitationEmailData(BaseModel):
    """Data for invitation email."""

    email: EmailStr
    organization_name: str
    team_name: str | None = None
    org_role: str
    team_role: str | None = None
    inviter_name: str | None = None
    code: str  # 6-digit verification code
    invitation_link: str | None = None  # Optional fallback link
    expires_in_days: int = 7
    locale: str = "en"


class WelcomeEmailData(BaseModel):
    """Data for welcome email after verification."""

    email: EmailStr
    username: str | None = None
    organization_name: str | None = None
    login_link: str
    locale: str = "en"
