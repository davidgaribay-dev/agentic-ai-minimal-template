from enum import Enum
from typing import TYPE_CHECKING, Any
import uuid

from sqlalchemy import JSON, Index, UniqueConstraint
from sqlmodel import Column, Field, Relationship, SQLModel

from backend.core.base_models import (
    PaginatedResponse,
    TimestampedTable,
    TimestampResponseMixin,
)

if TYPE_CHECKING:
    from backend.auth.models import User
    from backend.invitations.models import Invitation
    from backend.llm_settings.models import CustomLLMProvider, OrganizationLLMSettings
    from backend.rag_settings.models import OrganizationRAGSettings
    from backend.settings.models import OrganizationSettings
    from backend.teams.models import Team, TeamMember
    from backend.theme_settings.models import OrganizationThemeSettings


class OrgRole(str, Enum):
    """Organization-level roles with hierarchical permissions.

    OWNER: Full control, can delete org, transfer ownership, manage billing
    ADMIN: Can manage members, teams, settings (but not delete org or transfer ownership)
    MEMBER: Basic access, can view org resources and participate in teams
    """

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


class OrganizationBase(SQLModel):
    """Base organization schema with common fields."""

    name: str = Field(min_length=1, max_length=255, index=True)
    slug: str = Field(min_length=1, max_length=100, unique=True, index=True)
    description: str | None = Field(default=None, max_length=1000)
    logo_url: str | None = Field(default=None, max_length=500)


class Organization(OrganizationBase, TimestampedTable, table=True):
    """Organization database model.

    Top-level tenant container that groups users and resources.
    Organizations contain teams, and all resources are scoped to org/team.
    """

    members: list["OrganizationMember"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    teams: list["Team"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    invitations: list["Invitation"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    settings: "OrganizationSettings" = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    theme_settings: "OrganizationThemeSettings" = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    rag_settings: "OrganizationRAGSettings" = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    llm_settings: "OrganizationLLMSettings" = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    custom_llm_providers: list["CustomLLMProvider"] = Relationship(
        back_populates="organization",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class OrganizationCreate(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    logo_url: str | None = Field(default=None, max_length=500)


class OrganizationUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class OrganizationPublic(OrganizationBase, TimestampResponseMixin):
    id: uuid.UUID


# OrganizationsPublic is now PaginatedResponse[OrganizationPublic]
OrganizationsPublic = PaginatedResponse[OrganizationPublic]


class SidebarItemVisibility(str, Enum):
    """Visibility options for sidebar items."""

    ALWAYS_SHOW = "always_show"
    WHEN_BADGED = "when_badged"
    HIDE_IN_MORE = "hide_in_more"


class SidebarPreferences(SQLModel):
    """User's sidebar customization preferences."""

    # Personal section items with visibility and order
    personal_items: dict[str, str] = Field(
        default_factory=lambda: {
            "inbox": "always_show",
            "drafts": "when_badged",
        }
    )
    personal_order: list[str] = Field(default_factory=lambda: ["inbox", "drafts"])

    # Workspace section items with visibility and order
    workspace_items: dict[str, str] = Field(default_factory=dict)
    workspace_order: list[str] = Field(default_factory=list)

    # Default badge style: "count" or "dot"
    default_badge_style: str = Field(default="count")


class OrganizationMemberBase(SQLModel):
    role: OrgRole = Field(default=OrgRole.MEMBER)
    team_order: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    sidebar_preferences: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON)
    )


class OrganizationMember(OrganizationMemberBase, TimestampedTable, table=True):
    """Organization membership database model.

    Links users to organizations with a specific role.
    This is the primary way users gain access to organization resources.
    """

    __tablename__ = "organization_member"
    __table_args__ = (
        # Unique constraint: user can only be member of org once
        UniqueConstraint("organization_id", "user_id", name="uq_org_member_org_user"),
        # Index for querying members by org and role (e.g., find all admins)
        Index("ix_org_member_org_role", "organization_id", "role"),
        # Index for finding all orgs a user belongs to
        Index("ix_org_member_user", "user_id"),
    )

    organization_id: uuid.UUID = Field(
        foreign_key="organization.id", nullable=False, ondelete="CASCADE"
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )

    organization: Organization = Relationship(back_populates="members")
    user: "User" = Relationship(back_populates="organization_memberships")

    team_memberships: list["TeamMember"] = Relationship(
        back_populates="org_member",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class OrganizationMemberCreate(SQLModel):
    user_id: uuid.UUID
    role: OrgRole = Field(default=OrgRole.MEMBER)


class OrganizationMemberUpdate(SQLModel):
    role: OrgRole | None = None


class TeamOrderUpdate(SQLModel):
    """Schema for updating user's team order preference."""

    team_order: list[str] = Field(description="Ordered list of team IDs")


class SidebarPreferencesUpdate(SQLModel):
    """Schema for updating user's sidebar preferences."""

    personal_items: dict[str, str] | None = Field(
        default=None, description="Personal section visibility settings"
    )
    personal_order: list[str] | None = Field(
        default=None, description="Personal section item order"
    )
    workspace_items: dict[str, str] | None = Field(
        default=None, description="Workspace section visibility settings"
    )
    workspace_order: list[str] | None = Field(
        default=None, description="Workspace section item order"
    )
    default_badge_style: str | None = Field(
        default=None, description="Badge style: 'count' or 'dot'"
    )


class OrganizationMemberPublic(TimestampResponseMixin):
    id: uuid.UUID
    organization_id: uuid.UUID
    user_id: uuid.UUID
    role: OrgRole
    team_order: list[str] = Field(default_factory=list)
    sidebar_preferences: dict[str, Any] | None = Field(default=None)


class OrganizationMemberWithUser(OrganizationMemberPublic):
    user_email: str
    user_full_name: str | None
    user_profile_image_url: str | None = None


# OrganizationMembersPublic is now PaginatedResponse[OrganizationMemberWithUser]
OrganizationMembersPublic = PaginatedResponse[OrganizationMemberWithUser]


Organization.model_rebuild()
OrganizationMember.model_rebuild()
