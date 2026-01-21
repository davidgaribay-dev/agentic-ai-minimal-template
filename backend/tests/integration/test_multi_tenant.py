"""Tests for multi-tenant data isolation.

These tests verify that the multi-tenant architecture properly
isolates data between organizations and teams.

Tests follow FIRST principles:
- Fast: Uses test database with transaction rollback
- Independent: Each test has isolated database state
- Repeatable: Deterministic results
- Self-verifying: Clear assertions
- Timely: Written alongside the code

NOTE: These tests require PostgreSQL due to JSONB columns in audit_logs.
They are skipped when running with SQLite (default test database).
Run with a PostgreSQL test database for full integration testing.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

# Skip all tests in this module - requires PostgreSQL (JSONB columns in audit_logs)
pytestmark = pytest.mark.skip(
    reason="Integration tests require PostgreSQL (SQLite doesn't support JSONB)"
)

from backend.organizations.models import OrgRole
from backend.teams.models import TeamRole

from tests.conftest import (
    create_test_org_member,
    create_test_organization,
    create_test_team,
    create_test_team_member,
    create_test_user,
)
from tests.constants import (
    HTTP_FORBIDDEN,
    HTTP_NOT_FOUND,
    HTTP_OK,
    TEST_USER_PASSWORD,
)


def get_auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    """Get authentication headers by logging in a user."""
    response = client.post(
        "/v1/auth/login",
        data={"username": email, "password": password},
    )
    if response.status_code != 200:
        raise ValueError(f"Login failed: {response.text}")
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
class TestOrganizationIsolation:
    """Tests for organization-level data isolation."""

    def test_user_can_access_own_organization(
        self, client: TestClient, db_session: Session
    ) -> None:
        """User can access their own organization."""
        # Arrange
        user = create_test_user(db_session, email="user1@example.com", password=TEST_USER_PASSWORD)
        org = create_test_organization(db_session, name="User's Org", slug="users-org", owner=user)

        headers = get_auth_headers(client, "user1@example.com", TEST_USER_PASSWORD)

        # Act
        response = client.get(f"/v1/organizations/{org.id}", headers=headers)

        # Assert
        assert response.status_code == HTTP_OK
        assert response.json()["name"] == "User's Org"

    def test_user_cannot_access_other_organization(
        self, client: TestClient, db_session: Session
    ) -> None:
        """User cannot access an organization they're not a member of."""
        # Arrange - create two users with separate orgs
        user1 = create_test_user(db_session, email="user1@example.com", password=TEST_USER_PASSWORD)
        user2 = create_test_user(db_session, email="user2@example.com", password=TEST_USER_PASSWORD)

        create_test_organization(db_session, name="User1 Org", slug="user1-org", owner=user1)
        org2 = create_test_organization(db_session, name="User2 Org", slug="user2-org", owner=user2)

        headers = get_auth_headers(client, "user1@example.com", TEST_USER_PASSWORD)

        # Act - user1 tries to access user2's org
        response = client.get(f"/v1/organizations/{org2.id}", headers=headers)

        # Assert - should be forbidden
        assert response.status_code == HTTP_FORBIDDEN

    def test_user_can_list_only_own_organizations(
        self, client: TestClient, db_session: Session
    ) -> None:
        """User only sees organizations they belong to."""
        # Arrange
        user1 = create_test_user(db_session, email="user1@example.com", password=TEST_USER_PASSWORD)
        user2 = create_test_user(db_session, email="user2@example.com", password=TEST_USER_PASSWORD)

        org1 = create_test_organization(db_session, name="User1 Org", slug="user1-org", owner=user1)
        create_test_organization(db_session, name="User2 Org", slug="user2-org", owner=user2)

        headers = get_auth_headers(client, "user1@example.com", TEST_USER_PASSWORD)

        # Act
        response = client.get("/v1/organizations/me", headers=headers)

        # Assert
        assert response.status_code == HTTP_OK
        orgs = response.json()
        assert len(orgs) == 1
        assert orgs[0]["id"] == str(org1.id)


