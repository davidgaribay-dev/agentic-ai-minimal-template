"""Add team_order to organization_member

Revision ID: r7s8t9u0v1w2
Revises: 62220b7424b4

Adds team_order JSON column to organization_member table to store user's preferred team ordering.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "r7s8t9u0v1w2"
down_revision: Union[str, None] = "62220b7424b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organization_member",
        sa.Column("team_order", JSON(), nullable=True, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("organization_member", "team_order")
