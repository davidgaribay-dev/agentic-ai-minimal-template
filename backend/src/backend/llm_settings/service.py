"""LLM settings service layer for hierarchical configuration management.

Follows the rag_settings/service.py pattern for consistency.
"""

from datetime import UTC, datetime
import uuid

import httpx
from sqlmodel import Session, select

from backend.core.cache import request_cached_sync
from backend.core.secrets import get_secrets_service
from backend.llm_settings.models import (
    BUILT_IN_MODELS,
    CustomLLMProvider,
    CustomLLMProviderCreate,
    CustomLLMProviderUpdate,
    EffectiveLLMSettings,
    ModelCapability,
    ModelInfo,
    OrganizationLLMSettings,
    OrganizationLLMSettingsUpdate,
    TeamLLMSettings,
    TeamLLMSettingsUpdate,
    UserLLMSettings,
    UserLLMSettingsUpdate,
)

# Default values
DEFAULT_PROVIDER = "anthropic"
DEFAULT_MODEL = "claude-sonnet-4-20250514"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_TOP_P = 1.0

# HTTP status codes
HTTP_STATUS_OK = 200


# Custom provider secrets helpers (using public SecretsService methods)
def _store_custom_provider_api_key(
    organization_id: uuid.UUID, provider_id: uuid.UUID, api_key: str
) -> bool:
    """Store API key for a custom provider."""
    secrets = get_secrets_service()
    return secrets.set_custom_provider_api_key(
        str(provider_id), api_key, str(organization_id)
    )


def _delete_custom_provider_api_key(
    organization_id: uuid.UUID, provider_id: uuid.UUID
) -> bool:
    """Delete API key for a custom provider."""
    secrets = get_secrets_service()
    return secrets.delete_custom_provider_api_key(
        str(provider_id), str(organization_id)
    )


def _get_custom_provider_api_key(
    organization_id: uuid.UUID, provider_id: uuid.UUID
) -> str | None:
    """Get API key for a custom provider."""
    secrets = get_secrets_service()
    return secrets.get_custom_provider_api_key(str(provider_id), str(organization_id))


