"""Add LLM settings tables for hierarchical model configuration.

Revision ID: t9u0v1w2x3y4
Revises: s8t9u0v1w2x3

Creates tables for org/team/user LLM settings and custom providers.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "t9u0v1w2x3y4"
down_revision: str | None = "s8t9u0v1w2x3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create organization_llm_settings table
    op.create_table(
        "organization_llm_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        # Default model selection
        sa.Column(
            "default_provider",
            sa.String(length=50),
            nullable=False,
            server_default="anthropic",
        ),
        sa.Column(
            "default_model",
            sa.String(length=100),
            nullable=False,
            server_default="claude-sonnet-4-20250514",
        ),
        # Default parameters
        sa.Column(
            "default_temperature", sa.Float(), nullable=False, server_default="0.7"
        ),
        sa.Column("default_max_tokens", sa.Integer(), nullable=True),
        sa.Column("default_top_p", sa.Float(), nullable=False, server_default="1.0"),
        # Fallback configuration
        sa.Column(
            "fallback_enabled", sa.Boolean(), nullable=False, server_default="false"
        ),
        sa.Column("fallback_models", sa.JSON(), nullable=False, server_default="[]"),
        # Permission controls
        sa.Column(
            "allow_team_customization",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "allow_user_customization",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        sa.Column(
            "allow_per_request_model_selection",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        # Provider restrictions
        sa.Column(
            "enabled_providers",
            sa.JSON(),
            nullable=False,
            server_default='["anthropic", "openai", "google"]',
        ),
        sa.Column("disabled_models", sa.JSON(), nullable=False, server_default="[]"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id"),
    )
    op.create_index(
        "idx_organization_llm_settings_org_id",
        "organization_llm_settings",
        ["organization_id"],
    )

    # Create team_llm_settings table
    op.create_table(
        "team_llm_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        # Model selection (None = inherit from org)
        sa.Column("default_provider", sa.String(length=50), nullable=True),
        sa.Column("default_model", sa.String(length=100), nullable=True),
        # Parameters (None = inherit)
        sa.Column("default_temperature", sa.Float(), nullable=True),
        sa.Column("default_max_tokens", sa.Integer(), nullable=True),
        # Permission controls
        sa.Column(
            "allow_user_customization",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
        # Restrictions (merged with org)
        sa.Column("disabled_models", sa.JSON(), nullable=False, server_default="[]"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id"),
    )
    op.create_index(
        "idx_team_llm_settings_team_id",
        "team_llm_settings",
        ["team_id"],
    )

    # Create user_llm_settings table
    op.create_table(
        "user_llm_settings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        # User preferences (only if allowed)
        sa.Column("preferred_provider", sa.String(length=50), nullable=True),
        sa.Column("preferred_model", sa.String(length=100), nullable=True),
        sa.Column("preferred_temperature", sa.Float(), nullable=True),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index(
        "idx_user_llm_settings_user_id",
        "user_llm_settings",
        ["user_id"],
    )

    # Create custom_llm_provider table
    op.create_table(
        "custom_llm_provider",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        # Provider configuration
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column(
            "provider_type",
            sa.String(length=50),
            nullable=False,
            server_default="openai_compatible",
        ),
        sa.Column("base_url", sa.String(length=500), nullable=False),
        # Available models
        sa.Column(
            "available_models", sa.JSON(), nullable=False, server_default="[]"
        ),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organization.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["team_id"],
            ["team.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_custom_llm_provider_org_id",
        "custom_llm_provider",
        ["organization_id"],
    )
    op.create_index(
        "idx_custom_llm_provider_team_id",
        "custom_llm_provider",
        ["team_id"],
    )


def downgrade() -> None:
    # Drop custom_llm_provider table
    op.drop_index("idx_custom_llm_provider_team_id", table_name="custom_llm_provider")
    op.drop_index("idx_custom_llm_provider_org_id", table_name="custom_llm_provider")
    op.drop_table("custom_llm_provider")

    # Drop user_llm_settings table
    op.drop_index("idx_user_llm_settings_user_id", table_name="user_llm_settings")
    op.drop_table("user_llm_settings")

    # Drop team_llm_settings table
    op.drop_index("idx_team_llm_settings_team_id", table_name="team_llm_settings")
    op.drop_table("team_llm_settings")

    # Drop organization_llm_settings table
    op.drop_index(
        "idx_organization_llm_settings_org_id", table_name="organization_llm_settings"
    )
    op.drop_table("organization_llm_settings")
