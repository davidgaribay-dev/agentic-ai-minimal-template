from functools import lru_cache
from typing import Any, BinaryIO, ClassVar
import uuid

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)


# =============================================================================
# Magic Byte Validation
# =============================================================================


class FileMagicMismatchError(Exception):
    """Raised when file content doesn't match claimed MIME type."""


class MagicByteValidator:
    """Validates file content against claimed MIME type using magic bytes.

    Security feature to prevent extension spoofing attacks where a malicious
    file is uploaded with a fake extension/content-type.
    """

    # WebP validation constants (RIFF header at 0, WEBP marker at offset 8-12)
    WEBP_MIN_SIZE: ClassVar[int] = 12
    WEBP_MARKER_START: ClassVar[int] = 8
    WEBP_MARKER_END: ClassVar[int] = 12

    # Magic byte signatures for common file types
    # Format: mime_type -> (offset, bytes_to_check)
    SIGNATURES: ClassVar[dict[str, list[tuple[int, bytes]]]] = {
        # Images
        "image/jpeg": [(0, b"\xff\xd8\xff")],
        "image/png": [(0, b"\x89PNG\r\n\x1a\n")],
        "image/gif": [(0, b"GIF87a"), (0, b"GIF89a")],
        "image/webp": [(0, b"RIFF"), (8, b"WEBP")],  # RIFF....WEBP
        # Documents
        "application/pdf": [(0, b"%PDF")],
        # Office formats (ZIP-based, same header)
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            (0, b"PK\x03\x04")
        ],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
            (0, b"PK\x03\x04")
        ],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
            (0, b"PK\x03\x04")
        ],
        # Archives
        "application/zip": [(0, b"PK\x03\x04")],
        "application/gzip": [(0, b"\x1f\x8b")],
    }

    # MIME types that don't have magic bytes (text-based)
    TEXT_TYPES: ClassVar[set[str]] = {
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "text/css",
        "text/javascript",
        "application/json",
        "application/xml",
        "text/xml",
    }

    @classmethod
    def validate(
        cls, content: bytes, claimed_mime_type: str, filename: str | None = None
    ) -> bool:
        """Validate file content matches claimed MIME type.

        Args:
            content: File content bytes
            claimed_mime_type: MIME type claimed by the upload
            filename: Optional filename for logging

        Returns:
            True if validation passes

        Raises:
            FileMagicMismatchError: If content doesn't match claimed type
        """
        # Skip validation for text types (no reliable magic bytes)
        if claimed_mime_type in cls.TEXT_TYPES:
            return True

        # Skip validation for types we don't have signatures for
        if claimed_mime_type not in cls.SIGNATURES:
            logger.debug(
                "magic_byte_skip_unknown_type",
                mime_type=claimed_mime_type,
                filename=filename,
            )
            return True

        signatures = cls.SIGNATURES[claimed_mime_type]

        # WebP is special: needs both RIFF header AND WEBP at offset 8
        if claimed_mime_type == "image/webp":
            if len(content) < cls.WEBP_MIN_SIZE:
                cls._log_and_raise(claimed_mime_type, filename, "file too small")
            if not content.startswith(b"RIFF"):
                cls._log_and_raise(claimed_mime_type, filename, "missing RIFF header")
            if content[cls.WEBP_MARKER_START : cls.WEBP_MARKER_END] != b"WEBP":
                cls._log_and_raise(claimed_mime_type, filename, "missing WEBP marker")
            return True

        # Check if any signature matches
        for offset, magic_bytes in signatures:
            if len(content) < offset + len(magic_bytes):
                continue
            if content[offset : offset + len(magic_bytes)] == magic_bytes:
                return True

        # No signature matched
        cls._log_and_raise(claimed_mime_type, filename, "no matching signature")
        return False  # Never reached, but satisfies type checker

    @classmethod
    def _log_and_raise(
        cls, claimed_type: str, filename: str | None, reason: str
    ) -> None:
        """Log security event and raise exception."""
        # Get actual magic bytes for logging (first 16 bytes hex)
        logger.warning(
            "magic_byte_mismatch",
            claimed_type=claimed_type,
            filename=filename,
            reason=reason,
        )
        raise FileMagicMismatchError(
            f"File content does not match claimed type '{claimed_type}': {reason}"
        )


