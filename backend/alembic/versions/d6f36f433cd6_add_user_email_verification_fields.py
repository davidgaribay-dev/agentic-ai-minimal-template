"""add_user_email_verification_fields

Revision ID: d6f36f433cd6
Revises: 0ebb995494ae

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel

# revision identifiers, used by Alembic.
revision: str = 'd6f36f433cd6'
down_revision: Union[str, Sequence[str], None] = '0ebb995494ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add email verification fields to user table."""
    op.add_column('user', sa.Column('email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('user', sa.Column('email_verification_code', sqlmodel.sql.sqltypes.AutoString(length=6), nullable=True))
    op.add_column('user', sa.Column('email_verification_code_expires_at', sa.DateTime(), nullable=True))
    op.add_column('user', sa.Column('email_verification_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove email verification fields from user table."""
    op.drop_column('user', 'email_verification_sent_at')
    op.drop_column('user', 'email_verification_code_expires_at')
    op.drop_column('user', 'email_verification_code')
    op.drop_column('user', 'email_verified')
