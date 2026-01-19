"""Encrypted secrets storage using Fernet symmetric encryption.

Provides secure storage of secrets in the PostgreSQL database using Fernet
symmetric encryption. The encryption key is derived from the application's
SECRET_KEY using PBKDF2.
"""

import base64
from datetime import UTC, datetime
from typing import ClassVar
import uuid

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlmodel import Field, SQLModel

from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Salt for key derivation - fixed to ensure deterministic key generation
# This is safe because the SECRET_KEY provides the entropy
DERIVATION_SALT = b"agentic-secrets-v1"

# Number of PBKDF2 iterations for key derivation
# Higher = more secure but slower, 100k is a good balance
KEY_DERIVATION_ITERATIONS = 100_000


class EncryptedSecret(SQLModel, table=True):
    """Database model for storing encrypted secrets.

    Secrets are stored with a hierarchical path that encodes their scope:
    - /organizations/{org_id}/{key_name} - Organization-level secrets
    - /organizations/{org_id}/teams/{team_id}/{key_name} - Team-level secrets
    - /organizations/{org_id}/teams/{team_id}/users/{user_id}/{key_name} - User-level
    - /mcp/servers/{server_id}/auth - MCP server auth secrets

    The encrypted_value field contains the Fernet-encrypted, base64-encoded secret.
    """

    __tablename__: ClassVar[str] = "encrypted_secrets"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    path: str = Field(index=True, unique=True)
    encrypted_value: str  # Fernet-encrypted, base64-encoded
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# Module-level Fernet instance (lazily initialized)
_fernet: Fernet | None = None


def get_fernet() -> Fernet:
    """Get the Fernet cipher instance for encryption/decryption.

    Derives a 32-byte key from SECRET_KEY using PBKDF2-HMAC-SHA256.
    The key derivation is deterministic given the same SECRET_KEY.

    Returns:
        Fernet instance configured with the derived key

    Raises:
        ValueError: If SECRET_KEY is not set
    """
    global _fernet

    if _fernet is not None:
        return _fernet

    if not settings.SECRET_KEY:
        raise ValueError("SECRET_KEY must be set to use encrypted secrets storage")

    # Derive a 32-byte key from SECRET_KEY using PBKDF2
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=DERIVATION_SALT,
        iterations=KEY_DERIVATION_ITERATIONS,
    )
    key = base64.urlsafe_b64encode(kdf.derive(settings.SECRET_KEY.encode()))
    _fernet = Fernet(key)

    logger.info("fernet_cipher_initialized")
    return _fernet


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext value using Fernet.

    Args:
        plaintext: The value to encrypt

    Returns:
        Base64-encoded encrypted value
    """
    fernet = get_fernet()
    encrypted_bytes = fernet.encrypt(plaintext.encode())
    return encrypted_bytes.decode()


def decrypt_value(encrypted: str) -> str:
    """Decrypt a Fernet-encrypted value.

    Args:
        encrypted: Base64-encoded encrypted value

    Returns:
        Decrypted plaintext value

    Raises:
        InvalidToken: If decryption fails (wrong key or corrupted data)
    """
    fernet = get_fernet()
    decrypted_bytes = fernet.decrypt(encrypted.encode())
    return decrypted_bytes.decode()


def reset_fernet() -> None:
    """Reset the Fernet cipher instance.

    Used primarily for testing when SECRET_KEY changes.
    """
    global _fernet
    _fernet = None
    logger.info("fernet_cipher_reset")


# Re-export InvalidToken for callers to catch
__all__ = [
    "EncryptedSecret",
    "InvalidToken",
    "decrypt_value",
    "encrypt_value",
    "get_fernet",
    "reset_fernet",
]
