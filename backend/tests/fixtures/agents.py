"""LangGraph agent testing fixtures.

Provides fixtures for testing the agent system without making
real LLM API calls:
- FakeListLLM for deterministic responses
- InMemorySaver for checkpoint testing
- Mock vector stores for RAG testing
"""

from typing import Any
from unittest.mock import AsyncMock, MagicMock

from langchain_core.language_models import FakeListLLM
from langgraph.checkpoint.memory import MemorySaver
import pytest

from tests.constants import TEST_ASSISTANT_RESPONSE


@pytest.fixture
def fake_llm_responses() -> list[str]:
    """Default responses for FakeListLLM.

    Override this fixture in tests that need different responses.

    Returns:
        List of response strings the fake LLM will cycle through
    """
    return [TEST_ASSISTANT_RESPONSE]


@pytest.fixture
def fake_llm(fake_llm_responses: list[str]) -> Any:
    """Create a FakeListLLM for deterministic testing.

    Uses LangChain's FakeListLLM which returns predefined responses
    in sequence, enabling deterministic agent testing.

    Args:
        fake_llm_responses: List of responses to return

    Returns:
        FakeListLLM instance
    """
    return FakeListLLM(responses=fake_llm_responses)


@pytest.fixture
def in_memory_checkpointer() -> Any:
    """Create an InMemorySaver for agent state testing.

    Provides a checkpointer that stores state in memory,
    suitable for testing conversation persistence without
    a real database.

    Returns:
        MemorySaver instance
    """
    return MemorySaver()


@pytest.fixture
def mock_vector_store() -> AsyncMock:
    """Mock vector store for RAG testing.

    Provides an async mock for similarity search operations.

    Returns:
        AsyncMock configured for vector store operations
    """
    mock = AsyncMock()
    mock.similarity_search.return_value = []
    mock.similarity_search_with_score.return_value = []
    mock.add_documents.return_value = None
    mock.delete.return_value = None
    return mock


@pytest.fixture
def mock_embeddings() -> MagicMock:
    """Mock embeddings model for testing.

    Returns a mock that provides consistent embedding vectors.

    Returns:
        MagicMock configured for embedding operations
    """
    mock = MagicMock()
    # Return a consistent 1536-dimension vector (OpenAI embedding size)
    embedding_dim = 1536
    mock.embed_query.return_value = [0.1] * embedding_dim
    mock.embed_documents.return_value = [[0.1] * embedding_dim]
    return mock


@pytest.fixture
def mock_tool_executor() -> AsyncMock:
    """Mock tool executor for testing tool calls.

    Returns:
        AsyncMock for tool execution
    """
    mock = AsyncMock()
    mock.execute.return_value = {"result": "Tool executed successfully"}
    return mock


@pytest.fixture
def mock_mcp_client() -> AsyncMock:
    """Mock MCP client for testing MCP server integration.

    Returns:
        AsyncMock configured for MCP operations
    """
    mock = AsyncMock()
    mock.list_tools.return_value = []
    mock.call_tool.return_value = {"result": "MCP tool result"}
    mock.connect.return_value = None
    mock.disconnect.return_value = None
    return mock


@pytest.fixture
def agent_context() -> dict[str, Any]:
    """Default agent context for testing.

    Provides a minimal context dict for agent initialization.

    Returns:
        Dictionary with agent context values
    """
    return {
        "user_id": "test-user-id",
        "org_id": "test-org-id",
        "team_id": "test-team-id",
        "conversation_id": "test-conversation-id",
        "thread_id": "test-thread-id",
    }
