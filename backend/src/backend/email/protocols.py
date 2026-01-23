"""Email provider protocol for provider-agnostic email sending."""

from typing import Protocol

from backend.email.schemas import EmailMessage, EmailResult


class EmailProvider(Protocol):
    """Protocol for email providers (Resend, SMTP, etc.).

    Implementations must provide async send method.
    """

    async def send(self, message: EmailMessage) -> EmailResult:
        """Send an email message.

        Args:
            message: Email message to send

        Returns:
            EmailResult with success status and optional error details
        """
        ...

    async def send_batch(self, messages: list[EmailMessage]) -> list[EmailResult]:
        """Send multiple emails in batch.

        Args:
            messages: List of email messages to send

        Returns:
            List of EmailResult for each message
        """
        ...
