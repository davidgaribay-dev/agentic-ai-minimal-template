"""LLM settings API routes for hierarchical model configuration.

Follows the rag_settings API pattern for consistency.
"""

from typing import Annotated, Any
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.audit import audit_service
from backend.audit.schemas import AuditAction, Target
from backend.auth.deps import CurrentUser, SessionDep
from backend.llm_settings import service
from backend.llm_settings.models import (
    BUILT_IN_MODELS,
    CustomLLMProviderCreate,
    CustomLLMProviderPublic,
    CustomLLMProviderUpdate,
    EffectiveLLMSettings,
    LLMProvider,
    ModelInfo,
    OrganizationLLMSettingsPublic,
    OrganizationLLMSettingsUpdate,
    ProviderApiKeyUpdate,
    ProviderStatusResponse,
    TeamLLMSettingsPublic,
    TeamLLMSettingsUpdate,
    UserLLMSettingsPublic,
    UserLLMSettingsUpdate,
)
from backend.rbac import (
    OrgContextDep,
    OrgPermission,
    TeamContextDep,
    TeamPermission,
    require_org_permission,
    require_team_permission,
)

router = APIRouter(tags=["llm-settings"])

# --------------------------------------------------------------------------
# Organization LLM Settings
# --------------------------------------------------------------------------


@router.get(
    "/organizations/{organization_id}/llm-settings",
    response_model=OrganizationLLMSettingsPublic,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_READ))],
)
def get_org_llm_settings(
    session: SessionDep,
    org_context: OrgContextDep,
) -> OrganizationLLMSettingsPublic:
    """Get organization LLM settings.

    Requires org:read permission (member, admin, or owner).
    """
    settings = service.get_or_create_org_llm_settings(session, org_context.org_id)
    return OrganizationLLMSettingsPublic.model_validate(settings)