def get_or_create_org_llm_settings(
    session: Session, organization_id: uuid.UUID
) -> OrganizationLLMSettings:
    """Get or create organization LLM settings with defaults."""
    statement = select(OrganizationLLMSettings).where(
        OrganizationLLMSettings.organization_id == organization_id
    )
    settings = session.exec(statement).first()

    if not settings:
        settings = OrganizationLLMSettings(
            organization_id=organization_id,
            default_provider=DEFAULT_PROVIDER,
            default_model=DEFAULT_MODEL,
            default_temperature=DEFAULT_TEMPERATURE,
            default_max_tokens=None,
            default_top_p=DEFAULT_TOP_P,
            fallback_enabled=False,
            fallback_models=[],
            allow_team_customization=True,
            allow_user_customization=True,
            allow_per_request_model_selection=True,
            enabled_providers=["anthropic", "openai", "google"],
            disabled_models=[],
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return settings


def update_org_llm_settings(
    session: Session,
    organization_id: uuid.UUID,
    data: OrganizationLLMSettingsUpdate,
) -> OrganizationLLMSettings:
    """Update organization LLM settings."""
    settings = get_or_create_org_llm_settings(session, organization_id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.updated_at = datetime.now(UTC)
    session.add(settings)
    session.commit()
    session.refresh(settings)

    return settings


def get_or_create_team_llm_settings(
    session: Session, team_id: uuid.UUID
) -> TeamLLMSettings:
    """Get or create team LLM settings with defaults."""
    statement = select(TeamLLMSettings).where(TeamLLMSettings.team_id == team_id)
    settings = session.exec(statement).first()

    if not settings:
        settings = TeamLLMSettings(
            team_id=team_id,
            default_provider=None,  # Inherit from org
            default_model=None,
            default_temperature=None,
            default_max_tokens=None,
            allow_user_customization=True,
            disabled_models=[],
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return settings


def update_team_llm_settings(
    session: Session, team_id: uuid.UUID, data: TeamLLMSettingsUpdate
) -> TeamLLMSettings:
    """Update team LLM settings."""
    settings = get_or_create_team_llm_settings(session, team_id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.updated_at = datetime.now(UTC)
    session.add(settings)
    session.commit()
    session.refresh(settings)

    return settings


def get_or_create_user_llm_settings(
    session: Session, user_id: uuid.UUID
) -> UserLLMSettings:
    """Get or create user LLM settings with defaults."""
    statement = select(UserLLMSettings).where(UserLLMSettings.user_id == user_id)
    settings = session.exec(statement).first()

    if not settings:
        settings = UserLLMSettings(
            user_id=user_id,
            preferred_provider=None,  # Inherit from org/team
            preferred_model=None,
            preferred_temperature=None,
        )
        session.add(settings)
        session.commit()
        session.refresh(settings)

    return settings


def update_user_llm_settings(
    session: Session, user_id: uuid.UUID, data: UserLLMSettingsUpdate
) -> UserLLMSettings:
    """Update user LLM settings."""
    settings = get_or_create_user_llm_settings(session, user_id)

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    settings.updated_at = datetime.now(UTC)
    session.add(settings)
    session.commit()
    session.refresh(settings)

    return settings


# Custom provider management
def create_custom_provider(
    session: Session,
    organization_id: uuid.UUID,
    data: CustomLLMProviderCreate,
) -> CustomLLMProvider:
    """Create a new custom LLM provider."""
    provider = CustomLLMProvider(
        organization_id=organization_id,
        team_id=data.team_id,
        name=data.name,
        base_url=data.base_url,
        available_models=data.available_models,
        is_enabled=True,
    )
    session.add(provider)
    session.commit()
    session.refresh(provider)

    # Store API key if provided
    if data.api_key:
        _store_custom_provider_api_key(organization_id, provider.id, data.api_key)

    return provider


def update_custom_provider(
    session: Session,
    provider_id: uuid.UUID,
    data: CustomLLMProviderUpdate,
) -> CustomLLMProvider | None:
    """Update a custom LLM provider."""
    statement = select(CustomLLMProvider).where(CustomLLMProvider.id == provider_id)
    provider = session.exec(statement).first()

    if not provider:
        return None

    update_data = data.model_dump(exclude_unset=True, exclude={"api_key"})
    for key, value in update_data.items():
        setattr(provider, key, value)

    provider.updated_at = datetime.now(UTC)
    session.add(provider)
    session.commit()
    session.refresh(provider)

    # Update API key if provided
    if data.api_key is not None:
        if data.api_key:
            _store_custom_provider_api_key(
                provider.organization_id, provider.id, data.api_key
            )
        else:
            _delete_custom_provider_api_key(provider.organization_id, provider.id)

    return provider


def delete_custom_provider(
    session: Session, organization_id: uuid.UUID, provider_id: uuid.UUID
) -> bool:
    """Delete a custom LLM provider."""
    statement = select(CustomLLMProvider).where(CustomLLMProvider.id == provider_id)
    provider = session.exec(statement).first()

    if not provider:
        return False

    # Delete API key secret
    _delete_custom_provider_api_key(organization_id, provider.id)

    session.delete(provider)
    session.commit()
    return True


def get_custom_provider(
    session: Session,
    provider_id: uuid.UUID,
    organization_id: uuid.UUID | None = None,
) -> CustomLLMProvider | None:
    """Get a custom LLM provider by ID, optionally filtered by org.

    Args:
        session: Database session
        provider_id: Provider UUID
        organization_id: Optional org UUID to filter by (for security)

    Returns:
        CustomLLMProvider if found (and matches org if provided), None otherwise
    """
    statement = select(CustomLLMProvider).where(CustomLLMProvider.id == provider_id)
    if organization_id is not None:
        statement = statement.where(
            CustomLLMProvider.organization_id == organization_id
        )
    return session.exec(statement).first()


def list_custom_providers(
    session: Session,
    organization_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
) -> list[CustomLLMProvider]:
    """List custom LLM providers for an organization, optionally filtered by team."""
    statement = select(CustomLLMProvider).where(
        CustomLLMProvider.organization_id == organization_id,
        CustomLLMProvider.is_enabled == True,  # noqa: E712
    )

    if team_id:
        # Include org-level providers (team_id=NULL) and team-specific providers
        statement = statement.where(
            (CustomLLMProvider.team_id == None)  # noqa: E711
            | (CustomLLMProvider.team_id == team_id)
        )

    return list(session.exec(statement).all())


def has_custom_provider_api_key(
    organization_id: uuid.UUID, provider_id: uuid.UUID
) -> bool:
    """Check if a custom provider has an API key configured."""
    secret = _get_custom_provider_api_key(organization_id, provider_id)
    return secret is not None


def get_custom_provider_api_key(
    organization_id: uuid.UUID, provider_id: uuid.UUID
) -> str | None:
    """Get the API key for a custom provider."""
    return _get_custom_provider_api_key(organization_id, provider_id)


# --------------------------------------------------------------------------
# Built-in Provider API Keys Management
# --------------------------------------------------------------------------


def has_provider_api_key(organization_id: uuid.UUID, provider: str) -> bool:
    """Check if an API key is configured for a built-in provider."""
    secrets = get_secrets_service()
    return secrets.has_llm_provider_key(provider, str(organization_id))


def get_provider_api_key(organization_id: uuid.UUID, provider: str) -> str | None:
    """Get the API key for a built-in provider."""
    secrets = get_secrets_service()
    return secrets.get_llm_provider_key(provider, str(organization_id))


def set_provider_api_key(
    organization_id: uuid.UUID, provider: str, api_key: str
) -> bool:
    """Set the API key for a built-in provider."""
    secrets = get_secrets_service()
    return secrets.set_llm_provider_key(provider, api_key, str(organization_id))


def delete_provider_api_key(organization_id: uuid.UUID, provider: str) -> bool:
    """Delete the API key for a built-in provider."""
    secrets = get_secrets_service()
    return secrets.delete_llm_provider_key(provider, str(organization_id))


# --------------------------------------------------------------------------
# Team-level Provider API Keys Management
# --------------------------------------------------------------------------


def has_team_provider_api_key(
    organization_id: uuid.UUID, team_id: uuid.UUID, provider: str
) -> bool:
    """Check if an API key is configured for a built-in provider at team level."""
    secrets = get_secrets_service()
    return secrets.has_llm_provider_key(provider, str(organization_id), str(team_id))


def get_team_provider_api_key(
    organization_id: uuid.UUID, team_id: uuid.UUID, provider: str
) -> str | None:
    """Get the API key for a built-in provider at team level."""
    secrets = get_secrets_service()
    return secrets.get_llm_provider_key(provider, str(organization_id), str(team_id))


def set_team_provider_api_key(
    organization_id: uuid.UUID, team_id: uuid.UUID, provider: str, api_key: str
) -> bool:
    """Set the API key for a built-in provider at team level."""
    secrets = get_secrets_service()
    return secrets.set_llm_provider_key(
        provider, api_key, str(organization_id), str(team_id)
    )


def delete_team_provider_api_key(
    organization_id: uuid.UUID, team_id: uuid.UUID, provider: str
) -> bool:
    """Delete the API key for a built-in provider at team level."""
    secrets = get_secrets_service()
    return secrets.delete_llm_provider_key(provider, str(organization_id), str(team_id))


def test_custom_provider_connection(
    organization_id: uuid.UUID, provider: CustomLLMProvider
) -> tuple[bool, str]:
    """Test connection to a custom LLM provider.

    Attempts a simple API call to verify the endpoint is reachable.
    Returns (success, message) tuple.
    """
    api_key = get_custom_provider_api_key(organization_id, provider.id)

    try:
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        # Try to list models endpoint (OpenAI-compatible)
        base_url = provider.base_url.rstrip("/")
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{base_url}/models", headers=headers)

        if response.status_code == HTTP_STATUS_OK:
            return (True, "Connection successful")
        return (
            False,
            f"API returned status {response.status_code}: {response.text[:200]}",
        )
    except httpx.ConnectError:
        return (False, f"Could not connect to {provider.base_url}")
    except httpx.TimeoutException:
        return (False, "Connection timed out")
    except Exception as e:
        return (False, f"Connection failed: {e!s}")


def get_available_models(
    session: Session,
    organization_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
) -> list[ModelInfo]:
    """Get all available models for selection (built-in + custom - disabled).

    Returns models from:
    1. Built-in providers (if enabled)
    2. Custom providers (if any)
    Minus:
    - Disabled models at org level
    - Disabled models at team level (if team context)
    """
    org_settings = get_or_create_org_llm_settings(session, organization_id)
    team_settings = None
    if team_id:
        team_settings = get_or_create_team_llm_settings(session, team_id)

    # Collect all disabled models
    disabled_models: set[str] = set(org_settings.disabled_models or [])
    if team_settings and team_settings.disabled_models:
        disabled_models.update(team_settings.disabled_models)

    models: list[ModelInfo] = []

    # Add built-in models for enabled providers
    for provider in org_settings.enabled_providers or []:
        if provider in BUILT_IN_MODELS:
            for model_data in BUILT_IN_MODELS[provider]:
                model_id = model_data["id"]
                if model_id not in disabled_models:
                    capabilities = [
                        c.value if isinstance(c, ModelCapability) else c
                        for c in model_data.get("capabilities", [])
                    ]
                    models.append(
                        ModelInfo(
                            id=model_id,
                            name=model_data["name"],
                            provider=provider,
                            capabilities=capabilities,
                            max_context_tokens=model_data.get("max_context_tokens"),
                            max_output_tokens=model_data.get("max_output_tokens"),
                            is_custom=False,
                            custom_provider_id=None,
                        )
                    )

    # Add custom provider models
    custom_providers = list_custom_providers(session, organization_id, team_id)
    for custom_prov in custom_providers:
        for model_data in custom_prov.available_models or []:
            model_id = model_data.get("id", "")
            if model_id and model_id not in disabled_models:
                models.append(
                    ModelInfo(
                        id=model_id,
                        name=model_data.get("name", model_id),
                        provider="custom",
                        capabilities=model_data.get("capabilities", []),
                        max_context_tokens=model_data.get("max_context_tokens"),
                        max_output_tokens=model_data.get("max_output_tokens"),
                        is_custom=True,
                        custom_provider_id=custom_prov.id,
                    )
                )

    return models


# Cache key helper for effective settings
_LLM_ARG_IDX_USER_ID = 1
_LLM_ARG_IDX_ORG_ID = 2
_LLM_ARG_IDX_TEAM_ID = 3
_LLM_ARG_COUNT_WITH_USER = 2
_LLM_ARG_COUNT_WITH_ORG = 3
_LLM_ARG_COUNT_WITH_TEAM = 4


def _llm_settings_cache_key(
    *args: object,
    _session: Session | None = None,
    user_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
    **_kwargs: object,
) -> str:
    """Generate cache key for effective LLM settings lookup."""
    if args:
        if len(args) >= _LLM_ARG_COUNT_WITH_USER:
            user_id = args[_LLM_ARG_IDX_USER_ID]  # type: ignore[assignment]
        if len(args) >= _LLM_ARG_COUNT_WITH_ORG:
            organization_id = args[_LLM_ARG_IDX_ORG_ID]  # type: ignore[assignment]
        if len(args) >= _LLM_ARG_COUNT_WITH_TEAM:
            team_id = args[_LLM_ARG_IDX_TEAM_ID]  # type: ignore[assignment]
    return f"llm_settings:{organization_id}:{team_id}:{user_id}"


@request_cached_sync(_llm_settings_cache_key)
def get_effective_llm_settings(
    session: Session,
    user_id: uuid.UUID,
    organization_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
) -> EffectiveLLMSettings:
    """Compute effective LLM settings by applying hierarchy: Org > Team > User.

    The hierarchy works as follows:
    1. Start with org defaults
    2. Override with team settings (if allowed and set)
    3. Override with user preferences (if allowed and set)
    4. Return effective settings with resolved values and available models

    Args:
        session: Database session
        user_id: User UUID
        organization_id: Organization UUID
        team_id: Optional team UUID (for team context)

    Returns:
        EffectiveLLMSettings with computed values, available models, and permission metadata
    """
    org_settings = get_or_create_org_llm_settings(session, organization_id)
    team_settings = None
    if team_id:
        team_settings = get_or_create_team_llm_settings(session, team_id)
    user_settings = get_or_create_user_llm_settings(session, user_id)

    # Start with org defaults
    provider = org_settings.default_provider
    model = org_settings.default_model
    temperature = org_settings.default_temperature
    max_tokens = org_settings.default_max_tokens
    top_p = org_settings.default_top_p
    settings_source = "org"

    # Determine if customization is allowed
    can_change_model = True
    can_change_parameters = True

    # Apply team overrides if allowed
    if team_settings and org_settings.allow_team_customization:
        if team_settings.default_provider is not None:
            provider = team_settings.default_provider
            settings_source = "team"
        if team_settings.default_model is not None:
            model = team_settings.default_model
            settings_source = "team"
        if team_settings.default_temperature is not None:
            temperature = team_settings.default_temperature
        if team_settings.default_max_tokens is not None:
            max_tokens = team_settings.default_max_tokens

        # Check if user can customize (both org and team must allow)
        user_can_customize = (
            org_settings.allow_user_customization
            and team_settings.allow_user_customization
        )
    else:
        user_can_customize = org_settings.allow_user_customization

    # Apply user preferences if allowed
    if user_can_customize:
        if user_settings.preferred_provider is not None:
            provider = user_settings.preferred_provider
            settings_source = "user"
        if user_settings.preferred_model is not None:
            model = user_settings.preferred_model
            settings_source = "user"
        if user_settings.preferred_temperature is not None:
            temperature = user_settings.preferred_temperature
    else:
        can_change_model = False
        can_change_parameters = False

    # Get available models
    available_models = get_available_models(session, organization_id, team_id)

    # Get available providers from enabled list
    available_providers = list(org_settings.enabled_providers or [])

    # Add "custom" to available providers if there are custom providers
    custom_providers = list_custom_providers(session, organization_id, team_id)
    if custom_providers and "custom" not in available_providers:
        available_providers.append("custom")

    return EffectiveLLMSettings(
        provider=provider,
        model=model,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        fallback_enabled=org_settings.fallback_enabled,
        fallback_models=org_settings.fallback_models or [],
        available_providers=available_providers,
        available_models=available_models,
        can_change_model=can_change_model,
        can_change_parameters=can_change_parameters,
        per_request_selection_allowed=org_settings.allow_per_request_model_selection,
        settings_source=settings_source,
    )


def get_model_for_chat(
    session: Session,
    organization_id: uuid.UUID,
    team_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    model_override: str | None = None,
    provider_override: str | None = None,
    temperature_override: float | None = None,
) -> tuple[str, str, float, int | None]:
    """Get the model configuration for a chat request.

    Resolves the model to use based on:
    1. Explicit overrides (if per-request selection is allowed)
    2. Effective settings from hierarchy

    Returns:
        Tuple of (provider, model, temperature, max_tokens)
    """
    # Get effective settings
    if user_id:
        effective = get_effective_llm_settings(
            session, user_id, organization_id, team_id
        )
    else:
        # No user context - use org defaults directly
        org_settings = get_or_create_org_llm_settings(session, organization_id)
        return (
            org_settings.default_provider,
            org_settings.default_model,
            org_settings.default_temperature,
            org_settings.default_max_tokens,
        )

    # Apply overrides if allowed
    provider = effective.provider
    model = effective.model
    temperature = effective.temperature
    max_tokens = effective.max_tokens

    if effective.per_request_selection_allowed:
        if provider_override is not None:
            provider = provider_override
        if model_override is not None:
            model = model_override
        if temperature_override is not None:
            temperature = temperature_override

    return (provider, model, temperature, max_tokens)
