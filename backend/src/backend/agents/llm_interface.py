"""LLM Provider abstraction layer for testable agent interactions.

This module defines protocols and implementations for LLM providers,
enabling dependency injection and test mocking of language model calls.

Key components:
- LLMProvider: Protocol for LLM provider implementations
- AnthropicProvider, OpenAIProvider, GoogleProvider: Concrete implementations
- LLMFactory: Factory for creating providers with DI support

Example usage in routes:
    @router.post("/chat")
    async def chat(llm_factory: LLMFactoryDep):
        provider = llm_factory.get_provider("anthropic", org_id, team_id)
        model = provider.get_model(temperature=0.7)
        response = await model.ainvoke(messages)

Example test override:
    mock_provider = MagicMock(spec=LLMProvider)
    mock_provider.get_model.return_value = mock_model
    app.dependency_overrides[get_llm_factory_dep] = lambda: MockLLMFactory(mock_provider)
"""

from typing import Annotated, Protocol, runtime_checkable

from fastapi import Depends
from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI

from backend.core.config import settings
from backend.core.logging import get_logger
from backend.core.secrets import SecretsService, get_secrets_service

logger = get_logger(__name__)


# =============================================================================
# LLM Provider Protocol
# =============================================================================


@runtime_checkable
class LLMProvider(Protocol):
    """Protocol defining the interface for LLM providers.

    Implementations must provide get_model() to create configured chat models.
    Using Protocol enables duck typing and makes mocking straightforward.
    """

    def get_model(
        self,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> BaseChatModel:
        """Create a configured chat model instance.

        Args:
            model: Model name override (uses default if None)
            temperature: Temperature setting (uses default if None)
            max_tokens: Max tokens setting (uses default if None)

        Returns:
            Configured BaseChatModel instance
        """
        ...


# =============================================================================
# Provider Implementations
# =============================================================================


class AnthropicProvider:
    """LLM provider for Anthropic Claude models."""

    DEFAULT_MODEL = "claude-sonnet-4-20250514"
    DEFAULT_MAX_TOKENS = 4096

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def get_model(
        self,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> BaseChatModel:
        """Create an Anthropic chat model instance."""
        return ChatAnthropic(
            model=model or self.DEFAULT_MODEL,
            api_key=self.api_key,
            max_tokens=max_tokens or self.DEFAULT_MAX_TOKENS,
            temperature=temperature,
        )


class OpenAIProvider:
    """LLM provider for OpenAI models."""

    DEFAULT_MODEL = "gpt-4o"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def get_model(
        self,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> BaseChatModel:
        """Create an OpenAI chat model instance."""
        kwargs: dict[str, str | float | int] = {
            "model": model or self.DEFAULT_MODEL,
            "api_key": self.api_key,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens

        return ChatOpenAI(**kwargs)


class GoogleProvider:
    """LLM provider for Google Generative AI models."""

    DEFAULT_MODEL = "gemini-2.0-flash"

    def __init__(self, api_key: str) -> None:
        self.api_key = api_key

    def get_model(
        self,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> BaseChatModel:
        """Create a Google Generative AI chat model instance."""
        kwargs: dict[str, str | float | int] = {
            "model": model or self.DEFAULT_MODEL,
            "google_api_key": self.api_key,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if max_tokens is not None:
            kwargs["max_output_tokens"] = max_tokens

        return ChatGoogleGenerativeAI(**kwargs)


# =============================================================================
# LLM Factory
# =============================================================================


# Provider registry mapping names to implementation classes
PROVIDER_REGISTRY: dict[str, type[AnthropicProvider | OpenAIProvider | GoogleProvider]] = {
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "google": GoogleProvider,
}


class LLMFactory:
    """Factory for creating LLM providers with dependency injection.

    Uses SecretsService for API key resolution with org/team scoping.
    Supports test mocking via dependency overrides.

    Example:
        factory = LLMFactory(secrets_service)
        provider = factory.get_provider("anthropic", org_id, team_id)
        model = provider.get_model(temperature=0.7)
    """

    def __init__(self, secrets: SecretsService) -> None:
        self.secrets = secrets

    def get_provider(
        self,
        provider_name: str,
        org_id: str,
        team_id: str | None = None,
    ) -> LLMProvider:
        """Get an LLM provider instance with resolved API key.

        Args:
            provider_name: Provider name ("anthropic", "openai", "google")
            org_id: Organization ID for API key scoping
            team_id: Optional team ID for team-level key override

        Returns:
            Configured LLMProvider instance

        Raises:
            ValueError: If provider not supported or API key not configured
        """
        if provider_name not in PROVIDER_REGISTRY:
            raise ValueError(f"Unsupported LLM provider: {provider_name}")

        # Resolve API key using secrets service
        api_key = self.secrets.get_llm_api_key(provider_name, org_id, team_id)
        if not api_key:
            # Fall back to environment variable for the provider
            env_keys = {
                "anthropic": settings.ANTHROPIC_API_KEY,
                "openai": settings.OPENAI_API_KEY,
                "google": settings.GOOGLE_API_KEY,
            }
            api_key = env_keys.get(provider_name)

        if not api_key:
            raise ValueError(
                f"No API key configured for {provider_name}. "
                f"Configure via organization settings or environment variable."
            )

        provider_class = PROVIDER_REGISTRY[provider_name]
        return provider_class(api_key)

    def get_available_providers(
        self,
        org_id: str,
        team_id: str | None = None,
    ) -> list[str]:
        """Get list of providers with configured API keys.

        Args:
            org_id: Organization ID
            team_id: Optional team ID

        Returns:
            List of provider names that have API keys configured
        """
        available = []
        for provider_name in PROVIDER_REGISTRY:
            try:
                # Check if we can get the provider (has API key)
                api_key = self.secrets.get_llm_api_key(provider_name, org_id, team_id)
                if api_key:
                    available.append(provider_name)
                    continue

                # Check env fallback
                env_keys = {
                    "anthropic": settings.ANTHROPIC_API_KEY,
                    "openai": settings.OPENAI_API_KEY,
                    "google": settings.GOOGLE_API_KEY,
                }
                if env_keys.get(provider_name):
                    available.append(provider_name)
            except Exception:
                pass

        return available


# =============================================================================
# Dependency Injection
# =============================================================================

_llm_factory: LLMFactory | None = None


def get_llm_factory() -> LLMFactory:
    """Get or create the LLM factory singleton."""
    global _llm_factory
    if _llm_factory is None:
        _llm_factory = LLMFactory(get_secrets_service())
    return _llm_factory


def get_llm_factory_dep() -> LLMFactory:
    """FastAPI dependency for LLM factory.

    Use this with Depends() in route handlers:

        @router.post("/chat")
        async def chat(llm_factory: LLMFactoryDep):
            provider = llm_factory.get_provider("anthropic", org_id)

    Tests can override via app.dependency_overrides:

        app.dependency_overrides[get_llm_factory_dep] = lambda: mock_factory
    """
    return get_llm_factory()


LLMFactoryDep = Annotated[LLMFactory, Depends(get_llm_factory_dep)]
