"""Audit logging client using PostgreSQL and JSON file backup.

Provides audit log storage in PostgreSQL with JSON Lines file backup
for disaster recovery and compliance archiving.
"""

import asyncio
import contextlib
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlmodel import Session, col, select

from backend.audit.file_logger import (
    cleanup_file_loggers,
    get_app_file_logger,
    get_audit_file_logger,
)
from backend.audit.models import AppLog, AuditLog
from backend.core.config import settings
from backend.core.db import engine
from backend.core.logging import get_logger

logger = get_logger(__name__)

_cleanup_task: asyncio.Task[None] | None = None
_initialized: bool = False

# Index prefixes (kept for compatibility with service.py)
AUDIT_INDEX_PREFIX = "audit-logs"
APP_INDEX_PREFIX = "app-logs"

# Retention periods in days (from settings or defaults)
AUDIT_LOG_RETENTION_DAYS = 90
APP_LOG_RETENTION_DAYS = 30

# Cleanup interval (24 hours in seconds)
CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60


@asynccontextmanager
async def audit_lifespan():
    """Async context manager for audit system lifecycle.

    Initializes file loggers and starts the cleanup scheduler.
    """
    global _initialized

    try:
        # Initialize file loggers
        get_audit_file_logger()
        get_app_file_logger()
        _initialized = True

        logger.info("audit_system_initialized", storage="postgresql")

        # Run initial cleanup on startup and start periodic scheduler
        await run_scheduled_cleanup()
        start_cleanup_scheduler()

        yield

    except Exception as e:
        logger.exception("audit_system_init_failed", error=str(e))
        yield

    finally:
        # Stop cleanup scheduler
        await stop_cleanup_scheduler()

        # Cleanup file loggers
        cleanup_file_loggers()
        _initialized = False

        logger.info("audit_system_shutdown")


def _convert_audit_event_to_model(document: dict[str, Any]) -> AuditLog:
    """Convert an audit event dictionary to an AuditLog model."""
    # Extract actor info
    actor = document.get("actor", {})

    # Parse UUIDs
    actor_id = None
    if actor.get("id"):
        with contextlib.suppress(ValueError, TypeError):
            actor_id = UUID(str(actor["id"]))

    org_id = None
    if document.get("organization_id"):
        with contextlib.suppress(ValueError, TypeError):
            org_id = UUID(str(document["organization_id"]))

    team_id = None
    if document.get("team_id"):
        with contextlib.suppress(ValueError, TypeError):
            team_id = UUID(str(document["team_id"]))

    # Parse timestamp
    timestamp = document.get("timestamp")
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = datetime.now(UTC)
    elif timestamp is None:
        timestamp = datetime.now(UTC)

    audit_log = AuditLog(
        timestamp=timestamp,
        version=document.get("version", "1.0"),
        action=document.get("action", "unknown"),
        category=document.get("category", "audit"),
        outcome=document.get("outcome", "success"),
        severity=document.get("severity", "info"),
        actor_id=actor_id,
        actor_email=actor.get("email"),
        actor_ip_address=actor.get("ip_address"),
        actor_user_agent=actor.get("user_agent"),
        organization_id=org_id,
        team_id=team_id,
        request_id=document.get("request_id"),
        session_id=document.get("session_id"),
        targets=document.get("targets"),
        metadata_=document.get("metadata"),
        changes=document.get("changes"),
        error_code=document.get("error_code"),
        error_message=document.get("error_message"),
    )
    # Set id only if present in document
    if document.get("id"):
        audit_log.id = UUID(document["id"])
    return audit_log


def _convert_app_log_to_model(document: dict[str, Any]) -> AppLog:
    """Convert an app log dictionary to an AppLog model."""
    # Parse UUIDs
    org_id = None
    if document.get("organization_id"):
        with contextlib.suppress(ValueError, TypeError):
            org_id = UUID(str(document["organization_id"]))

    team_id = None
    if document.get("team_id"):
        with contextlib.suppress(ValueError, TypeError):
            team_id = UUID(str(document["team_id"]))

    user_id = None
    if document.get("user_id"):
        with contextlib.suppress(ValueError, TypeError):
            user_id = UUID(str(document["user_id"]))

    # Parse timestamp
    timestamp = document.get("timestamp")
    if isinstance(timestamp, str):
        try:
            timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            timestamp = datetime.now(UTC)
    elif timestamp is None:
        timestamp = datetime.now(UTC)

    app_log = AppLog(
        timestamp=timestamp,
        level=document.get("level", "info"),
        logger=document.get("logger"),
        message=document.get("message"),
        request_id=document.get("request_id"),
        organization_id=org_id,
        team_id=team_id,
        user_id=user_id,
        module=document.get("module"),
        function=document.get("function"),
        line_number=document.get("line_number"),
        exception_type=document.get("exception_type"),
        exception_message=document.get("exception_message"),
        stack_trace=document.get("stack_trace"),
        duration_ms=document.get("duration_ms"),
        extra=document.get("extra"),
    )
    # Set id only if present in document
    if document.get("id"):
        app_log.id = UUID(document["id"])
    return app_log


