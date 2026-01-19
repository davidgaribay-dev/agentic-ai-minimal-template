"""Secrets management service using encrypted database storage.

Provides secure storage for API keys and other secrets using Fernet
symmetric encryption with the secret stored in PostgreSQL.

Uses the application's SECRET_KEY for encryption key derivation via PBKDF2.
"""

from datetime import UTC, datetime
from typing import Literal, cast

from cryptography.fernet import InvalidToken
from sqlmodel import Session, select

from backend.core.cache import secrets_cache
from backend.core.config import settings
from backend.core.db import engine
from backend.core.encrypted_secrets import (
    EncryptedSecret,
    decrypt_value,
    encrypt_value,
)
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Cache TTL for secrets (5 minutes)
SECRETS_CACHE_TTL_SECONDS = 300

# Supported LLM providers
LLMProvider = Literal["openai", "anthropic", "google"]
SUPPORTED_PROVIDERS: list[LLMProvider] = ["openai", "anthropic", "google"]


class SecretsService:
    """Service for managing LLM API keys via encrypted database storage.

    Provides secure storage for API keys with team-level scoping
    and organization-level fallback for enterprise cost tracking.

    Fallback chain (priority order):
    1. Team-level key (highest priority)
    2. Org-level key
    3. Environment variable (backward compatible)

    All secrets are encrypted using Fernet symmetric encryption with
    a key derived from the application's SECRET_KEY.
    """

    def __init__(self) -> None:
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        """Initialize the secrets service.

        Returns True when ready (always, since we use database storage).
        """
        if self._initialized:
            return True

        self._initialized = True
        logger.info("secrets_service_initialized", storage="encrypted_database")
        return True

    def _get_secret_path(self, org_id: str, team_id: str | None = None) -> str:
        """Build path for LLM API key secrets."""
        if team_id:
            return f"/organizations/{org_id}/teams/{team_id}"
        return f"/organizations/{org_id}"

    def _get_cache_key(self, secret_name: str, path: str) -> str:
        """Generate a cache key for a secret."""
        return f"secret:{path}:{secret_name}"

    def _get_secret(self, secret_name: str, path: str) -> str | None:
        """Get a secret from database by name and path.

        Uses TTL cache to avoid hitting database on every call.
        """
        self._ensure_initialized()

        # Build full path
        full_path = f"{path}/{secret_name}"

        # Check cache first
        cache_key = self._get_cache_key(secret_name, path)
        cached_value: str | None = secrets_cache.get(cache_key)
        if cached_value is not None:
            logger.debug(
                "secrets_cache_hit",
                secret_name=secret_name,
                path=path,
            )
            return cached_value

        try:
            with Session(engine) as session:
                statement = select(EncryptedSecret).where(
                    EncryptedSecret.path == full_path
                )
                secret = session.exec(statement).first()

                if not secret:
                    return None

                # Decrypt the value
                try:
                    decrypted_value = decrypt_value(secret.encrypted_value)
                except InvalidToken:
                    # Use error, not exception - don't expose crypto details in logs
                    logger.error(  # noqa: TRY400
                        "secrets_decryption_failed",
                        path=full_path,
                        message="Secret may have been encrypted with different key",
                    )
                    return None

                # Cache the decrypted value
                secrets_cache.set(cache_key, decrypted_value, SECRETS_CACHE_TTL_SECONDS)
                logger.debug(
                    "secrets_cache_set",
                    secret_name=secret_name,
                    path=path,
                )
                return decrypted_value

        except Exception as e:
            logger.exception(
                "secrets_get_failed",
                secret_name=secret_name,
                path=path,
                error=str(e),
            )
            return None

    def _set_secret(self, secret_name: str, secret_value: str, path: str) -> bool:
        """Create or update a secret in the database."""
        self._ensure_initialized()

        # Build full path
        full_path = f"{path}/{secret_name}"

        # Invalidate cache before updating
        cache_key = self._get_cache_key(secret_name, path)
        secrets_cache.delete(cache_key)

        try:
            # Encrypt the value
            encrypted_value = encrypt_value(secret_value)

            with Session(engine) as session:
                # Check if secret already exists
                statement = select(EncryptedSecret).where(
                    EncryptedSecret.path == full_path
                )
                existing = session.exec(statement).first()

                if existing:
                    # Update existing secret
                    existing.encrypted_value = encrypted_value
                    existing.updated_at = datetime.now(UTC)
                    session.add(existing)
                    session.commit()
                    logger.info(
                        "secrets_updated",
                        secret_name=secret_name,
                        path=path,
                    )
                else:
                    # Create new secret
                    new_secret = EncryptedSecret(
                        path=full_path,
                        encrypted_value=encrypted_value,
                    )
                    session.add(new_secret)
                    session.commit()
                    logger.info(
                        "secrets_created",
                        secret_name=secret_name,
                        path=path,
                    )

                return True

        except Exception as e:
            logger.exception(
                "secrets_set_failed",
                secret_name=secret_name,
                path=path,
                error=str(e),
            )
            return False

    def _delete_secret(self, secret_name: str, path: str) -> bool:
        """Delete a secret from the database."""
        self._ensure_initialized()

        # Build full path
        full_path = f"{path}/{secret_name}"

        # Invalidate cache before deleting
        cache_key = self._get_cache_key(secret_name, path)
        secrets_cache.delete(cache_key)

        try:
            with Session(engine) as session:
                statement = select(EncryptedSecret).where(
                    EncryptedSecret.path == full_path
                )
                secret = session.exec(statement).first()

                if secret:
                    session.delete(secret)
                    session.commit()
                    logger.info(
                        "secrets_deleted",
                        secret_name=secret_name,
                        path=path,
                    )
                    return True

                # Secret didn't exist - that's okay
                return True

        except Exception as e:
            logger.exception(
                "secrets_delete_failed",
                secret_name=secret_name,
                path=path,
                error=str(e),
            )
            return False

    def _get_env_fallback(self, provider: LLMProvider) -> str | None:
        """Get API key from environment variables (backward compatibility)."""
        mapping = {
            "openai": settings.OPENAI_API_KEY,
            "anthropic": settings.ANTHROPIC_API_KEY,
            "google": settings.GOOGLE_API_KEY,
        }
        return mapping.get(provider)

    def get_llm_api_key(
        self,
        provider: LLMProvider,
        org_id: str,
        team_id: str | None = None,
    ) -> str | None:
        """Get LLM API key with fallback chain.

        Fallback chain (priority order):
        1. Team-level key (if team_id provided)
        2. Org-level key
        3. Environment variable

        Args:
            provider: The LLM provider (openai, anthropic, google)
            org_id: Organization ID for scoping
            team_id: Optional team ID for team-level override

        Returns:
            API key string or None if not configured
        """
        secret_name = f"{provider}_api_key"

        if team_id:
            team_path = self._get_secret_path(org_id, team_id)
            key = self._get_secret(secret_name, team_path)
            if key:
                logger.debug(
                    "api_key_resolved",
                    provider=provider,
                    level="team",
                    org_id=org_id,
                    team_id=team_id,
                )
                return key

        org_path = self._get_secret_path(org_id)
        key = self._get_secret(secret_name, org_path)
        if key:
            logger.debug(
                "api_key_resolved",
                provider=provider,
                level="org",
                org_id=org_id,
            )
            return key

        env_key = self._get_env_fallback(provider)
        if env_key:
            logger.debug(
                "api_key_resolved",
                provider=provider,
                level="environment",
            )
        return env_key

    def set_llm_api_key(
        self,
        provider: LLMProvider,
        api_key: str,
        org_id: str,
        team_id: str | None = None,
    ) -> bool:
        """Store LLM API key in encrypted database storage.

        Args:
            provider: The LLM provider (openai, anthropic, google)
            api_key: The API key to store
            org_id: Organization ID for scoping
            team_id: Optional team ID for team-level storage

        Returns:
            True if successful, False otherwise
        """
        if provider not in SUPPORTED_PROVIDERS:
            logger.error("invalid_provider", provider=provider)
            return False

        secret_name = f"{provider}_api_key"
        path = self._get_secret_path(org_id, team_id)

        success = self._set_secret(secret_name, api_key, path)
        if success:
            logger.info(
                "llm_api_key_stored",
                provider=provider,
                org_id=org_id,
                team_id=team_id,
                level="team" if team_id else "org",
            )
        return success

    def delete_llm_api_key(
        self,
        provider: LLMProvider,
        org_id: str,
        team_id: str | None = None,
    ) -> bool:
        """Delete LLM API key from encrypted database storage.

        Args:
            provider: The LLM provider (openai, anthropic, google)
            org_id: Organization ID for scoping
            team_id: Optional team ID for team-level deletion

        Returns:
            True if successful, False otherwise
        """
        if provider not in SUPPORTED_PROVIDERS:
            logger.error("invalid_provider", provider=provider)
            return False

        secret_name = f"{provider}_api_key"
        path = self._get_secret_path(org_id, team_id)

        success = self._delete_secret(secret_name, path)
        if success:
            logger.info(
                "llm_api_key_deleted",
                provider=provider,
                org_id=org_id,
                team_id=team_id,
                level="team" if team_id else "org",
            )
        return success

    def check_api_key_status(
        self,
        provider: LLMProvider,
        org_id: str,
        team_id: str | None = None,
    ) -> dict:
        """Check where an API key is configured.

        Args:
            provider: The LLM provider to check
            org_id: Organization ID
            team_id: Optional team ID to check team-level config

        Returns:
            Dict with is_configured, level, and has_fallback info
        """
        secret_name = f"{provider}_api_key"
        result = {
            "provider": provider,
            "is_configured": False,
            "level": None,
            "has_team_override": False,
            "has_org_key": False,
            "has_env_fallback": False,
        }

        if team_id:
            team_path = self._get_secret_path(org_id, team_id)
            if self._get_secret(secret_name, team_path):
                result["has_team_override"] = True
                result["is_configured"] = True
                result["level"] = "team"

        org_path = self._get_secret_path(org_id)
        if self._get_secret(secret_name, org_path):
            result["has_org_key"] = True
            if not result["is_configured"]:
                result["is_configured"] = True
                result["level"] = "org"

        if self._get_env_fallback(provider):
            result["has_env_fallback"] = True
            if not result["is_configured"]:
                result["is_configured"] = True
                result["level"] = "environment"

        return result

    def list_api_key_status(
        self,
        org_id: str,
        team_id: str | None = None,
    ) -> list[dict]:
        """List status of all provider API keys.

        Args:
            org_id: Organization ID
            team_id: Optional team ID for team context

        Returns:
            List of status dicts for each provider
        """
        return [
            self.check_api_key_status(provider, org_id, team_id)
            for provider in SUPPORTED_PROVIDERS
        ]

    def get_default_provider(
        self,
        org_id: str,
        team_id: str | None = None,
    ) -> LLMProvider:
        """Get the default LLM provider for an org/team.

        Checks database for team/org level override, falls back to settings.

        Args:
            org_id: Organization ID
            team_id: Optional team ID

        Returns:
            The default provider name
        """
        # Check team-level default
        if team_id:
            team_path = self._get_secret_path(org_id, team_id)
            provider = self._get_secret("default_provider", team_path)
            if provider in SUPPORTED_PROVIDERS:
                return cast("LLMProvider", provider)

        # Check org-level default
        org_path = self._get_secret_path(org_id)
        provider = self._get_secret("default_provider", org_path)
        if provider in SUPPORTED_PROVIDERS:
            return cast("LLMProvider", provider)

        # Fall back to settings
        return settings.DEFAULT_LLM_PROVIDER

    def set_default_provider(
        self,
        provider: LLMProvider,
        org_id: str,
        team_id: str | None = None,
    ) -> bool:
        """Set the default LLM provider for an org/team.

        Args:
            provider: The provider to set as default
            org_id: Organization ID
            team_id: Optional team ID for team-level setting

        Returns:
            True if successful
        """
        if provider not in SUPPORTED_PROVIDERS:
            return False

        path = self._get_secret_path(org_id, team_id)
        return self._set_secret("default_provider", provider, path)

    # =========================================================================
    # MCP Server Auth Secrets
    # =========================================================================

    def _get_mcp_secret_path(
        self,
        org_id: str,
        team_id: str | None = None,
        user_id: str | None = None,
    ) -> str:
        """Get the database path for MCP server secrets."""
        if user_id and team_id:
            return f"/organizations/{org_id}/teams/{team_id}/users/{user_id}/mcp"
        if team_id:
            return f"/organizations/{org_id}/teams/{team_id}/mcp"
        return f"/organizations/{org_id}/mcp"

    def set_mcp_auth_secret(
        self,
        server_id: str,
        auth_secret: str,
        org_id: str,
        team_id: str | None = None,
        user_id: str | None = None,
    ) -> str | None:
        """Store an MCP server auth secret in encrypted storage.

        Args:
            server_id: The MCP server ID (used as part of secret name)
            auth_secret: The actual auth token/key to store
            org_id: Organization ID
            team_id: Optional team ID
            user_id: Optional user ID for user-level servers

        Returns:
            The secret reference key if successful, None otherwise
        """
        secret_name = f"mcp_server_{server_id}"
        path = self._get_mcp_secret_path(org_id, team_id, user_id)

        if self._set_secret(secret_name, auth_secret, path):
            logger.info(
                "mcp_auth_secret_stored",
                server_id=server_id,
                path=path,
            )
            return secret_name
        return None

    def get_mcp_auth_secret(
        self,
        server_id: str,
        org_id: str,
        team_id: str | None = None,
        user_id: str | None = None,
    ) -> str | None:
        """Retrieve an MCP server auth secret from encrypted storage.

        Args:
            server_id: The MCP server ID
            org_id: Organization ID
            team_id: Optional team ID
            user_id: Optional user ID for user-level servers

        Returns:
            The auth secret value if found, None otherwise
        """
        secret_name = f"mcp_server_{server_id}"
        path = self._get_mcp_secret_path(org_id, team_id, user_id)

        secret = self._get_secret(secret_name, path)
        if secret:
            logger.debug(
                "mcp_auth_secret_retrieved",
                server_id=server_id,
                path=path,
            )
        return secret

    def delete_mcp_auth_secret(
        self,
        server_id: str,
        org_id: str,
        team_id: str | None = None,
        user_id: str | None = None,
    ) -> bool:
        """Delete an MCP server auth secret from encrypted storage.

        Args:
            server_id: The MCP server ID
            org_id: Organization ID
            team_id: Optional team ID
            user_id: Optional user ID for user-level servers

        Returns:
            True if deleted, False otherwise
        """
        secret_name = f"mcp_server_{server_id}"
        path = self._get_mcp_secret_path(org_id, team_id, user_id)

        success = self._delete_secret(secret_name, path)
        if success:
            logger.info(
                "mcp_auth_secret_deleted",
                server_id=server_id,
                path=path,
            )
        return success


_secrets_service: SecretsService | None = None


def get_secrets_service() -> SecretsService:
    """Get the singleton secrets service instance."""
    global _secrets_service
    if _secrets_service is None:
        _secrets_service = SecretsService()
    return _secrets_service
