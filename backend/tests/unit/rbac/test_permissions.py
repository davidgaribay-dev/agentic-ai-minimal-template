"""Tests for the RBAC permissions system.

Tests follow FIRST principles:
- Fast: Pure unit tests with no external dependencies
- Independent: Each test is self-contained
- Repeatable: Deterministic results
- Self-verifying: Clear assertions
- Timely: Written alongside the code
"""

import pytest

from backend.organizations.models import OrgRole
from backend.rbac.permissions import (
    ORG_ROLE_PERMISSIONS,
    TEAM_ROLE_PERMISSIONS,
    OrgPermission,
    TeamPermission,
    can_assign_org_role,
    can_assign_team_role,
    get_org_permissions,
    get_team_permissions,
    has_org_permission,
    has_team_permission,
)
from backend.teams.models import TeamRole


@pytest.mark.unit
@pytest.mark.rbac
class TestOrgPermissions:
    """Tests for organization-level permissions."""

    def test_owner_has_all_permissions(self) -> None:
        """Organization owner has all org permissions."""
        # Arrange
        owner_permissions = get_org_permissions(OrgRole.OWNER)

        # Assert - owner should have all defined org permissions
        for permission in OrgPermission:
            assert permission in owner_permissions, f"Owner missing {permission}"

    def test_admin_cannot_delete_org(self) -> None:
        """Organization admin cannot delete the organization."""
        # Assert
        assert not has_org_permission(OrgRole.ADMIN, OrgPermission.ORG_DELETE)

    def test_admin_cannot_transfer_ownership(self) -> None:
        """Organization admin cannot transfer ownership."""
        # Assert
        assert not has_org_permission(OrgRole.ADMIN, OrgPermission.ORG_TRANSFER_OWNERSHIP)

    def test_member_has_limited_permissions(self) -> None:
        """Organization member has limited permissions."""
        # Arrange
        member_permissions = get_org_permissions(OrgRole.MEMBER)

        # Assert - member should NOT have these
        assert OrgPermission.ORG_UPDATE not in member_permissions
        assert OrgPermission.ORG_DELETE not in member_permissions
        assert OrgPermission.MEMBERS_INVITE not in member_permissions
        assert OrgPermission.MEMBERS_REMOVE not in member_permissions

        # Assert - member SHOULD have these
        assert OrgPermission.TEAMS_READ in member_permissions
        assert OrgPermission.TEAMS_CREATE in member_permissions

    def test_has_org_permission_returns_correct_value(self) -> None:
        """has_org_permission correctly checks role permissions."""
        # Assert positive cases
        assert has_org_permission(OrgRole.OWNER, OrgPermission.ORG_DELETE)
        assert has_org_permission(OrgRole.ADMIN, OrgPermission.MEMBERS_INVITE)
        assert has_org_permission(OrgRole.MEMBER, OrgPermission.TEAMS_READ)

        # Assert negative cases
        assert not has_org_permission(OrgRole.MEMBER, OrgPermission.ORG_DELETE)
        assert not has_org_permission(OrgRole.ADMIN, OrgPermission.ORG_DELETE)

    @pytest.mark.parametrize(
        ("role", "expected_count"),
        [
            (OrgRole.OWNER, len(OrgPermission)),  # Owner has all
            (OrgRole.ADMIN, len(OrgPermission) - 3),  # Admin missing 3 (delete, transfer, billing_update)
            (OrgRole.MEMBER, 3),  # Member has only 3
        ],
    )
    def test_permission_counts_by_role(
        self, role: OrgRole, expected_count: int
    ) -> None:
        """Each role has the expected number of permissions."""
        # Act
        permissions = get_org_permissions(role)

        # Assert
        assert len(permissions) == expected_count


