"""Email service module for sending transactional emails.

Provides:
- EmailService: Main service for sending emails with template rendering
- EmailProvider protocol for implementing different providers
- ResendProvider: Resend API implementation
- Email schemas for different email types
"""

from backend.email.protocols import EmailProvider
from backend.email.resend_provider import ResendProvider
from backend.email.schemas import (
    EmailMessage,
    EmailResult,
    EmailType,
    InvitationEmailData,
    PasswordResetData,
    VerificationCodeData,
    WelcomeEmailData,
)
from backend.email.service import EmailService, email_service

__all__ = [
    "EmailMessage",
    "EmailProvider",
    "EmailResult",
    "EmailService",
    "EmailType",
    "InvitationEmailData",
    "PasswordResetData",
    "ResendProvider",
    "VerificationCodeData",
    "WelcomeEmailData",
    "email_service",
]
