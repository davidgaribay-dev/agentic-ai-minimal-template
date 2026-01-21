"""Add default_model_display_name to organization_llm_settings

Revision ID: u0v1w2x3y4z5
Revises: t9u0v1w2x3y4
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "u0v1w2x3y4z5"
down_revision: str | Sequence[str] | None = "t9u0v1w2x3y4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add default_model_display_name column to organization_llm_settings."""
    op.add_column(
        "organization_llm_settings",
        sa.Column(
            "default_model_display_name",
            sa.String(length=100),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove default_model_display_name column."""
    op.drop_column("organization_llm_settings", "default_model_display_name")
