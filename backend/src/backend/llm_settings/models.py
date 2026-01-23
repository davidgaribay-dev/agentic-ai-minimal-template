"""LLM settings models for hierarchical configuration (org/team/user).

Follows the rag_settings pattern for consistent hierarchical settings management.
Supports built-in providers (Anthropic, OpenAI, Google) and custom OpenAI-compatible endpoints.
"""

from enum import Enum
from typing import TYPE_CHECKING, Any, Optional
import uuid

from sqlalchemy.dialects.postgresql import JSON
from sqlmodel import Field, Relationship, SQLModel

from backend.core.base_models import TimestampedTable, TimestampResponseMixin

if TYPE_CHECKING:
    from backend.auth.models import User
    from backend.organizations.models import Organization
    from backend.teams.models import Team


class LLMProvider(str, Enum):
    """Supported LLM providers."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    CUSTOM = "custom"


class ModelCapability(str, Enum):
    """Model capability flags for filtering and validation."""

    TOOL_CALLING = "tool_calling"
    VISION = "vision"
    STREAMING = "streaming"
    STRUCTURED_OUTPUT = "structured_output"
    REASONING = "reasoning"
    LONG_CONTEXT = "long_context"
    DOCUMENT = "document"


# Built-in model catalog (code constant, not DB)
# This provides a default list of models per provider
BUILT_IN_MODELS: dict[str, list[dict[str, Any]]] = {
    "anthropic": [
        {
            "id": "claude-sonnet-4-20250514",
            "name": "Claude Sonnet 4",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.STRUCTURED_OUTPUT,
                ModelCapability.DOCUMENT,
            ],
            "max_context_tokens": 200000,
            "max_output_tokens": 64000,
        },
        {
            "id": "claude-haiku-4-5-20251001",
            "name": "Claude Haiku 4.5",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            "max_context_tokens": 200000,
            "max_output_tokens": 8192,
        },
        {
            "id": "claude-opus-4-20250514",
            "name": "Claude Opus 4",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.STRUCTURED_OUTPUT,
                ModelCapability.REASONING,
                ModelCapability.LONG_CONTEXT,
                ModelCapability.DOCUMENT,
            ],
            "max_context_tokens": 200000,
            "max_output_tokens": 32000,
        },
    ],
    "openai": [
        {
            "id": "gpt-4o",
            "name": "GPT-4o",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            "max_context_tokens": 128000,
            "max_output_tokens": 16384,
        },
        {
            "id": "gpt-4o-mini",
            "name": "GPT-4o Mini",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.STRUCTURED_OUTPUT,
            ],
            "max_context_tokens": 128000,
            "max_output_tokens": 16384,
        },
        {
            "id": "o3-mini",
            "name": "O3 Mini",
            "capabilities": [
                ModelCapability.STREAMING,
                ModelCapability.REASONING,
            ],
            "max_context_tokens": 200000,
            "max_output_tokens": 100000,
        },
        {
            "id": "o1",
            "name": "O1",
            "capabilities": [
                ModelCapability.STREAMING,
                ModelCapability.REASONING,
                ModelCapability.VISION,
            ],
            "max_context_tokens": 200000,
            "max_output_tokens": 100000,
        },
    ],
    "google": [
        {
            "id": "gemini-2.0-flash",
            "name": "Gemini 2.0 Flash",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
            ],
            "max_context_tokens": 1048576,
            "max_output_tokens": 8192,
        },
        {
            "id": "gemini-2.5-pro",
            "name": "Gemini 2.5 Pro",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
                ModelCapability.REASONING,
                ModelCapability.LONG_CONTEXT,
            ],
            "max_context_tokens": 1048576,
            "max_output_tokens": 65536,
        },
        {
            "id": "gemini-2.5-flash",
            "name": "Gemini 2.5 Flash",
            "capabilities": [
                ModelCapability.TOOL_CALLING,
                ModelCapability.VISION,
                ModelCapability.STREAMING,
            ],
            "max_context_tokens": 1048576,
            "max_output_tokens": 65536,
        },
    ],
}

# Default models per provider
DEFAULT_MODELS: dict[str, str] = {
    "anthropic": "claude-sonnet-4-20250514",
    "openai": "gpt-4o",
    "google": "gemini-2.0-flash",
}


class LLMSettingsBase(SQLModel):
    """Base LLM settings shared across all hierarchy levels.

    Contains model selection and parameter configuration.
    """

    # Default model selection
    default_provider: str = Field(default="anthropic")
    default_model: str = Field(default="claude-sonnet-4-20250514")
    default_model_display_name: str | None = Field(
        default=None, max_length=100
    )  # Custom display name for the model

    # Default parameters
    default_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    default_max_tokens: int | None = Field(default=None, ge=1, le=1000000)
    default_top_p: float = Field(default=1.0, ge=0.0, le=1.0)


class OrganizationLLMSettings(LLMSettingsBase, TimestampedTable, table=True):
    """Organization-level LLM settings.

    Controls default model, parameters, permissions, and provider restrictions.
    """

    __tablename__ = "organization_llm_settings"

    # Scoping (unique per org, CASCADE delete)
    organization_id: uuid.UUID = Field(
        foreign_key="organization.id",
        unique=True,
        nullable=False,
        ondelete="CASCADE",
    )

    # Fallback configuration
    fallback_enabled: bool = Field(default=False)
    fallback_models: list[str] = Field(default_factory=list, sa_type=JSON)

    # Permission controls
    allow_team_customization: bool = Field(default=True)
    allow_user_customization: bool = Field(default=True)
    allow_per_request_model_selection: bool = Field(default=True)

    # Provider restrictions
    enabled_providers: list[str] = Field(
        default_factory=lambda: ["anthropic", "openai", "google"],
        sa_type=JSON,
    )
    disabled_models: list[str] = Field(default_factory=list, sa_type=JSON)

    # Relationship
    organization: "Organization" = Relationship(back_populates="llm_settings")


class TeamLLMSettings(TimestampedTable, table=True):
    """Team-level LLM settings.

    Can override org defaults if allowed. Uses None for inherited values.
    """

    __tablename__ = "team_llm_settings"

    # Scoping (unique per team)
    team_id: uuid.UUID = Field(
        foreign_key="team.id",
        unique=True,
        nullable=False,
        ondelete="CASCADE",
    )

    # Model selection (None = inherit from org)
    default_provider: str | None = Field(default=None)
    default_model: str | None = Field(default=None)

    # Parameters (None = inherit)
    default_temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    default_max_tokens: int | None = Field(default=None, ge=1, le=1000000)

    # Permission controls
    allow_user_customization: bool = Field(default=True)

    # Restrictions (merged with org)
    disabled_models: list[str] = Field(default_factory=list, sa_type=JSON)

    # Relationship
    team: "Team" = Relationship(back_populates="llm_settings")


class UserLLMSettings(TimestampedTable, table=True):
    """User-level LLM preferences.

    Personal preferences applied if allowed by org/team settings.
    """

    __tablename__ = "user_llm_settings"

    # Scoping (unique per user)
    user_id: uuid.UUID = Field(
        foreign_key="user.id",
        unique=True,
        nullable=False,
        ondelete="CASCADE",
    )

    # User preferences (only if allowed)
    preferred_provider: str | None = Field(default=None)
    preferred_model: str | None = Field(default=None)
    preferred_temperature: float | None = Field(default=None, ge=0.0, le=2.0)

    # Relationship
    user: "User" = Relationship(back_populates="llm_settings")


class CustomLLMProvider(TimestampedTable, table=True):
    """Custom OpenAI-compatible LLM provider endpoint.

    Allows organizations to add custom endpoints like Ollama, LiteLLM, vLLM, etc.
    API keys are stored via secrets.py at path: /orgs/{org_id}/custom_providers/{id}
    """

    __tablename__ = "custom_llm_provider"

    # Scoping (org required, team optional for team-specific providers)
    organization_id: uuid.UUID = Field(
        foreign_key="organization.id",
        nullable=False,
        ondelete="CASCADE",
        index=True,
    )
    team_id: uuid.UUID | None = Field(
        foreign_key="team.id",
        nullable=True,
        default=None,
        ondelete="CASCADE",
        index=True,
    )

    # Provider configuration
    name: str = Field(max_length=100)  # Display name (e.g., "Ollama Local")
    provider_type: str = Field(default="openai_compatible")
    base_url: str = Field(
        max_length=500
    )  # API endpoint (e.g., "http://localhost:11434/v1")

    # Available models for this provider
    available_models: list[dict[str, Any]] = Field(
        default_factory=list,
        sa_type=JSON,
    )
    is_enabled: bool = Field(default=True)

    # Relationships
    organization: "Organization" = Relationship(back_populates="custom_llm_providers")
    team: Optional["Team"] = Relationship(back_populates="custom_llm_providers")


# Update schemas
class OrganizationLLMSettingsUpdate(SQLModel):
    """Update schema for organization LLM settings."""

    default_provider: str | None = None
    default_model: str | None = None
    default_model_display_name: str | None = Field(default=None, max_length=100)
    default_temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    default_max_tokens: int | None = Field(default=None, ge=1, le=1000000)
    default_top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    fallback_enabled: bool | None = None
    fallback_models: list[str] | None = None
    allow_team_customization: bool | None = None
    allow_user_customization: bool | None = None
    allow_per_request_model_selection: bool | None = None
    enabled_providers: list[str] | None = None
    disabled_models: list[str] | None = None


class TeamLLMSettingsUpdate(SQLModel):
    """Update schema for team LLM settings."""

    default_provider: str | None = None
    default_model: str | None = None
    default_temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    default_max_tokens: int | None = Field(default=None, ge=1, le=1000000)
    allow_user_customization: bool | None = None
    disabled_models: list[str] | None = None


class UserLLMSettingsUpdate(SQLModel):
    """Update schema for user LLM settings."""

    preferred_provider: str | None = None
    preferred_model: str | None = None
    preferred_temperature: float | None = Field(default=None, ge=0.0, le=2.0)


class CustomLLMProviderCreate(SQLModel):
    """Create schema for custom LLM provider."""

    name: str = Field(max_length=100)
    base_url: str
    api_key: str | None = None  # Will be stored via secrets.py
    available_models: list[dict[str, Any]] = Field(default_factory=list)
    team_id: uuid.UUID | None = None  # Optional team scope


class CustomLLMProviderUpdate(SQLModel):
    """Update schema for custom LLM provider."""

    name: str | None = Field(default=None, max_length=100)
    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = None  # Will update secret if provided
    available_models: list[dict[str, Any]] | None = None
    is_enabled: bool | None = None


class ProviderApiKeyUpdate(SQLModel):
    """Schema for updating a built-in provider's API key."""

    api_key: str = Field(min_length=1, max_length=500)


