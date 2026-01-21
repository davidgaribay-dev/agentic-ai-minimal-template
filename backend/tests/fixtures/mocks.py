"""Mock fixtures for unit tests.

Provides pre-configured mock objects for services that should not
make real external calls during unit tests:
- SecretsService: Encrypted secrets storage
- AuditService: Audit logging
- MemoryStore: LangGraph memory (requires embeddings)

These mocks have sensible default return values that can be
overridden in individual tests.
"""

from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from sqlmodel import Session

from backend.audit import AuditService
from backend.core.cache import clear_request_cache
from backend.core.secrets import SecretsService


@pytest.fixture
def mock_session() -> MagicMock:
    """Create a mock database session for pure unit tests.

    Use this when you don't need a real database but need to pass
    a session to functions.

    Returns:
        MagicMock with Session spec
    """
    return MagicMock(spec=Session)


@pytest.fixture
def mock_secrets_service() -> MagicMock:
    """Mock secrets service for unit tests.

    Provides pre-configured return values for common operations.
    Override specific methods in individual tests as needed.

    Example:
        def test_with_no_api_key(mock_secrets_service):
            mock_secrets_service.get_llm_api_key.return_value = None
            # Test handles missing API key

    Returns:
        MagicMock with SecretsService spec and default return values
    """
    mock = MagicMock(spec=SecretsService)
    # Default return values for common operations
    mock.get_llm_api_key.return_value = "test-api-key-mock"
    mock.list_api_key_status.return_value = [
        {
            "provider": "anthropic",
            "is_configured": True,
            "level": "org",
            "has_team_override": False,
            "has_org_key": True,
            "has_env_fallback": False,
        }
    ]
    mock.check_api_key_status.return_value = {
        "provider": "anthropic",
        "is_configured": True,
        "level": "org",
        "has_team_override": False,
        "has_org_key": True,
        "has_env_fallback": False,
    }
    mock.get_default_provider.return_value = "anthropic"
    mock.set_llm_api_key.return_value = True
    mock.delete_llm_api_key.return_value = True
    mock.get_mcp_auth_secret.return_value = None
    mock.set_mcp_auth_secret.return_value = "mcp_secret_ref"
    mock.delete_mcp_auth_secret.return_value = True
    return mock


@pytest.fixture
def mock_audit_service() -> AsyncMock:
    """Mock audit service for unit tests.

    Provides async mock that doesn't write to database.
    Captures all log calls for verification in tests.

    Example:
        async def test_audit_logging(mock_audit_service):
            await some_operation()
            mock_audit_service.log.assert_called_once()

    Returns:
        AsyncMock with AuditService spec and default return values
    """
    mock = AsyncMock(spec=AuditService)
    # Return a valid event ID
    mock.log.return_value = str(uuid4())
    mock.log_app.return_value = str(uuid4())
    mock.start.return_value = None
    mock.stop.return_value = None
    mock.get_stats.return_value = {
        "queue_size": 0,
        "queue_max_size": 10000,
        "dropped_count": 0,
        "running": True,
    }
    return mock


@pytest.fixture
def mock_memory_store() -> AsyncMock:
    """Mock memory store for unit tests.

    Provides async mock for LangGraph PostgresStore.
    Avoids OpenAI embedding calls during tests.

    Example:
        async def test_memory_search(mock_memory_store):
            mock_memory_store.search.return_value = [mock_memory_item]
            results = await search_memories(...)

    Returns:
        AsyncMock with default empty results
    """
    mock = AsyncMock()
    # Default empty results for search
    mock.search.return_value = []
    mock.get.return_value = None
    mock.put.return_value = None
    mock.delete.return_value = None
    mock.list_namespaces.return_value = []
    return mock


@pytest.fixture
def context_vars_cleanup() -> Generator[None, None, None]:
    """Clean up context vars after each test.

    Ensures request-scoped caches don't leak between tests.

    Yields:
        None (cleanup happens after test)
    """
    yield
    clear_request_cache()
