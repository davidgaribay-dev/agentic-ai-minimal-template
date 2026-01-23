from enum import Enum
from typing import TYPE_CHECKING, ClassVar
import uuid

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel

from backend.core.base_models import (
    OptionalAuditedTable,
    OrgScopedMixin,
    PaginatedResponse,
    TimestampedTable,
    TimestampResponseMixin,
)

if TYPE_CHECKING:
    from backend.conversations.models import Conversation
    from backend.invitations.models import Invitation
    from backend.llm_settings.models import CustomLLMProvider, TeamLLMSettings
    from backend.organizations.models import (
        Organization,
        OrganizationMember,
    )
    from backend.rag_settings.models import TeamRAGSettings
    from backend.settings.models import TeamSettings
    from backend.theme_settings.models import TeamThemeSettings


class TeamRole(str, Enum):
    """Team-level roles with hierarchical permissions.

    ADMIN: Full control over team, can manage members and all team resources
    MEMBER: Can create and manage own resources, view team resources
    VIEWER: Read-only access to team resources
    """

    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


class TeamBase(SQLModel):
    name: str = Field(min_length=1, max_length=255, index=True)
    slug: str = Field(min_length=1, max_length=100, index=True)
    description: str | None = Field(default=None, max_length=1000)
    logo_url: str | None = Field(default=None, max_length=500)


class Team(TeamBase, OptionalAuditedTable, OrgScopedMixin, table=True):
    """Sub-group within an organization for resource isolation.
    Teams contain conversations, items, and other resources.
    """

    organization: "Organization" = Relationship(back_populates="teams")
    members: list["TeamMember"] = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    conversations: list["Conversation"] = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    invitations: list["Invitation"] = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )
    settings: "TeamSettings" = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    theme_settings: "TeamThemeSettings" = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    rag_settings: "TeamRAGSettings" = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    llm_settings: "TeamLLMSettings" = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "uselist": False},
    )
    custom_llm_providers: list["CustomLLMProvider"] = Relationship(
        back_populates="team",
        sa_relationship_kwargs={"cascade": "all, delete-orphan"},
    )


class TeamCreate(SQLModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)
    logo_url: str | None = Field(default=None, max_length=500)


class TeamUpdate(SQLModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=1000)


class TeamPublic(TeamBase, TimestampResponseMixin):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_by_id: uuid.UUID | None


# TeamsPublic is now PaginatedResponse[TeamPublic]
TeamsPublic = PaginatedResponse[TeamPublic]


class TeamWithMyRole(TeamPublic):
    """Team with the current user's role in that team."""

    my_role: "TeamRole"


TeamsWithMyRole = PaginatedResponse[TeamWithMyRole]


class TeamMemberBase(SQLModel):
    role: TeamRole = Field(default=TeamRole.MEMBER)


class TeamMember(TeamMemberBase, TimestampedTable, table=True):
    """Team membership database model.

    Links organization members to teams with a specific role.
    Requires the user to first be a member of the organization.
    """

    __tablename__ = "team_member"

    team_id: uuid.UUID = Field(
        foreign_key="team.id", nullable=False, ondelete="CASCADE"
    )
    org_member_id: uuid.UUID = Field(
        foreign_key="organization_member.id", nullable=False, ondelete="CASCADE"
    )

    team: Team = Relationship(back_populates="members")
    org_member: "OrganizationMember" = Relationship(back_populates="team_memberships")

    # Unique constraint: org member can only be member of team once
    __table_args__: ClassVar = (
        UniqueConstraint(
            "team_id", "org_member_id", name="uq_team_member_team_org_member"
        ),
    )


class TeamMemberCreate(SQLModel):
    org_member_id: uuid.UUID
    role: TeamRole = Field(default=TeamRole.MEMBER)


class TeamMemberUpdate(SQLModel):
    role: TeamRole | None = None


class TeamMemberPublic(TimestampResponseMixin):
    id: uuid.UUID
    team_id: uuid.UUID
    org_member_id: uuid.UUID
    role: TeamRole


class TeamMemberWithUser(TeamMemberPublic):
    user_id: uuid.UUID
    user_email: str
    user_full_name: str | None
    user_profile_image_url: str | None = None
    org_role: str


# TeamMembersPublic is now PaginatedResponse[TeamMemberWithUser]
TeamMembersPublic = PaginatedResponse[TeamMemberWithUser]


Team.model_rebuild()
TeamMember.model_rebuild()
