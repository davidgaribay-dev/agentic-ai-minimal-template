"""Test fixtures package.

This package contains organized fixtures for different testing concerns:
- database.py: Database session and transaction fixtures
- factories.py: Factory functions for creating test domain objects
- mocks.py: Mock services (secrets, audit, memory, etc.)
- auth.py: Authentication-related fixtures and helpers
- agents.py: LangGraph agent testing fixtures

All fixtures are re-exported here for convenient imports in conftest.py.
"""

from tests.fixtures.auth import (
    auth_headers,
    auth_headers_factory,
    sample_admin_user,
    sample_user,
    sample_user_id,
)
from tests.fixtures.database import (
    client,
    db_session,
    test_engine,
)
from tests.fixtures.factories import (
    create_test_organization,
    create_test_team,
    create_test_user,
)
from tests.fixtures.mocks import (
    context_vars_cleanup,
    mock_audit_service,
    mock_memory_store,
    mock_secrets_service,
    mock_session,
)

__all__ = [
    # Database fixtures
    "db_session",
    "client",
    "test_engine",
    # Auth fixtures
    "sample_user_id",
    "sample_user",
    "sample_admin_user",
    "auth_headers",
    "auth_headers_factory",
    # Factory functions
    "create_test_user",
    "create_test_organization",
    "create_test_team",
    # Mock fixtures
    "mock_session",
    "mock_secrets_service",
    "mock_audit_service",
    "mock_memory_store",
    "context_vars_cleanup",
]
