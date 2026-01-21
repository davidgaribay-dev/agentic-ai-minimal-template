"""Shared fixtures for backend tests.

This module provides reusable pytest fixtures for testing the backend application.

Fixtures are organized into modules under tests/fixtures/:
- database.py: Database session and TestClient fixtures
- factories.py: Factory functions for creating test domain objects
- mocks.py: Mock services (secrets, audit, memory, etc.)
- auth.py: Authentication-related fixtures and helpers
- agents.py: LangGraph agent testing fixtures

All fixtures from these modules are imported here for pytest discovery.
"""

# Re-export all fixtures from the fixtures package for pytest discovery
# Note: pytest automatically discovers fixtures from conftest.py files

from tests.fixtures.auth import (
    auth_headers,
    auth_headers_factory,
    sample_admin_user,
    sample_org_id,
    sample_team_id,
    sample_user,
    sample_user_id,
)
from tests.fixtures.database import (
    client,
    db_session,
)
from tests.fixtures.factories import (
    create_test_admin_user,
    create_test_org_member,
    create_test_organization,
    create_test_team,
    create_test_team_member,
    create_test_user,
)
from tests.fixtures.mocks import (
    context_vars_cleanup,
    mock_audit_service,
    mock_memory_store,
    mock_secrets_service,
    mock_session,
)
from tests.fixtures.agents import (
    agent_context,
    fake_llm,
    fake_llm_responses,
    in_memory_checkpointer,
    mock_embeddings,
    mock_mcp_client,
    mock_tool_executor,
    mock_vector_store,
)

# Export factory functions as fixtures for convenience
import pytest
from sqlmodel import Session

from backend.auth import User
from tests.constants import (
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
)


@pytest.fixture
def test_user(db_session: Session) -> User:
    """Create a standard test user persisted to the database."""
    return create_test_user(
        db_session,
        email=TEST_USER_EMAIL,
        password=TEST_USER_PASSWORD,
        full_name="Test User",
    )


@pytest.fixture
def test_admin_user(db_session: Session) -> User:
    """Create a platform admin test user persisted to the database."""
    return create_test_admin_user(
        db_session,
        email=TEST_ADMIN_EMAIL,
        password=TEST_ADMIN_PASSWORD,
        full_name="Admin User",
    )


# Re-export all fixtures for pytest discovery
__all__ = [
    # Database fixtures
    "db_session",
    "client",
    # Auth fixtures
    "sample_user_id",
    "sample_org_id",
    "sample_team_id",
    "sample_user",
    "sample_admin_user",
    "auth_headers",
    "auth_headers_factory",
    "test_user",
    "test_admin_user",
    # Mock fixtures
    "mock_session",
    "mock_secrets_service",
    "mock_audit_service",
    "mock_memory_store",
    "context_vars_cleanup",
    # Agent fixtures
    "fake_llm",
    "fake_llm_responses",
    "in_memory_checkpointer",
    "mock_vector_store",
    "mock_embeddings",
    "mock_tool_executor",
    "mock_mcp_client",
    "agent_context",
    # Factory functions (not fixtures, but useful)
    "create_test_user",
    "create_test_admin_user",
    "create_test_organization",
    "create_test_team",
    "create_test_org_member",
    "create_test_team_member",
]
