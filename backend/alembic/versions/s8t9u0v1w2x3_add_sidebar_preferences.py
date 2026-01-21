"""Add sidebar_preferences to organization_member

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2

Adds sidebar_preferences JSON column to organization_member table.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "s8t9u0v1w2x3"
down_revision: Union[str, None] = "r7s8t9u0v1w2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organization_member",
        sa.Column("sidebar_preferences", JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organization_member", "sidebar_preferences")
