"""Add audit logs and app logs tables.

Revision ID: q6r7s8t9u0v1
Revises: p5q6r7s8t9u0
Create Date: 2025-01-19

Creates PostgreSQL tables for audit and application logging.
Includes indexes for efficient querying by timestamp, action, actor, and organization.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "q6r7s8t9u0v1"
down_revision: Union[str, None] = "p5q6r7s8t9u0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create audit_logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.String(), nullable=False, server_default="1.0"),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("category", sa.String(), nullable=False, server_default="audit"),
        sa.Column("outcome", sa.String(), nullable=False, server_default="success"),
        sa.Column("severity", sa.String(), nullable=False, server_default="info"),
        # i18n support
        sa.Column("locale", sa.String(), nullable=False, server_default="en"),
        sa.Column("action_key", sa.String(), nullable=True),
        sa.Column("action_message_en", sa.String(), nullable=True),
        sa.Column("action_message_localized", sa.String(), nullable=True),
        # Actor info
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_email", sa.String(), nullable=True),
        sa.Column("actor_ip_address", sa.String(), nullable=True),
        sa.Column("actor_user_agent", sa.Text(), nullable=True),
        # Multi-tenant scoping
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        # Request context
        sa.Column("request_id", sa.String(), nullable=True),
        sa.Column("session_id", sa.String(), nullable=True),
        # Flexible JSON fields
        sa.Column("targets", JSONB(), nullable=True),
        sa.Column("metadata", JSONB(), nullable=True),
        sa.Column("changes", JSONB(), nullable=True),
        # Error info
        sa.Column("error_code", sa.String(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for audit_logs
    op.create_index(
        op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_actor_id"), "audit_logs", ["actor_id"], unique=False
    )
    op.create_index(
        op.f("ix_audit_logs_organization_id"),
        "audit_logs",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_audit_logs_team_id"), "audit_logs", ["team_id"], unique=False
    )
    # Composite indexes for common queries
    op.create_index(
        "idx_audit_logs_org_time", "audit_logs", ["organization_id", "timestamp"]
    )
    op.create_index(
        "idx_audit_logs_actor_time", "audit_logs", ["actor_id", "timestamp"]
    )

    # Create app_logs table
    op.create_table(
        "app_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("level", sa.String(), nullable=False),
        sa.Column("logger", sa.String(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        # i18n support
        sa.Column("locale", sa.String(), nullable=False, server_default="en"),
        sa.Column("message_key", sa.String(), nullable=True),
        sa.Column("message_en", sa.Text(), nullable=True),
        sa.Column("message_localized", sa.Text(), nullable=True),
        sa.Column("request_id", sa.String(), nullable=True),
        # Multi-tenant scoping
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        # Code location
        sa.Column("module", sa.String(), nullable=True),
        sa.Column("function", sa.String(), nullable=True),
        sa.Column("line_number", sa.Integer(), nullable=True),
        # Exception info
        sa.Column("exception_type", sa.String(), nullable=True),
        sa.Column("exception_message", sa.Text(), nullable=True),
        sa.Column("stack_trace", sa.Text(), nullable=True),
        # Performance
        sa.Column("duration_ms", sa.Float(), nullable=True),
        # Extra context
        sa.Column("extra", JSONB(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for app_logs
    op.create_index(
        op.f("ix_app_logs_timestamp"), "app_logs", ["timestamp"], unique=False
    )
    op.create_index(op.f("ix_app_logs_level"), "app_logs", ["level"], unique=False)
    op.create_index(
        op.f("ix_app_logs_organization_id"),
        "app_logs",
        ["organization_id"],
        unique=False,
    )
    # Composite index for common queries
    op.create_index(
        "idx_app_logs_org_time", "app_logs", ["organization_id", "timestamp"]
    )


def downgrade() -> None:
    # Drop app_logs indexes and table
    op.drop_index("idx_app_logs_org_time", table_name="app_logs")
    op.drop_index(op.f("ix_app_logs_organization_id"), table_name="app_logs")
    op.drop_index(op.f("ix_app_logs_level"), table_name="app_logs")
    op.drop_index(op.f("ix_app_logs_timestamp"), table_name="app_logs")
    op.drop_table("app_logs")

    # Drop audit_logs indexes and table
    op.drop_index("idx_audit_logs_actor_time", table_name="audit_logs")
    op.drop_index("idx_audit_logs_org_time", table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_team_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_organization_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_actor_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_timestamp"), table_name="audit_logs")
    op.drop_table("audit_logs")