class ProviderStatusResponse(SQLModel):
    """Response schema for provider API key operations."""

    status: str
    provider: str | None = None
    message: str | None = None


# Public/Response schemas
class OrganizationLLMSettingsPublic(LLMSettingsBase, TimestampResponseMixin):
    """Public schema for organization LLM settings."""

    id: uuid.UUID
    organization_id: uuid.UUID
    fallback_enabled: bool
    fallback_models: list[str]
    allow_team_customization: bool
    allow_user_customization: bool
    allow_per_request_model_selection: bool
    enabled_providers: list[str]
    disabled_models: list[str]


class TeamLLMSettingsPublic(TimestampResponseMixin):
    """Public schema for team LLM settings."""

    id: uuid.UUID
    team_id: uuid.UUID
    default_provider: str | None
    default_model: str | None
    default_temperature: float | None
    default_max_tokens: int | None
    allow_user_customization: bool
    disabled_models: list[str]


class UserLLMSettingsPublic(TimestampResponseMixin):
    """Public schema for user LLM settings."""

    id: uuid.UUID
    user_id: uuid.UUID
    preferred_provider: str | None
    preferred_model: str | None
    preferred_temperature: float | None


class CustomLLMProviderPublic(TimestampResponseMixin):
    """Public schema for custom LLM provider."""

    id: uuid.UUID
    organization_id: uuid.UUID
    team_id: uuid.UUID | None
    name: str
    provider_type: str
    base_url: str
    available_models: list[dict[str, Any]]
    is_enabled: bool
    has_api_key: bool = (
        False  # Indicates if API key is configured (never expose actual key)
    )


class ModelInfo(SQLModel):
    """Model information for display and selection."""

    id: str
    name: str
    provider: str
    capabilities: list[str]
    max_context_tokens: int | None = None
    max_output_tokens: int | None = None
    is_custom: bool = False
    custom_provider_id: uuid.UUID | None = None


class EffectiveLLMSettings(SQLModel):
    """Computed effective LLM settings after applying hierarchy."""

    # Resolved values
    provider: str
    model: str
    temperature: float
    max_tokens: int | None
    top_p: float

    # Fallback configuration
    fallback_enabled: bool
    fallback_models: list[str]

    # Available options
    available_providers: list[str]
    available_models: list[ModelInfo]

    # Permissions
    can_change_model: bool
    can_change_parameters: bool
    per_request_selection_allowed: bool

    # Metadata
    settings_source: str  # "org", "team", "user"


# Rebuild models to resolve relationships
OrganizationLLMSettings.model_rebuild()
TeamLLMSettings.model_rebuild()
UserLLMSettings.model_rebuild()
CustomLLMProvider.model_rebuild()
