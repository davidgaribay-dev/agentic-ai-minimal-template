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
    "auth_headers",
    "auth_headers_factory",
    "client",
    "context_vars_cleanup",
    "create_test_organization",
    "create_test_team",
    "create_test_user",
    "db_session",
    "mock_audit_service",
    "mock_memory_store",
    "mock_secrets_service",
    "mock_session",
    "sample_admin_user",
    "sample_user",
    "sample_user_id",
    "test_engine",
]