def validate_file_magic(
    content: bytes, claimed_mime_type: str, filename: str | None = None
) -> bool:
    """Validate file content matches claimed MIME type using magic bytes.

    This is a security feature to prevent extension spoofing attacks.

    Args:
        content: File content bytes
        claimed_mime_type: MIME type claimed by the upload
        filename: Optional filename for logging

    Returns:
        True if validation passes

    Raises:
        FileMagicMismatchError: If content doesn't match claimed type
    """
    return MagicByteValidator.validate(content, claimed_mime_type, filename)


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}

# Profile image limits
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Chat media limits (configurable per org, these are defaults)
ALLOWED_CHAT_MEDIA_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
}
DEFAULT_MAX_CHAT_MEDIA_SIZE = 10 * 1024 * 1024  # 10MB
DEFAULT_MAX_MEDIA_PER_MESSAGE = 5


class StorageError(Exception):
    """Base exception for storage operations."""


class InvalidFileTypeError(StorageError):
    """Raised when file type is not allowed."""


class FileTooLargeError(StorageError):
    """Raised when file exceeds size limit."""


@lru_cache(maxsize=1)
def get_s3_client() -> Any:
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
        ),
    )


def ensure_bucket_exists(client: Any = None) -> None:
    if client is None:
        client = get_s3_client()

    try:
        client.head_bucket(Bucket=settings.S3_BUCKET_NAME)
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchBucket"):
            logger.info("creating_bucket", bucket=settings.S3_BUCKET_NAME)
            client.create_bucket(Bucket=settings.S3_BUCKET_NAME)
        else:
            raise StorageError(f"Failed to check bucket: {e}") from e


def upload_file(
    file: BinaryIO,
    content_type: str,
    folder: str = "profile-images",
    filename: str | None = None,
) -> str:
    """Upload a file to S3-compatible storage.

    Args:
        file: File-like object to upload
        content_type: MIME type of the file
        folder: Folder path within the bucket
        filename: Optional custom filename (without extension)

    Returns:
        The full URL to access the uploaded file

    Raises:
        InvalidFileTypeError: If content type is not allowed
        FileTooLargeError: If file exceeds size limit
        StorageError: For other storage errors
    """
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise InvalidFileTypeError(
            f"Invalid file type: {content_type}. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES.keys())}"
        )

    content = file.read()
    if len(content) > MAX_FILE_SIZE:
        raise FileTooLargeError(
            f"File too large: {len(content)} bytes. Maximum size: {MAX_FILE_SIZE} bytes"
        )

    extension = ALLOWED_IMAGE_TYPES[content_type]
    if filename is None:
        filename = str(uuid.uuid4())
    object_key = f"{folder}/{filename}{extension}"

    client = get_s3_client()
    ensure_bucket_exists(client)

    try:
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
        logger.info("file_uploaded", key=object_key, size=len(content))
    except ClientError as e:
        logger.exception("upload_failed", key=object_key, error=str(e))
        raise StorageError(f"Failed to upload file: {e}") from e

    # Return URL through our storage proxy API instead of direct S3 URL
    # This ensures images are accessible from the browser (S3 might not be)
    return f"{settings.server_host}/v1/storage/{settings.S3_BUCKET_NAME}/{object_key}"


