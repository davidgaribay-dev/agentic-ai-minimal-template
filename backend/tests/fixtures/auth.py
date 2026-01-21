"""Authentication fixtures for testing.

Provides fixtures for:
- Sample user objects (non-persisted, for unit tests)
- Authentication headers
- Token generation helpers
"""

from collections.abc import Callable
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from backend.auth import User
from backend.core.security import get_password_hash

from tests.constants import (
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_FULL_NAME,
    TEST_ADMIN_PASSWORD,
    TEST_USER_EMAIL,
    TEST_USER_FULL_NAME,
    TEST_USER_PASSWORD,
)


@pytest.fixture
def sample_user_id() -> str:
    """Generate a sample user UUID.

    Returns:
        String UUID for test user identification
    """
    return str(uuid4())


@pytest.fixture
def sample_org_id() -> str:
    """Generate a sample organization UUID.

    Returns:
        String UUID for test organization identification
    """
    return str(uuid4())


@pytest.fixture
def sample_team_id() -> str:
    """Generate a sample team UUID.

    Returns:
        String UUID for test team identification
    """
    return str(uuid4())


@pytest.fixture
def sample_user(sample_user_id: str) -> User:
    """Create a sample user for testing (not persisted to DB).

    Uses dynamically hashed password instead of hardcoded hash
    for better maintainability.

    Args:
        sample_user_id: Generated UUID for the user

    Returns:
        User object suitable for unit tests
    """
    return User(
        id=sample_user_id,
        email=TEST_USER_EMAIL,
        full_name=TEST_USER_FULL_NAME,
        hashed_password=get_password_hash(TEST_USER_PASSWORD),
        is_active=True,
        is_platform_admin=False,
    )


@pytest.fixture
def sample_admin_user(sample_user_id: str) -> User:
    """Create a sample admin user for testing (not persisted to DB).

    Args:
        sample_user_id: Generated UUID for the user

    Returns:
        Admin User object suitable for unit tests
    """
    return User(
        id=sample_user_id,
        email=TEST_ADMIN_EMAIL,
        full_name=TEST_ADMIN_FULL_NAME,
        hashed_password=get_password_hash(TEST_ADMIN_PASSWORD),
        is_active=True,
        is_platform_admin=True,
    )


@pytest.fixture
def auth_headers(sample_user_id: str) -> dict[str, str]:
    """Generate mock authorization headers.

    For unit tests that just need headers to be present.
    For integration tests, use auth_headers_factory with real login.

    Args:
        sample_user_id: User ID to include in mock token

    Returns:
        Dictionary with Authorization header
    """
    return {"Authorization": f"Bearer mock-token-{sample_user_id}"}


@pytest.fixture
def auth_headers_factory(
    client: TestClient,
) -> Callable[[str, str], dict[str, str]]:
    """Factory fixture to get real auth headers by logging in.

    For integration tests that need valid JWT tokens.

    Args:
        client: FastAPI TestClient fixture

    Returns:
        Function that takes (email, password) and returns auth headers

    Example:
        def test_protected_route(client, auth_headers_factory, test_user):
            headers = auth_headers_factory("user@example.com", "password123")
            response = client.get("/v1/protected", headers=headers)
    """

    def _get_auth_headers(email: str, password: str) -> dict[str, str]:
        response = client.post(
            "/v1/auth/login",
            data={"username": email, "password": password},
        )
        if response.status_code != 200:
            msg = f"Login failed: {response.text}"
            raise ValueError(msg)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _get_auth_headers


def get_auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    """Get authentication headers by logging in a user.

    Standalone function for use outside of fixtures.

    Args:
        client: FastAPI TestClient
        email: User email
        password: User password

    Returns:
        Dictionary with Authorization header

    Raises:
        AssertionError: If login fails
    """
    response = client.post(
        "/v1/auth/login",
        data={"username": email, "password": password},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