def _convert_audit_log_to_dict(log: AuditLog) -> dict[str, Any]:
    """Convert an AuditLog model back to dictionary format."""
    return {
        "id": str(log.id),
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "version": log.version,
        "action": log.action,
        "category": log.category,
        "outcome": log.outcome,
        "severity": log.severity,
        "actor": {
            "id": str(log.actor_id) if log.actor_id else None,
            "email": log.actor_email,
            "ip_address": log.actor_ip_address,
            "user_agent": log.actor_user_agent,
        },
        "organization_id": str(log.organization_id) if log.organization_id else None,
        "team_id": str(log.team_id) if log.team_id else None,
        "request_id": log.request_id,
        "session_id": log.session_id,
        "targets": log.targets,
        "metadata": log.metadata_,
        "changes": log.changes,
        "error_code": log.error_code,
        "error_message": log.error_message,
    }


async def index_document(
    index_prefix: str,
    document: dict[str, Any],
    document_id: str | None = None,
) -> bool:
    """Index a document (audit event or app log) to PostgreSQL and file.

    Args:
        index_prefix: Either AUDIT_INDEX_PREFIX or APP_INDEX_PREFIX
        document: The document to index
        document_id: Optional document ID (uses event id if not provided)

    Returns:
        True if successful, False otherwise
    """
    if not _initialized:
        return False

    try:
        # Add document_id if provided
        if document_id and "id" not in document:
            document["id"] = document_id

        # Write to file logger first (fast, non-blocking)
        if index_prefix == AUDIT_INDEX_PREFIX:
            file_logger = get_audit_file_logger()
            file_logger.log(document)

            # Write to PostgreSQL
            audit_model = _convert_audit_event_to_model(document)
            with Session(engine) as session:
                session.add(audit_model)
                session.commit()
        else:
            file_logger = get_app_file_logger()
            file_logger.log(document)

            # Write to PostgreSQL
            app_model = _convert_app_log_to_model(document)
            with Session(engine) as session:
                session.add(app_model)
                session.commit()

    except Exception as e:
        logger.exception(
            "audit_index_failed",
            index_prefix=index_prefix,
            error=str(e),
        )
        return False
    else:
        return True


async def bulk_index_documents(
    index_prefix: str,
    documents: list[dict[str, Any]],
) -> tuple[int, int]:
    """Bulk index multiple documents to PostgreSQL.

    More efficient than individual index_document calls for high-volume logging.

    Args:
        index_prefix: Either AUDIT_INDEX_PREFIX or APP_INDEX_PREFIX
        documents: List of documents to index

    Returns:
        Tuple of (success_count, error_count)
    """
    if not _initialized or not documents:
        return 0, len(documents) if documents else 0

    success_count = 0
    error_count = 0

    try:
        # Get appropriate file logger
        if index_prefix == AUDIT_INDEX_PREFIX:
            file_logger = get_audit_file_logger()
        else:
            file_logger = get_app_file_logger()

        # Write all documents to file first
        for doc in documents:
            file_logger.log(doc)

        # Batch insert to PostgreSQL
        with Session(engine) as session:
            for doc in documents:
                try:
                    log_model: AuditLog | AppLog
                    if index_prefix == AUDIT_INDEX_PREFIX:
                        log_model = _convert_audit_event_to_model(doc)
                    else:
                        log_model = _convert_app_log_to_model(doc)
                    session.add(log_model)
                    success_count += 1
                except Exception as e:
                    logger.warning(
                        "audit_bulk_document_failed",
                        error=str(e),
                        document_id=doc.get("id"),
                    )
                    error_count += 1

            session.commit()

        if error_count > 0:
            logger.warning(
                "audit_bulk_index_partial_failure",
                index_prefix=index_prefix,
                success_count=success_count,
                error_count=error_count,
            )

    except Exception as e:
        logger.exception(
            "audit_bulk_index_failed",
            index_prefix=index_prefix,
            document_count=len(documents),
            error=str(e),
        )
        return 0, len(documents)

    return success_count, error_count