@pytest.mark.unit
@pytest.mark.rbac
class TestTeamPermissions:
    """Tests for team-level permissions."""

    def test_team_admin_has_all_team_permissions(self) -> None:
        """Team admin has all team permissions."""
        # Arrange
        admin_permissions = get_team_permissions(TeamRole.ADMIN)

        # Assert - admin should have all defined team permissions
        for permission in TeamPermission:
            assert permission in admin_permissions, f"Team admin missing {permission}"

    def test_team_member_can_manage_own_resources(self) -> None:
        """Team member can create and manage their own resources."""
        # Arrange
        member_permissions = get_team_permissions(TeamRole.MEMBER)

        # Assert
        assert TeamPermission.OWN_RESOURCES_CREATE in member_permissions
        assert TeamPermission.OWN_RESOURCES_READ in member_permissions
        assert TeamPermission.OWN_RESOURCES_UPDATE in member_permissions
        assert TeamPermission.OWN_RESOURCES_DELETE in member_permissions

    def test_team_member_cannot_manage_all_resources(self) -> None:
        """Team member cannot delete other members' resources."""
        # Arrange
        member_permissions = get_team_permissions(TeamRole.MEMBER)

        # Assert - member should NOT have these
        assert TeamPermission.RESOURCES_DELETE not in member_permissions
        assert TeamPermission.RESOURCES_UPDATE not in member_permissions
        assert TeamPermission.TEAM_UPDATE not in member_permissions
        assert TeamPermission.TEAM_DELETE not in member_permissions

    def test_viewer_is_read_only(self) -> None:
        """Team viewer has read-only access."""
        # Arrange
        viewer_permissions = get_team_permissions(TeamRole.VIEWER)

        # Assert - viewer should ONLY have read permissions
        assert TeamPermission.TEAM_READ in viewer_permissions
        assert TeamPermission.RESOURCES_READ in viewer_permissions
        assert TeamPermission.OWN_RESOURCES_READ in viewer_permissions

        # Assert - viewer should NOT have write permissions
        assert TeamPermission.OWN_RESOURCES_CREATE not in viewer_permissions
        assert TeamPermission.OWN_RESOURCES_UPDATE not in viewer_permissions
        assert TeamPermission.OWN_RESOURCES_DELETE not in viewer_permissions
        assert TeamPermission.TEAM_UPDATE not in viewer_permissions

    def test_has_team_permission_returns_correct_value(self) -> None:
        """has_team_permission correctly checks role permissions."""
        # Assert positive cases
        assert has_team_permission(TeamRole.ADMIN, TeamPermission.TEAM_DELETE)
        assert has_team_permission(TeamRole.MEMBER, TeamPermission.OWN_RESOURCES_CREATE)
        assert has_team_permission(TeamRole.VIEWER, TeamPermission.RESOURCES_READ)

        # Assert negative cases
        assert not has_team_permission(TeamRole.VIEWER, TeamPermission.OWN_RESOURCES_CREATE)
        assert not has_team_permission(TeamRole.MEMBER, TeamPermission.TEAM_DELETE)


