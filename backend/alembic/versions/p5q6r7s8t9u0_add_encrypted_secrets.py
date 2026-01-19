"""add_encrypted_secrets

Revision ID: p5q6r7s8t9u0
Revises: bec5ec068ea5

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "p5q6r7s8t9u0"
down_revision: str | Sequence[str] | None = "bec5ec068ea5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create encrypted_secrets table for storing encrypted API keys and secrets."""
    op.create_table(
        "encrypted_secrets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("path", sa.String(), nullable=False),
        sa.Column("encrypted_value", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("path"),
    )
    op.create_index(
        op.f("ix_encrypted_secrets_path"), "encrypted_secrets", ["path"], unique=True
    )


def downgrade() -> None:
    """Drop encrypted_secrets table."""
    op.drop_index(op.f("ix_encrypted_secrets_path"), table_name="encrypted_secrets")
    op.drop_table("encrypted_secrets")