def delete_file(url: str) -> bool:
    """Delete a file from S3-compatible storage.

    Args:
        url: The full URL of the file to delete

    Returns:
        True if deleted successfully, False if file didn't exist
    """
    # Support both new API URLs and legacy S3 URLs
    api_prefix = f"{settings.server_host}/v1/storage/{settings.S3_BUCKET_NAME}/"
    s3_prefix = f"{settings.s3_public_base_url}/{settings.S3_BUCKET_NAME}/"

    if url.startswith(api_prefix):
        object_key = url[len(api_prefix) :]
    elif url.startswith(s3_prefix):
        object_key = url[len(s3_prefix) :]
    else:
        logger.warning("invalid_url_for_deletion", url=url)
        return False

    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        logger.info("file_deleted", key=object_key)
    except ClientError as e:
        logger.exception("delete_failed", key=object_key, error=str(e))
        return False
    else:
        return True


def upload_document(
    content: bytes,
    filename: str,
    content_type: str,
    org_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
) -> str:
    """Upload a document to S3-compatible storage (SeaweedFS).

    Documents are stored with a hierarchical path:
    - Org-level: documents/{org_id}/{uuid}_{filename}
    - Team-level: documents/{org_id}/{team_id}/{uuid}_{filename}
    - User-level: documents/{org_id}/{team_id}/{user_id}/{uuid}_{filename}

    Args:
        content: File content as bytes
        filename: Original filename
        content_type: MIME type of the file
        org_id: Organization ID
        team_id: Optional team ID
        user_id: Optional user ID (for user-scoped documents)

    Returns:
        The S3 object key (path) for the uploaded file

    Raises:
        StorageError: For storage errors
    """
    # Build hierarchical path
    path_parts = ["documents", str(org_id)]
    if team_id:
        path_parts.append(str(team_id))
    if user_id:
        path_parts.append(str(user_id))

    # Add unique prefix to filename to avoid collisions
    unique_filename = f"{uuid.uuid4()}_{filename}"
    path_parts.append(unique_filename)
    object_key = "/".join(path_parts)

    client = get_s3_client()
    ensure_bucket_exists(client)

    try:
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
            Body=content,
            ContentType=content_type or "application/octet-stream",
        )
        logger.info("document_uploaded", key=object_key, size=len(content))
    except ClientError as e:
        logger.exception("document_upload_failed", key=object_key, error=str(e))
        raise StorageError(f"Failed to upload document: {e}") from e

    return object_key


def get_document_content(object_key: str) -> bytes:
    """Download document content from S3-compatible storage.

    Args:
        object_key: The S3 object key (path) of the document

    Returns:
        The file content as bytes

    Raises:
        StorageError: If file not found or download fails
    """
    client = get_s3_client()

    try:
        response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        content: bytes = response["Body"].read()
        logger.debug("document_downloaded", key=object_key, size=len(content))
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise StorageError(f"Document not found: {object_key}") from e
        logger.exception("document_download_failed", key=object_key, error=str(e))
        raise StorageError(f"Failed to download document: {e}") from e
    else:
        return content


def delete_document(object_key: str) -> bool:
    """Delete a document from S3-compatible storage.

    Args:
        object_key: The S3 object key (path) of the document

    Returns:
        True if deleted successfully, False if file didn't exist
    """
    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        logger.info("document_deleted", key=object_key)
    except ClientError as e:
        logger.exception("document_delete_failed", key=object_key, error=str(e))
        return False
    else:
        return True


def get_document_url(object_key: str) -> str:
    """Get the public URL for a document.

    Args:
        object_key: The S3 object key (path) of the document

    Returns:
        The full URL to access the document
    """
    return f"{settings.server_host}/v1/storage/{settings.S3_BUCKET_NAME}/{object_key}"


# =============================================================================
# Chat Media Functions (for multimodal chat)
# =============================================================================


class ChatMediaError(StorageError):
    """Exception for chat media operations."""


class InvalidChatMediaTypeError(ChatMediaError):
    """Raised when chat media type is not allowed."""


class ChatMediaTooLargeError(ChatMediaError):
    """Raised when chat media exceeds size limit."""