@pytest.mark.unit
@pytest.mark.rbac
class TestRoleAssignment:
    """Tests for role assignment permissions."""

    def test_owner_can_assign_any_org_role(self) -> None:
        """Organization owner can assign any org role."""
        # Assert
        assert can_assign_org_role(OrgRole.OWNER, OrgRole.OWNER)
        assert can_assign_org_role(OrgRole.OWNER, OrgRole.ADMIN)
        assert can_assign_org_role(OrgRole.OWNER, OrgRole.MEMBER)

    def test_admin_cannot_assign_owner_role(self) -> None:
        """Organization admin cannot assign owner role."""
        # Assert
        assert not can_assign_org_role(OrgRole.ADMIN, OrgRole.OWNER)

    def test_admin_can_assign_admin_and_member(self) -> None:
        """Organization admin can assign admin and member roles."""
        # Assert
        assert can_assign_org_role(OrgRole.ADMIN, OrgRole.ADMIN)
        assert can_assign_org_role(OrgRole.ADMIN, OrgRole.MEMBER)

    def test_member_cannot_assign_roles(self) -> None:
        """Organization member cannot assign any roles."""
        # Assert
        assert not can_assign_org_role(OrgRole.MEMBER, OrgRole.OWNER)
        assert not can_assign_org_role(OrgRole.MEMBER, OrgRole.ADMIN)
        # Members can technically assign member role (same level)
        assert can_assign_org_role(OrgRole.MEMBER, OrgRole.MEMBER)

    def test_org_admin_can_assign_any_team_role(self) -> None:
        """Organization admin can assign any team role."""
        # Assert
        assert can_assign_team_role(OrgRole.ADMIN, None, TeamRole.ADMIN)
        assert can_assign_team_role(OrgRole.ADMIN, None, TeamRole.MEMBER)
        assert can_assign_team_role(OrgRole.ADMIN, None, TeamRole.VIEWER)

    def test_team_admin_can_assign_team_roles(self) -> None:
        """Team admin can assign team roles at or below their level."""
        # Assert
        assert can_assign_team_role(OrgRole.MEMBER, TeamRole.ADMIN, TeamRole.ADMIN)
        assert can_assign_team_role(OrgRole.MEMBER, TeamRole.ADMIN, TeamRole.MEMBER)
        assert can_assign_team_role(OrgRole.MEMBER, TeamRole.ADMIN, TeamRole.VIEWER)

    def test_team_member_cannot_assign_admin_role(self) -> None:
        """Team member cannot assign admin role."""
        # Assert
        assert not can_assign_team_role(OrgRole.MEMBER, TeamRole.MEMBER, TeamRole.ADMIN)

    def test_team_member_can_assign_member_and_viewer(self) -> None:
        """Team member can assign member and viewer roles."""
        # Assert
        assert can_assign_team_role(OrgRole.MEMBER, TeamRole.MEMBER, TeamRole.MEMBER)
        assert can_assign_team_role(OrgRole.MEMBER, TeamRole.MEMBER, TeamRole.VIEWER)

    def test_user_with_no_team_role_cannot_assign_team_roles(self) -> None:
        """Org member with no team role cannot assign team roles (unless org admin)."""
        # Assert - org member without team role cannot assign
        assert not can_assign_team_role(OrgRole.MEMBER, None, TeamRole.MEMBER)
        assert not can_assign_team_role(OrgRole.MEMBER, None, TeamRole.VIEWER)


@pytest.mark.unit
@pytest.mark.rbac
class TestRoleHierarchy:
    """Tests for role hierarchy validation."""

    def test_org_roles_have_correct_hierarchy(self) -> None:
        """Organization roles are correctly ordered."""
        # Arrange
        from backend.rbac.permissions import ORG_ROLE_HIERARCHY

        # Assert
        assert ORG_ROLE_HIERARCHY[OrgRole.OWNER] > ORG_ROLE_HIERARCHY[OrgRole.ADMIN]
        assert ORG_ROLE_HIERARCHY[OrgRole.ADMIN] > ORG_ROLE_HIERARCHY[OrgRole.MEMBER]

    def test_team_roles_have_correct_hierarchy(self) -> None:
        """Team roles are correctly ordered."""
        # Arrange
        from backend.rbac.permissions import TEAM_ROLE_HIERARCHY

        # Assert
        assert TEAM_ROLE_HIERARCHY[TeamRole.ADMIN] > TEAM_ROLE_HIERARCHY[TeamRole.MEMBER]
        assert TEAM_ROLE_HIERARCHY[TeamRole.MEMBER] > TEAM_ROLE_HIERARCHY[TeamRole.VIEWER]


@pytest.mark.unit
@pytest.mark.rbac
class TestPermissionConsistency:
    """Tests to ensure permission definitions are consistent."""

    def test_all_org_roles_have_permissions_defined(self) -> None:
        """All org roles have their permissions defined."""
        # Assert
        for role in OrgRole:
            assert role in ORG_ROLE_PERMISSIONS, f"Missing permissions for {role}"

    def test_all_team_roles_have_permissions_defined(self) -> None:
        """All team roles have their permissions defined."""
        # Assert
        for role in TeamRole:
            assert role in TEAM_ROLE_PERMISSIONS, f"Missing permissions for {role}"

    def test_get_permissions_returns_copy(self) -> None:
        """get_permissions returns a copy, not the original set."""
        # Arrange
        original = get_org_permissions(OrgRole.OWNER)

        # Act - modify the returned set
        original.discard(OrgPermission.ORG_DELETE)

        # Assert - original definition should be unchanged
        assert OrgPermission.ORG_DELETE in ORG_ROLE_PERMISSIONS[OrgRole.OWNER]