@pytest.mark.integration
class TestTeamIsolation:
    """Tests for team-level data isolation within an organization."""

    def test_team_member_can_access_team(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Team member can access their team."""
        # Arrange
        owner = create_test_user(db_session, email="owner@example.com", password=TEST_USER_PASSWORD)
        member = create_test_user(db_session, email="member@example.com", password=TEST_USER_PASSWORD)

        org = create_test_organization(db_session, name="Test Org", slug="test-org", owner=owner)
        team = create_test_team(db_session, org=org, name="Test Team", slug="test-team")

        # Add member to org and team
        org_member = create_test_org_member(db_session, org=org, user=member, role=OrgRole.member)
        create_test_team_member(db_session, team=team, org_member=org_member, role=TeamRole.member)

        headers = get_auth_headers(client, "member@example.com", TEST_USER_PASSWORD)

        # Act
        response = client.get(
            f"/v1/organizations/{org.id}/teams/{team.id}",
            headers=headers,
        )

        # Assert
        assert response.status_code == HTTP_OK
        assert response.json()["name"] == "Test Team"

    def test_non_team_member_cannot_access_team_details(
        self, client: TestClient, db_session: Session
    ) -> None:
        """User not in team cannot access team details (beyond basic info)."""
        # Arrange
        owner = create_test_user(db_session, email="owner@example.com", password=TEST_USER_PASSWORD)
        other_user = create_test_user(db_session, email="other@example.com", password=TEST_USER_PASSWORD)

        org = create_test_organization(db_session, name="Test Org", slug="test-org", owner=owner)
        team = create_test_team(db_session, org=org, name="Private Team", slug="private-team")

        # Add other_user to org but NOT to team
        create_test_org_member(db_session, org=org, user=other_user, role=OrgRole.member)

        headers = get_auth_headers(client, "other@example.com", TEST_USER_PASSWORD)

        # Act - try to list team members (requires team membership)
        response = client.get(
            f"/v1/organizations/{org.id}/teams/{team.id}/members",
            headers=headers,
        )

        # Assert - should be forbidden
        assert response.status_code == HTTP_FORBIDDEN


@pytest.mark.integration
class TestCrossOrganizationProtection:
    """Tests for cross-organization attack protection."""

    def test_cannot_add_member_from_other_org_to_team(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Cannot add a user from another organization to a team."""
        # Arrange
        owner1 = create_test_user(db_session, email="owner1@example.com", password=TEST_USER_PASSWORD)
        owner2 = create_test_user(db_session, email="owner2@example.com", password=TEST_USER_PASSWORD)

        org1 = create_test_organization(db_session, name="Org1", slug="org1", owner=owner1)
        org2 = create_test_organization(db_session, name="Org2", slug="org2", owner=owner2)

        team1 = create_test_team(db_session, org=org1, name="Team1", slug="team1")

        # Get owner1's headers (owner of org1)
        headers = get_auth_headers(client, "owner1@example.com", TEST_USER_PASSWORD)

        # Act - try to add owner2 (from org2) to team1
        response = client.post(
            f"/v1/organizations/{org1.id}/teams/{team1.id}/members",
            headers=headers,
            json={"user_id": str(owner2.id), "role": "member"},
        )

        # Assert - should fail (user not in org)
        assert response.status_code in (HTTP_FORBIDDEN, HTTP_NOT_FOUND, 400, 422)


@pytest.mark.integration
class TestRoleBasedAccess:
    """Tests for role-based access control enforcement."""

    def test_member_cannot_delete_organization(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Organization member cannot delete the organization."""
        # Arrange
        owner = create_test_user(db_session, email="owner@example.com", password=TEST_USER_PASSWORD)
        member = create_test_user(db_session, email="member@example.com", password=TEST_USER_PASSWORD)

        org = create_test_organization(db_session, name="Test Org", slug="test-org", owner=owner)
        create_test_org_member(db_session, org=org, user=member, role=OrgRole.member)

        headers = get_auth_headers(client, "member@example.com", TEST_USER_PASSWORD)

        # Act
        response = client.delete(f"/v1/organizations/{org.id}", headers=headers)

        # Assert
        assert response.status_code == HTTP_FORBIDDEN

    def test_viewer_cannot_create_resources(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Team viewer cannot create resources."""
        # Arrange
        owner = create_test_user(db_session, email="owner@example.com", password=TEST_USER_PASSWORD)
        viewer = create_test_user(db_session, email="viewer@example.com", password=TEST_USER_PASSWORD)

        org = create_test_organization(db_session, name="Test Org", slug="test-org", owner=owner)
        team = create_test_team(db_session, org=org, name="Test Team", slug="test-team")

        org_member = create_test_org_member(db_session, org=org, user=viewer, role=OrgRole.member)
        create_test_team_member(db_session, team=team, org_member=org_member, role=TeamRole.viewer)

        headers = get_auth_headers(client, "viewer@example.com", TEST_USER_PASSWORD)

        # Act - try to create a conversation
        response = client.post(
            f"/v1/conversations",
            headers=headers,
            json={"team_id": str(team.id), "title": "Test Conversation"},
        )

        # Assert - should be forbidden for viewer
        assert response.status_code == HTTP_FORBIDDEN