@router.put(
    "/organizations/{organization_id}/llm-settings",
    response_model=OrganizationLLMSettingsPublic,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def update_org_llm_settings(
    request: Request,
    session: SessionDep,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    settings_in: OrganizationLLMSettingsUpdate,
) -> OrganizationLLMSettingsPublic:
    """Update organization LLM settings.

    Requires org:update permission (admin or owner).
    Controls LLM provider and model defaults for the entire organization.
    """
    # Get current settings for change tracking
    current_settings = service.get_or_create_org_llm_settings(
        session, org_context.org_id
    )
    changes = {}
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, new_value in update_data.items():
        old_value = getattr(current_settings, field, None)
        if old_value != new_value:
            changes[field] = {"before": old_value, "after": new_value}

    settings = service.update_org_llm_settings(session, org_context.org_id, settings_in)

    if changes:
        await audit_service.log(
            AuditAction.ORG_SETTINGS_UPDATED,
            actor=current_user,
            request=request,
            organization_id=org_context.org_id,
            targets=[
                Target(type="organization_llm_settings", id=str(org_context.org_id))
            ],
            changes=changes,
        )

    return OrganizationLLMSettingsPublic.model_validate(settings)


@router.get(
    "/organizations/{organization_id}/llm-settings/available-models",
    response_model=list[ModelInfo],
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_READ))],
)
def get_available_models(
    session: SessionDep,
    org_context: OrgContextDep,
    team_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[ModelInfo]:
    """Get all available models for the organization/team context.

    Returns built-in models (filtered by enabled providers) plus custom providers.
    """
    return service.get_available_models(session, org_context.org_id, team_id)


# --------------------------------------------------------------------------
# Team LLM Settings
# --------------------------------------------------------------------------


@router.get(
    "/organizations/{organization_id}/teams/{team_id}/llm-settings",
    response_model=TeamLLMSettingsPublic,
    dependencies=[Depends(require_team_permission(TeamPermission.TEAM_READ))],
)
def get_team_llm_settings(
    session: SessionDep,
    team_context: TeamContextDep,
) -> TeamLLMSettingsPublic:
    """Get team LLM settings.

    Requires team:read permission (team member, admin, or org admin).
    """
    settings = service.get_or_create_team_llm_settings(session, team_context.team_id)
    return TeamLLMSettingsPublic.model_validate(settings)


@router.put(
    "/organizations/{organization_id}/teams/{team_id}/llm-settings",
    response_model=TeamLLMSettingsPublic,
    dependencies=[Depends(require_team_permission(TeamPermission.TEAM_UPDATE))],
)
async def update_team_llm_settings(
    request: Request,
    session: SessionDep,
    team_context: TeamContextDep,
    current_user: CurrentUser,
    settings_in: TeamLLMSettingsUpdate,
) -> TeamLLMSettingsPublic:
    """Update team LLM settings.

    Requires team:update permission (team admin or org admin).
    Teams can only customize if org allows team customization.
    """
    # Check if org allows team customization
    org_settings = service.get_or_create_org_llm_settings(session, team_context.org_id)
    if not org_settings.allow_team_customization:
        raise HTTPException(
            status_code=403,
            detail="Organization does not allow team customization of LLM settings",
        )

    # Get current settings for change tracking
    current_settings = service.get_or_create_team_llm_settings(
        session, team_context.team_id
    )
    changes = {}
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, new_value in update_data.items():
        old_value = getattr(current_settings, field, None)
        if old_value != new_value:
            changes[field] = {"before": old_value, "after": new_value}

    settings = service.update_team_llm_settings(
        session, team_context.team_id, settings_in
    )

    if changes:
        await audit_service.log(
            AuditAction.TEAM_SETTINGS_UPDATED,
            actor=current_user,
            request=request,
            organization_id=team_context.org_id,
            team_id=team_context.team_id,
            targets=[Target(type="team_llm_settings", id=str(team_context.team_id))],
            changes=changes,
        )

    return TeamLLMSettingsPublic.model_validate(settings)


# --------------------------------------------------------------------------
# User LLM Settings
# --------------------------------------------------------------------------


@router.get(
    "/users/me/llm-settings",
    response_model=UserLLMSettingsPublic,
)
def get_user_llm_settings(
    session: SessionDep,
    current_user: CurrentUser,
) -> UserLLMSettingsPublic:
    """Get current user's LLM settings.

    Personal LLM preferences.
    """
    settings = service.get_or_create_user_llm_settings(session, current_user.id)
    return UserLLMSettingsPublic.model_validate(settings)


@router.put(
    "/users/me/llm-settings",
    response_model=UserLLMSettingsPublic,
)
async def update_user_llm_settings(
    request: Request,
    session: SessionDep,
    current_user: CurrentUser,
    settings_in: UserLLMSettingsUpdate,
) -> UserLLMSettingsPublic:
    """Update current user's LLM settings.

    Personal LLM preferences that apply when both org and team allow customization.
    """
    # Get current settings for change tracking
    current_settings = service.get_or_create_user_llm_settings(session, current_user.id)
    changes = {}
    update_data = settings_in.model_dump(exclude_unset=True)
    for field, new_value in update_data.items():
        old_value = getattr(current_settings, field, None)
        if old_value != new_value:
            changes[field] = {"before": old_value, "after": new_value}

    settings = service.update_user_llm_settings(session, current_user.id, settings_in)

    if changes:
        await audit_service.log(
            AuditAction.USER_PROFILE_UPDATED,
            actor=current_user,
            request=request,
            targets=[Target(type="user_llm_settings", id=str(current_user.id))],
            changes=changes,
        )

    return UserLLMSettingsPublic.model_validate(settings)


# --------------------------------------------------------------------------
# Effective Settings (Computed)
# --------------------------------------------------------------------------


@router.get(
    "/llm-settings/effective",
    response_model=EffectiveLLMSettings,
)
def get_effective_llm_settings(
    session: SessionDep,
    current_user: CurrentUser,
    organization_id: Annotated[uuid.UUID, Query()],
    team_id: Annotated[uuid.UUID | None, Query()] = None,
) -> EffectiveLLMSettings:
    """Get effective LLM settings for current context.

    Computes final LLM settings after applying org → team → user hierarchy.
    Returns resolved settings, available models, and permission metadata.

    Args:
        organization_id: Organization context
        team_id: Optional team context

    Returns:
        Effective LLM settings with resolved values
    """
    return service.get_effective_llm_settings(
        session,
        current_user.id,
        organization_id,
        team_id,
    )


# --------------------------------------------------------------------------
# Built-in Models Reference
# --------------------------------------------------------------------------


@router.get(
    "/llm-settings/built-in-models",
    response_model=dict[str, list[dict[str, Any]]],
)
def get_built_in_models() -> dict[str, list[dict[str, Any]]]:
    """Get catalog of built-in models by provider.

    Returns all available built-in models for reference.
    This is a public endpoint for UI model selection.
    """
    return BUILT_IN_MODELS


# --------------------------------------------------------------------------
# Custom Providers
# --------------------------------------------------------------------------


@router.get(
    "/organizations/{organization_id}/custom-providers",
    response_model=list[CustomLLMProviderPublic],
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_READ))],
)
def list_custom_providers(
    session: SessionDep,
    org_context: OrgContextDep,
    team_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[CustomLLMProviderPublic]:
    """List custom LLM providers for the organization.

    Optionally filter by team_id to get team-specific providers.
    """
    providers = service.list_custom_providers(session, org_context.org_id, team_id)
    return [
        CustomLLMProviderPublic(
            **p.model_dump(),
            has_api_key=service.has_custom_provider_api_key(org_context.org_id, p.id),
        )
        for p in providers
    ]


@router.post(
    "/organizations/{organization_id}/custom-providers",
    response_model=CustomLLMProviderPublic,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def create_custom_provider(
    request: Request,
    session: SessionDep,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    provider_in: CustomLLMProviderCreate,
) -> CustomLLMProviderPublic:
    """Create a custom LLM provider (OpenAI-compatible endpoint).

    Requires org:update permission.
    API key is stored encrypted via secrets service.
    """
    provider = service.create_custom_provider(session, org_context.org_id, provider_in)

    await audit_service.log(
        AuditAction.ORG_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=org_context.org_id,
        targets=[Target(type="custom_llm_provider", id=str(provider.id))],
        changes={
            "action": "create",
            "name": provider.name,
            "base_url": provider.base_url,
        },
    )

    return CustomLLMProviderPublic(
        **provider.model_dump(),
        has_api_key=provider_in.api_key is not None,
    )


@router.get(
    "/organizations/{organization_id}/custom-providers/{provider_id}",
    response_model=CustomLLMProviderPublic,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_READ))],
)
def get_custom_provider(
    session: SessionDep,
    org_context: OrgContextDep,
    provider_id: uuid.UUID,
) -> CustomLLMProviderPublic:
    """Get a custom LLM provider by ID."""
    provider = service.get_custom_provider(session, provider_id, org_context.org_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Custom provider not found")

    return CustomLLMProviderPublic(
        **provider.model_dump(),
        has_api_key=service.has_custom_provider_api_key(
            org_context.org_id, provider_id
        ),
    )


@router.put(
    "/organizations/{organization_id}/custom-providers/{provider_id}",
    response_model=CustomLLMProviderPublic,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def update_custom_provider(
    request: Request,
    session: SessionDep,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    provider_id: uuid.UUID,
    provider_in: CustomLLMProviderUpdate,
) -> CustomLLMProviderPublic:
    """Update a custom LLM provider.

    Requires org:update permission.
    """
    provider = service.get_custom_provider(session, provider_id, org_context.org_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Custom provider not found")

    # Track changes
    changes = {}
    update_data = provider_in.model_dump(exclude_unset=True, exclude={"api_key"})
    for field, new_value in update_data.items():
        old_value = getattr(provider, field, None)
        if old_value != new_value:
            changes[field] = {"before": old_value, "after": new_value}

    if provider_in.api_key is not None:
        changes["api_key"] = {"before": "[REDACTED]", "after": "[UPDATED]"}

    updated = service.update_custom_provider(session, provider_id, provider_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Custom provider not found")

    if changes:
        await audit_service.log(
            AuditAction.ORG_SETTINGS_UPDATED,
            actor=current_user,
            request=request,
            organization_id=org_context.org_id,
            targets=[Target(type="custom_llm_provider", id=str(provider_id))],
            changes=changes,
        )

    return CustomLLMProviderPublic(
        **updated.model_dump(),
        has_api_key=service.has_custom_provider_api_key(
            org_context.org_id, provider_id
        ),
    )


@router.delete(
    "/organizations/{organization_id}/custom-providers/{provider_id}",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def delete_custom_provider(
    request: Request,
    session: SessionDep,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    provider_id: uuid.UUID,
) -> ProviderStatusResponse:
    """Delete a custom LLM provider.

    Requires org:update permission.
    """
    provider = service.get_custom_provider(session, provider_id, org_context.org_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Custom provider not found")

    service.delete_custom_provider(session, org_context.org_id, provider_id)

    await audit_service.log(
        AuditAction.ORG_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=org_context.org_id,
        targets=[Target(type="custom_llm_provider", id=str(provider_id))],
        changes={"action": "delete", "name": provider.name},
    )

    return ProviderStatusResponse(
        status="deleted", message=f"Deleted provider: {provider.name}"
    )


@router.post(
    "/organizations/{organization_id}/custom-providers/{provider_id}/test",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
def test_custom_provider(
    session: SessionDep,
    org_context: OrgContextDep,
    provider_id: uuid.UUID,
) -> ProviderStatusResponse:
    """Test connection to a custom LLM provider.

    Attempts to list models from the provider's endpoint.
    """
    provider = service.get_custom_provider(session, provider_id, org_context.org_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Custom provider not found")

    success, message = service.test_custom_provider_connection(
        org_context.org_id, provider
    )

    if success:
        return ProviderStatusResponse(status="success", message=message)
    raise HTTPException(status_code=400, detail=message)


# --------------------------------------------------------------------------
# Provider API Keys Management
# --------------------------------------------------------------------------

# Derive valid providers from enum (excludes CUSTOM)
VALID_PROVIDERS = {p.value for p in LLMProvider if p != LLMProvider.CUSTOM}


@router.get(
    "/organizations/{organization_id}/llm-settings/api-key-status",
    response_model=dict[str, bool],
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_READ))],
)
def get_provider_api_key_status(
    org_context: OrgContextDep,
) -> dict[str, bool]:
    """Get API key status for all built-in providers.

    Returns a dict mapping provider name to whether an API key is configured.
    """
    return {
        provider: service.has_provider_api_key(org_context.org_id, provider)
        for provider in VALID_PROVIDERS
    }


@router.put(
    "/organizations/{organization_id}/llm-settings/api-key/{provider}",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def set_provider_api_key(
    request: Request,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    provider: str,
    body: ProviderApiKeyUpdate,
) -> ProviderStatusResponse:
    """Set API key for a built-in provider.

    Requires org:update permission.
    API key is stored encrypted via secrets service.
    """
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(VALID_PROVIDERS))}",
        )

    service.set_provider_api_key(org_context.org_id, provider, body.api_key)

    await audit_service.log(
        AuditAction.ORG_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=org_context.org_id,
        targets=[Target(type="llm_provider_api_key", id=provider)],
        changes={"action": "set", "provider": provider},
    )

    return ProviderStatusResponse(status="success", provider=provider)


@router.delete(
    "/organizations/{organization_id}/llm-settings/api-key/{provider}",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_org_permission(OrgPermission.ORG_UPDATE))],
)
async def delete_provider_api_key(
    request: Request,
    org_context: OrgContextDep,
    current_user: CurrentUser,
    provider: str,
) -> ProviderStatusResponse:
    """Delete API key for a built-in provider.

    Requires org:update permission.
    """
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(VALID_PROVIDERS))}",
        )

    service.delete_provider_api_key(org_context.org_id, provider)

    await audit_service.log(
        AuditAction.ORG_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=org_context.org_id,
        targets=[Target(type="llm_provider_api_key", id=provider)],
        changes={"action": "delete", "provider": provider},
    )

    return ProviderStatusResponse(status="deleted", provider=provider)


