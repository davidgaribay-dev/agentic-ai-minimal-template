"""Migrate logo URLs from direct S3 to API proxy URLs using SQL."""

from sqlalchemy import text

from backend.core.config import settings
from backend.core.db import engine


def migrate_urls() -> None:
    """Update all logo URLs to use the API proxy instead of direct S3."""
    old_prefix = f"{settings.s3_public_base_url}/{settings.S3_BUCKET_NAME}/"
    new_prefix = "http://localhost:8000/v1/storage/{}/".format(settings.S3_BUCKET_NAME)

    with engine.begin() as conn:
        # Update organization logos
        result = conn.execute(
            text(
                f"UPDATE organization SET logo_url = REPLACE(logo_url, '{old_prefix}', '{new_prefix}') "
                f"WHERE logo_url LIKE '{old_prefix}%'"
            )
        )
        print(f"Updated {result.rowcount} organization logos")  # noqa: T201

        # Update team logos
        result = conn.execute(
            text(
                f"UPDATE team SET logo_url = REPLACE(logo_url, '{old_prefix}', '{new_prefix}') "
                f"WHERE logo_url LIKE '{old_prefix}%'"
            )
        )
        print(f"Updated {result.rowcount} team logos")  # noqa: T201

        # Update user profile images
        result = conn.execute(
            text(
                f'UPDATE "user" SET profile_image_url = REPLACE(profile_image_url, \'{old_prefix}\', \'{new_prefix}\') '
                f"WHERE profile_image_url LIKE '{old_prefix}%'"
            )
        )
        print(f"Updated {result.rowcount} user profile images")  # noqa: T201

    print("Migration complete!")  # noqa: T201


if __name__ == "__main__":
    migrate_urls()
