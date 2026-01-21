"""Factory functions for creating test domain objects.

These factories provide a clean API for creating test data with:
- Sensible defaults for all required fields
- Ability to override any field for specific test cases
- Proper relationship setup (user → org member → team member)

Usage:
    def test_something(db_session):
        user = create_test_user(db_session)
        org = create_test_organization(db_session, owner=user)
        team = create_test_team(db_session, org=org)
"""

from sqlmodel import Session

from backend.auth import User, UserCreate, create_user
from backend.organizations import Organization, OrganizationMember, OrgRole
from backend.teams import Team, TeamMember, TeamRole

from tests.constants import (
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_FULL_NAME,
    TEST_ADMIN_PASSWORD,
    TEST_ORG_NAME,
    TEST_ORG_SLUG,
    TEST_TEAM_NAME,
    TEST_TEAM_SLUG,
    TEST_USER_EMAIL,
    TEST_USER_FULL_NAME,
    TEST_USER_PASSWORD,
)


def create_test_user(
    session: Session,
    email: str = TEST_USER_EMAIL,
    password: str = TEST_USER_PASSWORD,
    full_name: str | None = TEST_USER_FULL_NAME,
    is_active: bool = True,
    is_platform_admin: bool = False,
) -> User:
    """Factory function to create test users with custom attributes.

    Args:
        session: Database session
        email: User email address
        password: Plain text password (will be hashed)
        full_name: User's full name
        is_active: Whether the user is active
        is_platform_admin: Whether the user is a platform admin

    Returns:
        Created User object persisted to the database
    """
    user_create = UserCreate(
        email=email,
        password=password,
        full_name=full_name,
        is_active=is_active,
        is_platform_admin=is_platform_admin,
    )
    return create_user(session=session, user_create=user_create)


def create_test_admin_user(
    session: Session,
    email: str = TEST_ADMIN_EMAIL,
    password: str = TEST_ADMIN_PASSWORD,
    full_name: str | None = TEST_ADMIN_FULL_NAME,
) -> User:
    """Factory function to create a platform admin user.

    Convenience wrapper around create_test_user with is_platform_admin=True.

    Args:
        session: Database session
        email: Admin email address
        password: Plain text password
        full_name: Admin's full name

    Returns:
        Created admin User object
    """
    return create_test_user(
        session=session,
        email=email,
        password=password,
        full_name=full_name,
        is_platform_admin=True,
    )


def create_test_organization(
    session: Session,
    name: str = TEST_ORG_NAME,
    slug: str = TEST_ORG_SLUG,
    owner: User | None = None,
) -> Organization:
    """Factory function to create a test organization.

    If owner is provided, also creates an OrganizationMember with owner role.

    Args:
        session: Database session
        name: Organization name
        slug: URL-friendly slug
        owner: Optional user to set as organization owner

    Returns:
        Created Organization object
    """
    org = Organization(name=name, slug=slug)
    session.add(org)
    session.commit()
    session.refresh(org)

    if owner:
        org_member = OrganizationMember(
            organization_id=org.id,
            user_id=owner.id,
            role=OrgRole.OWNER,
        )
        session.add(org_member)
        session.commit()

    return org


def create_test_team(
    session: Session,
    org: Organization,
    name: str = TEST_TEAM_NAME,
    slug: str = TEST_TEAM_SLUG,
    members: list[tuple[User, TeamRole]] | None = None,
) -> Team:
    """Factory function to create a test team within an organization.

    Args:
        session: Database session
        org: Parent organization
        name: Team name
        slug: URL-friendly slug
        members: Optional list of (user, role) tuples to add as team members.
                 Users must already be organization members.

    Returns:
        Created Team object
    """
    team = Team(
        organization_id=org.id,
        name=name,
        slug=slug,
    )
    session.add(team)
    session.commit()
    session.refresh(team)

    if members:
        for user, role in members:
            # Get the org membership for this user
            org_member = session.query(OrganizationMember).filter(
                OrganizationMember.organization_id == org.id,  # noqa: E711
                OrganizationMember.user_id == user.id,  # noqa: E711
            ).first()

            if org_member:
                team_member = TeamMember(
                    team_id=team.id,
                    org_member_id=org_member.id,
                    role=role,
                )
                session.add(team_member)

        session.commit()

    return team


def create_test_org_member(
    session: Session,
    org: Organization,
    user: User,
    role: OrgRole = OrgRole.MEMBER,
) -> OrganizationMember:
    """Factory function to add a user as an organization member.

    Args:
        session: Database session
        org: Target organization
        user: User to add
        role: Member role (owner, admin, member)

    Returns:
        Created OrganizationMember object
    """
    org_member = OrganizationMember(
        organization_id=org.id,
        user_id=user.id,
        role=role,
    )
    session.add(org_member)
    session.commit()
    session.refresh(org_member)
    return org_member


def create_test_team_member(
    session: Session,
    team: Team,
    org_member: OrganizationMember,
    role: TeamRole = TeamRole.MEMBER,
) -> TeamMember:
    """Factory function to add an org member to a team.

    Args:
        session: Database session
        team: Target team
        org_member: Organization member to add (must be from same org)
        role: Team role (admin, member, viewer)

    Returns:
        Created TeamMember object
    """
    team_member = TeamMember(
        team_id=team.id,
        org_member_id=org_member.id,
        role=role,
    )
    session.add(team_member)
    session.commit()
    session.refresh(team_member)
    return team_member