def upload_chat_media(
    content: bytes,
    filename: str,
    content_type: str,
    org_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    max_size: int | None = None,
) -> str:
    """Upload chat media (images) to S3-compatible storage (SeaweedFS).

    Chat media is stored with a hierarchical path:
    - User-level: chat-media/{org_id}/{team_id}/{user_id}/{uuid}_{filename}
    - Team-level: chat-media/{org_id}/{team_id}/{uuid}_{filename}
    - Org-level: chat-media/{org_id}/{uuid}_{filename}

    Args:
        content: File content as bytes
        filename: Original filename
        content_type: MIME type of the file
        org_id: Organization ID
        team_id: Optional team ID
        user_id: Optional user ID (for user-scoped media)
        max_size: Optional max size override (defaults to DEFAULT_MAX_CHAT_MEDIA_SIZE)

    Returns:
        The S3 object key (path) for the uploaded file

    Raises:
        InvalidChatMediaTypeError: If content type is not allowed
        ChatMediaTooLargeError: If file exceeds size limit
        StorageError: For storage errors
    """
    # Validate content type
    if content_type not in ALLOWED_CHAT_MEDIA_TYPES:
        raise InvalidChatMediaTypeError(
            f"Invalid media type: {content_type}. "
            f"Allowed types: {', '.join(ALLOWED_CHAT_MEDIA_TYPES.keys())}"
        )

    # Validate size
    effective_max_size = max_size or DEFAULT_MAX_CHAT_MEDIA_SIZE
    if len(content) > effective_max_size:
        raise ChatMediaTooLargeError(
            f"File too large: {len(content)} bytes. "
            f"Maximum size: {effective_max_size} bytes"
        )

    # Build hierarchical path
    path_parts = ["chat-media", str(org_id)]
    if team_id:
        path_parts.append(str(team_id))
    if user_id:
        path_parts.append(str(user_id))

    # Add unique prefix to filename to avoid collisions
    unique_filename = f"{uuid.uuid4()}_{filename}"
    path_parts.append(unique_filename)
    object_key = "/".join(path_parts)

    client = get_s3_client()
    ensure_bucket_exists(client)

    try:
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=object_key,
            Body=content,
            ContentType=content_type,
        )
        logger.info("chat_media_uploaded", key=object_key, size=len(content))
    except ClientError as e:
        logger.exception("chat_media_upload_failed", key=object_key, error=str(e))
        raise StorageError(f"Failed to upload chat media: {e}") from e

    return object_key


def get_chat_media_content(object_key: str) -> bytes:
    """Download chat media content from S3-compatible storage.

    Args:
        object_key: The S3 object key (path) of the media

    Returns:
        The file content as bytes

    Raises:
        StorageError: If file not found or download fails
    """
    client = get_s3_client()

    try:
        response = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        content: bytes = response["Body"].read()
        logger.debug("chat_media_downloaded", key=object_key, size=len(content))
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code == "NoSuchKey":
            raise StorageError(f"Chat media not found: {object_key}") from e
        logger.exception("chat_media_download_failed", key=object_key, error=str(e))
        raise StorageError(f"Failed to download chat media: {e}") from e
    else:
        return content


def delete_chat_media(object_key: str) -> bool:
    """Delete chat media from S3-compatible storage.

    Args:
        object_key: The S3 object key (path) of the media

    Returns:
        True if deleted successfully, False if file didn't exist
    """
    client = get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=object_key)
        logger.info("chat_media_deleted", key=object_key)
    except ClientError as e:
        logger.exception("chat_media_delete_failed", key=object_key, error=str(e))
        return False
    else:
        return True


def get_chat_media_url(object_key: str) -> str:
    """Get the URL for chat media.

    Args:
        object_key: The S3 object key (path) of the media

    Returns:
        The full URL to access the media
    """
    return f"{settings.server_host}/v1/storage/{settings.S3_BUCKET_NAME}/{object_key}"


def validate_chat_media_type(content_type: str) -> bool:
    """Check if a content type is allowed for chat media.

    Args:
        content_type: MIME type to check

    Returns:
        True if allowed, False otherwise
    """
    return content_type in ALLOWED_CHAT_MEDIA_TYPES
