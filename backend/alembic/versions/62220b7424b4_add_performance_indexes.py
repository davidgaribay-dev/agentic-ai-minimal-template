"""add_performance_indexes

Revision ID: 62220b7424b4
Revises: q6r7s8t9u0v1

Performance optimization indexes for frequently queried columns.
Addresses N+1 query patterns and slow multi-tenant lookups.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "62220b7424b4"
down_revision: Union[str, Sequence[str], None] = "q6r7s8t9u0v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes."""
    # PasswordHistory: Composite index for efficient ordering by created_at per user
    op.create_index(
        "ix_password_history_user_created",
        "password_history",
        ["user_id", "created_at"],
        unique=False,
    )

    # OrganizationMember: Index for querying members by org and role
    op.create_index(
        "ix_org_member_org_role",
        "organization_member",
        ["organization_id", "role"],
        unique=False,
    )

    # OrganizationMember: Index for finding all orgs a user belongs to
    op.create_index(
        "ix_org_member_user",
        "organization_member",
        ["user_id"],
        unique=False,
    )

    # Conversation: Composite index for listing by team, user, sorted by update time
    op.create_index(
        "ix_conversation_team_user_updated",
        "conversation",
        ["team_id", "created_by_id", "updated_at"],
        unique=False,
    )

    # Conversation: Composite index for filtering by team with soft delete check
    op.create_index(
        "ix_conversation_team_deleted",
        "conversation",
        ["team_id", "deleted_at"],
        unique=False,
    )

    # ConversationMessage: Composite index for fetching messages by conversation
    op.create_index(
        "ix_conv_msg_conv_created",
        "conversation_message",
        ["conversation_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove performance indexes."""
    op.drop_index("ix_conv_msg_conv_created", table_name="conversation_message")
    op.drop_index("ix_conversation_team_deleted", table_name="conversation")
    op.drop_index("ix_conversation_team_user_updated", table_name="conversation")
    op.drop_index("ix_org_member_user", table_name="organization_member")
    op.drop_index("ix_org_member_org_role", table_name="organization_member")
    op.drop_index("ix_password_history_user_created", table_name="password_history")
