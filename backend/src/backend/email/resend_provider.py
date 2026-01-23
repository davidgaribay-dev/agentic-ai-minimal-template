"""Resend email provider implementation."""

import asyncio
from datetime import UTC, datetime
import threading
from typing import Any

import resend
from resend.exceptions import ResendError

from backend.core.config import settings
from backend.core.logging import get_logger
from backend.email.schemas import EmailMessage, EmailResult

logger = get_logger(__name__)

# Lock to ensure thread-safe access to resend.api_key global variable
_resend_lock = threading.Lock()


class ResendProvider:
    """Resend API email provider.

    Sends emails via Resend's REST API using their Python SDK.
    """

    def __init__(self, api_key: str | None = None, from_email: str | None = None):
        """Initialize the Resend provider.

        Args:
            api_key: Resend API key. Defaults to settings.RESEND_API_KEY.
            from_email: Sender email. Defaults to settings.EMAILS_FROM_EMAIL.
        """
        self.api_key = api_key or settings.RESEND_API_KEY
        self.from_email = from_email or settings.EMAILS_FROM_EMAIL
        self.from_name = settings.EMAILS_FROM_NAME or settings.PROJECT_NAME

        if not self.api_key:
            logger.warning("Resend API key not configured")

    def _build_from_address(self) -> str:
        """Build the from address with name."""
        if self.from_name:
            return f"{self.from_name} <{self.from_email}>"
        return self.from_email or ""

    async def send(self, message: EmailMessage) -> EmailResult:
        """Send an email via Resend.

        Args:
            message: Email message to send

        Returns:
            EmailResult with success status
        """
        if not self.api_key:
            return EmailResult(
                success=False,
                error_code="no_api_key",
                error_message="Resend API key not configured",
            )

        if not self.from_email:
            return EmailResult(
                success=False,
                error_code="no_from_email",
                error_message="From email not configured",
            )

        try:
            params: resend.Emails.SendParams = {
                "from": self._build_from_address(),
                "to": [str(email) for email in message.to],
                "subject": message.subject,
                "html": message.html_content,
            }

            # Add optional text content
            if message.text_content:
                params["text"] = message.text_content

            # Add reply-to if specified
            if message.reply_to:
                params["reply_to"] = str(message.reply_to)

            # Add tags for tracking
            if message.tags:
                params["tags"] = [
                    {"name": tag, "value": "true"} for tag in message.tags
                ]

            # Use lock to ensure thread-safe global API key access, run in thread pool
            # to avoid blocking the async event loop
            def _send_sync() -> Any:
                with _resend_lock:
                    resend.api_key = self.api_key
                    return resend.Emails.send(params)

            response = await asyncio.to_thread(_send_sync)

            logger.info(
                "email_sent",
                message_id=response.get("id"),
                to=message.to,
                email_type=message.email_type.value,
            )

            return EmailResult(
                success=True,
                message_id=response.get("id"),
                sent_at=datetime.now(UTC),
            )

        except ResendError as e:
            logger.exception(
                "email_send_failed",
                error=str(e),
                to=message.to,
                email_type=message.email_type.value,
            )
            return EmailResult(
                success=False,
                error_code="resend_error",
                error_message=str(e),
            )
        except Exception as e:
            logger.exception(
                "email_send_unexpected_error",
                error=str(e),
                to=message.to,
                email_type=message.email_type.value,
            )
            return EmailResult(
                success=False,
                error_code="unexpected_error",
                error_message=str(e),
            )

    async def send_batch(self, messages: list[EmailMessage]) -> list[EmailResult]:
        """Send multiple emails in batch.

        Sends emails concurrently using asyncio.gather for better performance.
        Uses return_exceptions=True to ensure partial failures don't affect other sends.

        Args:
            messages: List of email messages

        Returns:
            List of EmailResult for each message
        """
        results = await asyncio.gather(
            *[self.send(message) for message in messages],
            return_exceptions=True,
        )
        # Convert any unexpected exceptions to EmailResult failures
        return [
            r
            if isinstance(r, EmailResult)
            else EmailResult(
                success=False,
                error_code="unexpected_error",
                error_message=str(r),
            )
            for r in results
        ]