async def search_logs(
    index_prefix: str,
    query: dict[str, Any],
    skip: int = 0,
    limit: int = 50,
    sort: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """Search logs in PostgreSQL.

    Args:
        index_prefix: Either AUDIT_INDEX_PREFIX or APP_INDEX_PREFIX
        query: Query parameters (bool query format with term/range filters)
        skip: Number of results to skip
        limit: Maximum results to return
        sort: Sort configuration (list of {field: {order: "asc"|"desc"}})

    Returns:
        Tuple of (results, total_count)
    """
    if not _initialized:
        return [], 0

    try:
        with Session(engine) as session:
            if index_prefix == AUDIT_INDEX_PREFIX:
                results, total = _search_audit_logs(session, query, skip, limit, sort)
            else:
                results, total = _search_app_logs(session, query, skip, limit, sort)

            return results, total

    except Exception as e:
        logger.exception(
            "audit_search_failed",
            index_prefix=index_prefix,
            error=str(e),
        )
        return [], 0


def _search_audit_logs(
    session: Session,
    query: dict[str, Any],
    skip: int,
    limit: int,
    sort: list[dict[str, Any]] | None,
) -> tuple[list[dict[str, Any]], int]:
    """Search audit logs with filters."""
    statement = select(AuditLog)

    # Parse query filters (bool query format with term/range clauses)
    bool_query = query.get("bool", {})
    must_clauses = bool_query.get("must", [])
    filter_clauses = bool_query.get("filter", [])

    # Process filter clauses
    for clause in filter_clauses + must_clauses:
        if "term" in clause:
            for field, value in clause["term"].items():
                if field == "organization_id":
                    statement = statement.where(
                        AuditLog.organization_id == UUID(str(value))
                    )
                elif field == "team_id":
                    statement = statement.where(AuditLog.team_id == UUID(str(value)))
                elif field == "actor.id":
                    statement = statement.where(AuditLog.actor_id == UUID(str(value)))
                elif field == "action":
                    statement = statement.where(AuditLog.action == value)
                elif field == "outcome":
                    statement = statement.where(AuditLog.outcome == value)
                elif field == "severity":
                    statement = statement.where(AuditLog.severity == value)

        if "range" in clause:
            for field, range_spec in clause["range"].items():
                if field == "timestamp":
                    if "gte" in range_spec:
                        ts = range_spec["gte"]
                        if isinstance(ts, str):
                            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        statement = statement.where(AuditLog.timestamp >= ts)
                    if "lte" in range_spec:
                        ts = range_spec["lte"]
                        if isinstance(ts, str):
                            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        statement = statement.where(AuditLog.timestamp <= ts)

        if "terms" in clause:
            for field, values in clause["terms"].items():
                if field == "action":
                    statement = statement.where(col(AuditLog.action).in_(values))

    # Count total before pagination
    count_statement = select(AuditLog.id).where(
        *statement.whereclause.clauses if statement.whereclause is not None else []
    )
    total = len(session.exec(count_statement).all())

    # Apply sorting
    if sort:
        for sort_spec in sort:
            for field, order_spec in sort_spec.items():
                order = order_spec.get("order", "desc")
                if field == "timestamp":
                    if order == "desc":
                        statement = statement.order_by(col(AuditLog.timestamp).desc())
                    else:
                        statement = statement.order_by(col(AuditLog.timestamp))
    else:
        # Default sort by timestamp descending
        statement = statement.order_by(col(AuditLog.timestamp).desc())

    # Apply pagination
    statement = statement.offset(skip).limit(limit)

    # Execute query
    logs = session.exec(statement).all()
    results = [_convert_audit_log_to_dict(log) for log in logs]

    return results, total


def _search_app_logs(
    session: Session,
    query: dict[str, Any],
    skip: int,
    limit: int,
    sort: list[dict[str, Any]] | None,
) -> tuple[list[dict[str, Any]], int]:
    """Search application logs with filters."""
    statement = select(AppLog)

    # Parse query filters
    bool_query = query.get("bool", {})
    filter_clauses = bool_query.get("filter", [])
    must_clauses = bool_query.get("must", [])

    for clause in filter_clauses + must_clauses:
        if "term" in clause:
            for field, value in clause["term"].items():
                if field == "organization_id":
                    statement = statement.where(
                        AppLog.organization_id == UUID(str(value))
                    )
                elif field == "level":
                    statement = statement.where(AppLog.level == value)
                elif field == "logger":
                    statement = statement.where(AppLog.logger == value)

        if "range" in clause:
            for field, range_spec in clause["range"].items():
                if field == "timestamp":
                    if "gte" in range_spec:
                        ts = range_spec["gte"]
                        if isinstance(ts, str):
                            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        statement = statement.where(AppLog.timestamp >= ts)
                    if "lte" in range_spec:
                        ts = range_spec["lte"]
                        if isinstance(ts, str):
                            ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                        statement = statement.where(AppLog.timestamp <= ts)

    # Count total before pagination
    count_statement = select(AppLog.id).where(
        *statement.whereclause.clauses if statement.whereclause is not None else []
    )
    total = len(session.exec(count_statement).all())

    # Apply sorting
    if sort:
        for sort_spec in sort:
            for field, order_spec in sort_spec.items():
                order = order_spec.get("order", "desc")
                if field == "timestamp":
                    if order == "desc":
                        statement = statement.order_by(col(AppLog.timestamp).desc())
                    else:
                        statement = statement.order_by(col(AppLog.timestamp))
    else:
        statement = statement.order_by(col(AppLog.timestamp).desc())

    # Apply pagination
    statement = statement.offset(skip).limit(limit)

    # Execute query
    logs = session.exec(statement).all()
    results = [
        {
            "id": str(log.id),
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "level": log.level,
            "logger": log.logger,
            "message": log.message,
            "request_id": log.request_id,
            "organization_id": str(log.organization_id)
            if log.organization_id
            else None,
            "team_id": str(log.team_id) if log.team_id else None,
            "user_id": str(log.user_id) if log.user_id else None,
            "module": log.module,
            "function": log.function,
            "line_number": log.line_number,
            "exception_type": log.exception_type,
            "exception_message": log.exception_message,
            "stack_trace": log.stack_trace,
            "duration_ms": log.duration_ms,
            "extra": log.extra,
        }
        for log in logs
    ]

    return results, total


async def delete_old_logs(
    log_type: str = "audit",
    days_to_keep: int = 90,
) -> int:
    """Delete logs older than the retention period.

    Args:
        log_type: Either "audit" or "app"
        days_to_keep: Number of days to retain logs

    Returns:
        Number of deleted records
    """
    if not _initialized:
        return 0

    try:
        cutoff = datetime.now(UTC) - timedelta(days=days_to_keep)

        with Session(engine) as session:
            if log_type == "audit":
                # Use raw SQL for efficient bulk delete
                result = session.execute(
                    text("DELETE FROM audit_logs WHERE timestamp < :cutoff").bindparams(
                        cutoff=cutoff
                    )
                )
            else:
                result = session.execute(
                    text("DELETE FROM app_logs WHERE timestamp < :cutoff").bindparams(
                        cutoff=cutoff
                    )
                )

            session.commit()
            deleted_count: int = result.rowcount  # type: ignore[attr-defined]

            if deleted_count > 0:
                logger.info(
                    "audit_logs_deleted",
                    log_type=log_type,
                    deleted_count=deleted_count,
                    days_to_keep=days_to_keep,
                )

            return deleted_count

    except Exception as e:
        logger.exception("audit_retention_cleanup_failed", error=str(e))
        return 0


# Keep old function name as alias for compatibility
async def delete_old_indices(
    index_prefix: str,
    days_to_keep: int = 90,
) -> list[str]:
    """Delete logs older than the retention period (compatibility wrapper).

    Args:
        index_prefix: Either AUDIT_INDEX_PREFIX or APP_INDEX_PREFIX
        days_to_keep: Number of days to retain logs

    Returns:
        List with single entry showing deleted count (for compatibility)
    """
    log_type = "audit" if index_prefix == AUDIT_INDEX_PREFIX else "app"
    deleted_count = await delete_old_logs(log_type, days_to_keep)
    if deleted_count > 0:
        return [f"{log_type}-logs: {deleted_count} records"]
    return []


async def run_scheduled_cleanup() -> None:
    """Run cleanup for both audit and app logs.

    This function is called on startup and then periodically.
    """
    audit_retention = getattr(
        settings, "AUDIT_LOG_RETENTION_DAYS", AUDIT_LOG_RETENTION_DAYS
    )
    app_retention = getattr(settings, "APP_LOG_RETENTION_DAYS", APP_LOG_RETENTION_DAYS)

    audit_deleted = await delete_old_logs("audit", days_to_keep=audit_retention)
    app_deleted = await delete_old_logs("app", days_to_keep=app_retention)

    if audit_deleted > 0 or app_deleted > 0:
        logger.info(
            "audit_scheduled_cleanup_completed",
            audit_records_deleted=audit_deleted,
            app_records_deleted=app_deleted,
        )


async def _periodic_cleanup_task() -> None:
    """Background task that runs log cleanup periodically."""
    while True:
        try:
            await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
            await run_scheduled_cleanup()
        except asyncio.CancelledError:
            logger.info("audit_cleanup_task_cancelled")
            break
        except Exception as e:
            logger.exception("audit_cleanup_task_error", error=str(e))
            # Continue running even after errors


def start_cleanup_scheduler() -> None:
    """Start the background cleanup task."""
    global _cleanup_task
    if _cleanup_task is None or _cleanup_task.done():
        _cleanup_task = asyncio.create_task(_periodic_cleanup_task())
        logger.info("audit_cleanup_scheduler_started")


async def stop_cleanup_scheduler() -> None:
    """Stop the background cleanup task."""
    global _cleanup_task
    if _cleanup_task is not None and not _cleanup_task.done():
        _cleanup_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _cleanup_task
        _cleanup_task = None
        logger.info("audit_cleanup_scheduler_stopped")
