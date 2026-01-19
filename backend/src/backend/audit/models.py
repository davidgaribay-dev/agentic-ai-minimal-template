"""Audit log models for PostgreSQL storage.

Stores audit and application logs in PostgreSQL.
Uses JSONB columns for flexible metadata storage with efficient indexing.
"""

from datetime import UTC, datetime
from typing import Any, ClassVar
import uuid

from sqlalchemy import Column, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class AuditLog(SQLModel, table=True):
    """Audit log table for compliance and security events.

    Stores all user actions and system events with full context for
    compliance, debugging, and security analysis.
    """

    __tablename__: ClassVar[str] = "audit_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
    )
    version: str = Field(default="1.0")
    action: str = Field(index=True)
    category: str = Field(default="audit")
    outcome: str = Field(default="success")  # success, failure, unknown
    severity: str = Field(default="info")  # debug, info, warning, error, critical

    # i18n support
    locale: str = Field(default="en")
    action_key: str | None = None
    action_message_en: str | None = None
    action_message_localized: str | None = None

    # Actor info
    actor_id: uuid.UUID | None = Field(default=None, index=True)
    actor_email: str | None = None
    actor_ip_address: str | None = None
    actor_user_agent: str | None = Field(default=None, sa_column=Column(Text))

    # Multi-tenant scoping
    organization_id: uuid.UUID | None = Field(default=None, index=True)
    team_id: uuid.UUID | None = Field(default=None, index=True)

    # Request context
    request_id: str | None = None
    session_id: str | None = None

    # Flexible JSON fields for targets, metadata, changes
    targets: list[dict[str, Any]] | None = Field(default=None, sa_column=Column(JSONB))
    metadata_: dict[str, Any] | None = Field(
        default=None, sa_column=Column("metadata", JSONB)
    )
    changes: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))

    # Error info
    error_code: str | None = None
    error_message: str | None = Field(default=None, sa_column=Column(Text))

    __table_args__ = (
        Index("idx_audit_logs_org_time", "organization_id", "timestamp"),
        Index("idx_audit_logs_actor_time", "actor_id", "timestamp"),
        Index("idx_audit_logs_action_time", "action", "timestamp"),
    )


class AppLog(SQLModel, table=True):
    """Application log table for operational monitoring.

    Stores application logs with structured data for debugging and
    performance analysis. Separate from audit logs for different
    retention and access patterns.
    """

    __tablename__: ClassVar[str] = "app_logs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        index=True,
    )
    level: str = Field(index=True)  # debug, info, warning, error, critical
    logger: str | None = None
    message: str | None = Field(default=None, sa_column=Column(Text))

    # i18n context
    locale: str = Field(default="en")
    message_key: str | None = None
    message_en: str | None = Field(default=None, sa_column=Column(Text))
    message_localized: str | None = Field(default=None, sa_column=Column(Text))

    # Context
    request_id: str | None = None
    organization_id: uuid.UUID | None = Field(default=None, index=True)
    team_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None

    # Technical details
    module: str | None = None
    function: str | None = None
    line_number: int | None = None

    # Exception info
    exception_type: str | None = None
    exception_message: str | None = Field(default=None, sa_column=Column(Text))
    stack_trace: str | None = Field(default=None, sa_column=Column(Text))

    # Performance
    duration_ms: float | None = None

    # Additional context (flexible JSON)
    extra: dict[str, Any] | None = Field(default=None, sa_column=Column(JSONB))

    __table_args__ = (
        Index("idx_app_logs_org_time", "organization_id", "timestamp"),
        Index("idx_app_logs_level_time", "level", "timestamp"),
    )