# --------------------------------------------------------------------------
# Team-level Provider API Keys Management
# --------------------------------------------------------------------------


@router.get(
    "/organizations/{organization_id}/teams/{team_id}/llm-settings/api-key-status",
    response_model=dict[str, bool],
    dependencies=[Depends(require_team_permission(TeamPermission.TEAM_READ))],
)
def get_team_provider_api_key_status(
    team_context: TeamContextDep,
) -> dict[str, bool]:
    """Get API key status for all built-in providers at team level.

    Returns a dict mapping provider name to whether an API key is configured.
    Also indicates which providers have org-level keys available.
    """
    return {
        provider: service.has_team_provider_api_key(
            team_context.org_id, team_context.team_id, provider
        )
        for provider in VALID_PROVIDERS
    }


@router.put(
    "/organizations/{organization_id}/teams/{team_id}/llm-settings/api-key/{provider}",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_team_permission(TeamPermission.TEAM_UPDATE))],
)
async def set_team_provider_api_key(
    request: Request,
    team_context: TeamContextDep,
    current_user: CurrentUser,
    provider: str,
    body: ProviderApiKeyUpdate,
) -> ProviderStatusResponse:
    """Set API key for a built-in provider at team level.

    Requires team:update permission.
    API key is stored encrypted via secrets service.
    """
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(VALID_PROVIDERS))}",
        )

    service.set_team_provider_api_key(
        team_context.org_id, team_context.team_id, provider, body.api_key
    )

    await audit_service.log(
        AuditAction.TEAM_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=team_context.org_id,
        team_id=team_context.team_id,
        targets=[Target(type="team_llm_provider_api_key", id=provider)],
        changes={"action": "set", "provider": provider},
    )

    return ProviderStatusResponse(status="success", provider=provider)


@router.delete(
    "/organizations/{organization_id}/teams/{team_id}/llm-settings/api-key/{provider}",
    response_model=ProviderStatusResponse,
    dependencies=[Depends(require_team_permission(TeamPermission.TEAM_UPDATE))],
)
async def delete_team_provider_api_key(
    request: Request,
    team_context: TeamContextDep,
    current_user: CurrentUser,
    provider: str,
) -> ProviderStatusResponse:
    """Delete API key for a built-in provider at team level.

    Requires team:update permission.
    """
    if provider not in VALID_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid provider. Must be one of: {', '.join(sorted(VALID_PROVIDERS))}",
        )

    service.delete_team_provider_api_key(
        team_context.org_id, team_context.team_id, provider
    )

    await audit_service.log(
        AuditAction.TEAM_SETTINGS_UPDATED,
        actor=current_user,
        request=request,
        organization_id=team_context.org_id,
        team_id=team_context.team_id,
        targets=[Target(type="team_llm_provider_api_key", id=provider)],
        changes={"action": "delete", "provider": provider},
    )

    return ProviderStatusResponse(status="deleted", provider=provider)
