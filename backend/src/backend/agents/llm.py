from functools import lru_cache
from typing import Literal
import uuid

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from sqlmodel import Session

from backend.core.config import settings
from backend.core.db import engine
from backend.core.logging import get_logger
from backend.core.secrets import get_secrets_service

logger = get_logger(__name__)

LLMProvider = Literal["anthropic", "openai", "google", "custom"]

# Maximum length for generated conversation titles
MAX_TITLE_LENGTH = 50


@lru_cache
def get_chat_model(provider: LLMProvider | None = None) -> BaseChatModel:
    """Get a chat model instance for the specified provider (legacy, uses env vars).

    This function is cached and uses environment variables directly.
    For multi-tenant support with encrypted secrets, use get_chat_model_with_context instead.

    Args:
        provider: LLM provider to use. Defaults to settings.DEFAULT_LLM_PROVIDER

    Returns:
        A configured chat model instance

    Raises:
        ValueError: If the provider is not supported or API key is missing
    """
    provider = provider or settings.DEFAULT_LLM_PROVIDER

    logger.info("initializing_llm", provider=provider, source="environment")

    if provider == "anthropic":
        if not settings.ANTHROPIC_API_KEY:
            raise ValueError("ANTHROPIC_API_KEY is not set")

        return ChatAnthropic(
            model="claude-haiku-4-5-20251001",
            api_key=settings.ANTHROPIC_API_KEY,
            max_tokens=4096,
        )

    if provider == "openai":
        if not settings.OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY is not set")

        return ChatOpenAI(
            model="gpt-4o",
            api_key=settings.OPENAI_API_KEY,
        )

    if provider == "google":
        if not settings.GOOGLE_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not set")

        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=settings.GOOGLE_API_KEY,
        )

    raise ValueError(f"Unsupported LLM provider: {provider}")


def get_chat_model_with_context(
    org_id: str,
    team_id: str | None = None,
    provider: LLMProvider | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    user_id: str | None = None,
    session: Session | None = None,
) -> BaseChatModel:
    """Get a chat model with API key from encrypted storage (multi-tenant).

    This function resolves model settings from the hierarchy (org → team → user)
    and fetches the API key from encrypted database with the following
    fallback chain:
    1. Team-level key (if team_id provided)
    2. Org-level key
    3. Environment variable

    Args:
        org_id: Organization ID for scoping
        team_id: Optional team ID for team-level override
        provider: LLM provider to use (override). If None, uses effective settings
        model: Model ID to use (override). If None, uses effective settings
        temperature: Temperature (override). If None, uses effective settings
        max_tokens: Max tokens (override). If None, uses effective settings
        user_id: User ID for user-level preferences
        session: Database session for querying settings. If not provided, creates one.

    Returns:
        A configured chat model instance

    Raises:
        ValueError: If no API key is available for the provider
    """
    secrets = get_secrets_service()

    # Use hierarchical settings system when we have user_id
    # Create a session if one isn't provided
    if user_id is not None:
        from backend.llm_settings.service import get_model_for_chat

        def _resolve_settings(
            sess: Session,
        ) -> tuple[str, str, float, int | None]:
            return get_model_for_chat(
                session=sess,
                organization_id=uuid.UUID(org_id),
                team_id=uuid.UUID(team_id) if team_id else None,
                user_id=uuid.UUID(user_id),
                model_override=model,
                provider_override=provider,
                temperature_override=temperature,
            )

        if session is not None:
            resolved_provider, resolved_model, resolved_temp, resolved_max = (
                _resolve_settings(session)
            )
        else:
            # Create a session to query settings
            with Session(engine) as new_session:
                resolved_provider, resolved_model, resolved_temp, resolved_max = (
                    _resolve_settings(new_session)
                )

        # Use explicit overrides if provided, otherwise use resolved values
        provider = provider or resolved_provider  # type: ignore[assignment]
        model = model or resolved_model
        temperature = temperature if temperature is not None else resolved_temp
        max_tokens = max_tokens if max_tokens is not None else resolved_max
    else:
        # Fallback to legacy behavior when no user_id
        if provider is None:
            provider = secrets.get_default_provider(org_id, team_id)
        # Use legacy default models
        if model is None:
            if provider == "anthropic":
                model = "claude-haiku-4-5-20251001"
            elif provider == "openai":
                model = "gpt-4o"
            elif provider == "google":
                model = "gemini-2.0-flash"
        if temperature is None:
            temperature = 0.7

    # Get API key based on provider
    if provider is None:
        raise ValueError(
            "No LLM provider configured. Set a default model in organization settings."
        )

    if provider == "custom":
        # Custom provider - needs special handling
        # The model ID should help identify which custom provider to use
        # For now, raise an error - full implementation requires custom provider lookup
        raise ValueError(
            "Custom providers require session context. "
            "Pass session and user_id to use custom providers."
        )

    api_key = secrets.get_llm_api_key(provider, org_id, team_id)

    if not api_key:
        raise ValueError(
            f"No API key configured for {provider}. "
            f"Set it in team/org settings or via environment variable."
        )

    logger.info(
        "initializing_llm",
        provider=provider,
        model=model,
        org_id=org_id,
        team_id=team_id,
        source="encrypted_db",
    )

    if provider == "anthropic":
        return ChatAnthropic(
            model=model,
            api_key=api_key,
            max_tokens=max_tokens or 4096,
            temperature=temperature,
        )

    if provider == "openai":
        return ChatOpenAI(
            model=model,
            api_key=api_key,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    if provider == "google":
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            max_output_tokens=max_tokens,
            temperature=temperature,
        )

    raise ValueError(f"Unsupported LLM provider: {provider}")


async def generate_conversation_title(
    user_message: str,
    assistant_response: str,
    org_id: str | None = None,
    team_id: str | None = None,
) -> str:
    """Generate a short, descriptive title for a conversation.

    Uses the LLM to summarize the first exchange into a concise title.

    Args:
        user_message: The user's first message
        assistant_response: The assistant's first response
        org_id: Optional organization ID for context-aware key fetching
        team_id: Optional team ID for context-aware key fetching

    Returns:
        A short title (5-7 words) summarizing the conversation topic
    """
    llm = get_chat_model_with_context(org_id, team_id) if org_id else get_chat_model()

    prompt = f"""Generate a very short title (3-6 words max) that summarizes this conversation topic.
The title should be descriptive and help the user identify the conversation later.
Do NOT use quotes or punctuation. Just output the title text.

User: {user_message[:500]}
Assistant: {assistant_response[:500]}

Title:"""

    try:
        response = await llm.ainvoke(prompt)
        title = str(response.content).strip()
        title = title.strip("\"'").strip()
        if len(title) > MAX_TITLE_LENGTH:
            title = title[: MAX_TITLE_LENGTH - 3] + "..."
        return title or user_message[:MAX_TITLE_LENGTH]
    except Exception as e:
        logger.warning("title_generation_failed", error=str(e))
        return user_message[:MAX_TITLE_LENGTH] + (
            "..." if len(user_message) > MAX_TITLE_LENGTH else ""
        )
