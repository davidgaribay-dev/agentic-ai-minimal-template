"""JSON file logger for audit log backup.

Provides rotating JSON Lines (JSONL) file logging as a backup mechanism
for audit logs. This ensures logs are preserved even if database writes fail.
"""

import json
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)

# Default log directory
DEFAULT_LOG_DIR = "/var/log/app"

# Max file size before rotation (100 MB)
MAX_BYTES = 100_000_000

# Number of backup files to keep
BACKUP_COUNT = 10


class JSONFileLogger:
    """Rotating JSON Lines logger for audit log backup.

    Writes audit events as JSON Lines to rotating files. Each line is a
    complete JSON document, making it easy to parse and process.

    Files are rotated when they reach MAX_BYTES, with BACKUP_COUNT backups kept.
    """

    def __init__(
        self,
        log_dir: str | None = None,
        prefix: str = "audit",
        max_bytes: int = MAX_BYTES,
        backup_count: int = BACKUP_COUNT,
    ) -> None:
        """Initialize the JSON file logger.

        Args:
            log_dir: Directory for log files. Defaults to AUDIT_LOG_DIR setting.
            prefix: Filename prefix (e.g., "audit" -> "audit.jsonl")
            max_bytes: Max file size before rotation
            backup_count: Number of backup files to keep
        """
        resolved_dir = (
            log_dir or getattr(settings, "AUDIT_LOG_DIR", None) or DEFAULT_LOG_DIR
        )
        self.log_dir = Path(str(resolved_dir))
        self.prefix = prefix
        self.max_bytes = max_bytes
        self.backup_count = backup_count

        self._handler: RotatingFileHandler | None = None
        self._logger: logging.Logger | None = None
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        """Initialize the file handler lazily.

        Returns:
            True if initialized successfully, False otherwise
        """
        if self._initialized:
            return self._handler is not None

        self._initialized = True

        try:
            # Create log directory if it doesn't exist
            self.log_dir.mkdir(parents=True, exist_ok=True)

            log_file = self.log_dir / f"{self.prefix}.jsonl"

            self._handler = RotatingFileHandler(
                log_file,
                maxBytes=self.max_bytes,
                backupCount=self.backup_count,
                encoding="utf-8",
            )
            self._handler.setFormatter(logging.Formatter("%(message)s"))

            self._logger = logging.getLogger(f"audit.file.{self.prefix}")
            self._logger.addHandler(self._handler)
            self._logger.setLevel(logging.INFO)
            # Prevent propagation to root logger
            self._logger.propagate = False

            logger.info(
                "json_file_logger_initialized",
                log_file=str(log_file),
                max_bytes=self.max_bytes,
                backup_count=self.backup_count,
            )
        except Exception as e:
            logger.warning(
                "json_file_logger_init_failed",
                error=str(e),
                log_dir=str(self.log_dir),
            )
            return False
        else:
            return True

    def log(self, data: dict[str, Any]) -> bool:
        """Write a JSON document as a single line.

        Args:
            data: Dictionary to serialize to JSON

        Returns:
            True if logged successfully, False otherwise
        """
        if not self._ensure_initialized():
            return False

        if self._logger is None:
            return False

        try:
            # Serialize with default=str to handle UUIDs, datetimes, etc.
            json_line = json.dumps(data, default=str, ensure_ascii=False)
            self._logger.info(json_line)
        except Exception as e:
            logger.warning(
                "json_file_log_failed",
                error=str(e),
                prefix=self.prefix,
            )
            return False
        else:
            return True

    def close(self) -> None:
        """Close the file handler."""
        if self._handler is not None:
            self._handler.close()
            self._handler = None

        if self._logger is not None:
            self._logger.handlers.clear()
            self._logger = None

        self._initialized = False


# Global file loggers for audit and app logs
_audit_file_logger: JSONFileLogger | None = None
_app_file_logger: JSONFileLogger | None = None


def get_audit_file_logger() -> JSONFileLogger:
    """Get the global audit file logger."""
    global _audit_file_logger
    if _audit_file_logger is None:
        _audit_file_logger = JSONFileLogger(prefix="audit")
    return _audit_file_logger


def get_app_file_logger() -> JSONFileLogger:
    """Get the global app log file logger."""
    global _app_file_logger
    if _app_file_logger is None:
        _app_file_logger = JSONFileLogger(prefix="app")
    return _app_file_logger


def cleanup_file_loggers() -> None:
    """Close all file loggers."""
    global _audit_file_logger, _app_file_logger

    if _audit_file_logger is not None:
        _audit_file_logger.close()
        _audit_file_logger = None

    if _app_file_logger is not None:
        _app_file_logger.close()
        _app_file_logger = None

    logger.info("file_loggers_closed")
