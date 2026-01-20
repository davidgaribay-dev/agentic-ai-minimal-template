"""Migrate logo URLs from direct S3 to API proxy URLs."""

from sqlmodel import Session, select

from backend.auth.models import User
from backend.core.config import settings
from backend.core.db import engine
from backend.organizations.models import Organization
from backend.teams.models import Team


def migrate_urls() -> None:
    """Update all logo URLs to use the API proxy instead of direct S3."""
    old_prefix = f"{settings.s3_public_base_url}/{settings.S3_BUCKET_NAME}/"
    # Use localhost:8000 as the backend URL (works for both 127.0.0.1 and localhost)
    new_prefix = f"http://localhost:8000/v1/storage/{settings.S3_BUCKET_NAME}/"

    with Session(engine) as session:
        # Update organization logos
        orgs = session.exec(
            select(Organization).where(Organization.logo_url.like(f"{old_prefix}%"))  # type: ignore[attr-defined]
        ).all()
        for org in orgs:
            if org.logo_url:
                org.logo_url = org.logo_url.replace(old_prefix, new_prefix)
        print(f"Updated {len(orgs)} organization logos")  # noqa: T201

        # Update team logos
        teams = session.exec(
            select(Team).where(Team.logo_url.like(f"{old_prefix}%"))  # type: ignore[attr-defined]
        ).all()
        for team in teams:
            if team.logo_url:
                team.logo_url = team.logo_url.replace(old_prefix, new_prefix)
        print(f"Updated {len(teams)} team logos")  # noqa: T201

        # Update user profile images
        users = session.exec(
            select(User).where(User.profile_image_url.like(f"{old_prefix}%"))  # type: ignore[attr-defined]
        ).all()
        for user in users:
            if user.profile_image_url:
                user.profile_image_url = user.profile_image_url.replace(old_prefix, new_prefix)
        print(f"Updated {len(users)} user profile images")  # noqa: T201

        session.commit()

    print("Migration complete!")  # noqa: T201


if __name__ == "__main__":
    migrate_urls()
