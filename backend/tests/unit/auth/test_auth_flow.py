"""Tests for authentication flow (signup, login, token refresh, logout).

Tests follow FIRST principles:
- Fast: Uses test database with transaction rollback
- Independent: Each test has isolated database state
- Repeatable: Deterministic results
- Self-verifying: Clear assertions
- Timely: Written alongside the code

These are integration tests that exercise the full auth flow
through the API endpoints.

NOTE: These tests require PostgreSQL due to JSONB columns in audit_logs.
They are skipped when running with SQLite (default test database).
Run with a PostgreSQL test database for full integration testing.
"""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

# Skip all tests in this module - requires PostgreSQL (JSONB columns in audit_logs)
pytestmark = pytest.mark.skip(
    reason="Integration tests require PostgreSQL (SQLite doesn't support JSONB)"
)

from tests.conftest import create_test_user
from tests.constants import (
    HTTP_BAD_REQUEST,
    HTTP_OK,
    HTTP_UNAUTHORIZED,
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
)


@pytest.mark.auth
@pytest.mark.integration
class TestSignup:
    """Tests for user registration."""

    def test_successful_signup_creates_user_org_and_team(
        self, client: TestClient
    ) -> None:
        """New user signup creates user, organization, and default team."""
        # Arrange
        email = "newuser@example.com"
        password = "SecureP@ss123!"

        # Act
        response = client.post(
            "/v1/auth/signup",
            data={
                "email": email,
                "password": password,
                "full_name": "New User",
                "organization_name": "New Org",
            },
        )

        # Assert
        assert response.status_code == HTTP_OK
        data = response.json()
        assert data["email"] == email
        assert data["full_name"] == "New User"
        assert "id" in data
        # Password should not be returned
        assert "password" not in data
        assert "hashed_password" not in data

    def test_signup_auto_generates_org_name(self, client: TestClient) -> None:
        """Signup without org name auto-generates from email."""
        # Arrange
        email = "autoname@company.com"
        password = "SecureP@ss123!"

        # Act
        response = client.post(
            "/v1/auth/signup",
            data={
                "email": email,
                "password": password,
            },
        )

        # Assert
        assert response.status_code == HTTP_OK

    def test_duplicate_email_rejected(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Cannot signup with an existing email."""
        # Arrange - create existing user
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)

        # Act
        response = client.post(
            "/v1/auth/signup",
            data={
                "email": TEST_USER_EMAIL,
                "password": "AnotherP@ss123!",
            },
        )

        # Assert
        assert response.status_code == HTTP_BAD_REQUEST
        assert "already exists" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestLogin:
    """Tests for user login."""

    def test_successful_login_returns_tokens(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Valid credentials return access and refresh tokens."""
        # Arrange
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)

        # Act
        response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )

        # Assert
        assert response.status_code == HTTP_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert "expires_in" in data
        assert data["expires_in"] > 0

    def test_invalid_email_rejected(self, client: TestClient) -> None:
        """Login with non-existent email is rejected."""
        # Act
        response = client.post(
            "/v1/auth/login",
            data={"username": "nonexistent@example.com", "password": "anypassword"},
        )

        # Assert
        assert response.status_code == HTTP_BAD_REQUEST
        assert "incorrect" in response.json()["detail"].lower()

    def test_invalid_password_rejected(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Login with wrong password is rejected."""
        # Arrange
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)

        # Act
        response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": "wrongpassword"},
        )

        # Assert
        assert response.status_code == HTTP_BAD_REQUEST
        assert "incorrect" in response.json()["detail"].lower()

    def test_inactive_user_cannot_login(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Inactive users cannot login."""
        # Arrange
        create_test_user(
            db_session,
            email=TEST_USER_EMAIL,
            password=TEST_USER_PASSWORD,
            is_active=False,
        )

        # Act
        response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )

        # Assert
        assert response.status_code == HTTP_BAD_REQUEST
        assert "inactive" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestTokenRefresh:
    """Tests for token refresh flow."""

    def test_valid_refresh_returns_new_tokens(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Valid refresh token returns new access and refresh tokens."""
        # Arrange - login to get tokens
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)
        login_response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )
        refresh_token = login_response.json()["refresh_token"]

        # Act
        response = client.post(
            "/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        # Assert
        assert response.status_code == HTTP_OK
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New refresh token should be different (token rotation)
        assert data["refresh_token"] != refresh_token

    def test_refresh_token_can_only_be_used_once(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Refresh tokens are revoked after use (token rotation)."""
        # Arrange
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)
        login_response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )
        refresh_token = login_response.json()["refresh_token"]

        # Use the refresh token once
        client.post(
            "/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        # Act - try to use the same refresh token again
        response = client.post(
            "/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        # Assert
        assert response.status_code == HTTP_UNAUTHORIZED
        assert "already been used" in response.json()["detail"].lower()

    def test_invalid_refresh_token_rejected(self, client: TestClient) -> None:
        """Invalid refresh token is rejected."""
        # Act
        response = client.post(
            "/v1/auth/refresh",
            json={"refresh_token": "invalid-token"},
        )

        # Assert
        assert response.status_code == HTTP_UNAUTHORIZED

    def test_access_token_cannot_be_used_for_refresh(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Access token cannot be used as refresh token."""
        # Arrange
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)
        login_response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )
        access_token = login_response.json()["access_token"]

        # Act
        response = client.post(
            "/v1/auth/refresh",
            json={"refresh_token": access_token},
        )

        # Assert
        assert response.status_code == HTTP_UNAUTHORIZED
        assert "invalid token type" in response.json()["detail"].lower()


@pytest.mark.auth
@pytest.mark.integration
class TestTestToken:
    """Tests for the test-token endpoint."""

    def test_valid_token_returns_user(
        self, client: TestClient, db_session: Session
    ) -> None:
        """Valid access token returns user info."""
        # Arrange
        create_test_user(db_session, email=TEST_USER_EMAIL, password=TEST_USER_PASSWORD)
        login_response = client.post(
            "/v1/auth/login",
            data={"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD},
        )
        access_token = login_response.json()["access_token"]

        # Act
        response = client.post(
            "/v1/auth/test-token",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        # Assert
        assert response.status_code == HTTP_OK
        data = response.json()
        assert data["email"] == TEST_USER_EMAIL

    def test_no_token_rejected(self, client: TestClient) -> None:
        """Request without token is rejected."""
        # Act
        response = client.post("/v1/auth/test-token")

        # Assert
        assert response.status_code == HTTP_UNAUTHORIZED

    def test_invalid_token_rejected(self, client: TestClient) -> None:
        """Invalid token is rejected."""
        # Act
        response = client.post(
            "/v1/auth/test-token",
            headers={"Authorization": "Bearer invalid-token"},
        )

        # Assert
        assert response.status_code == HTTP_UNAUTHORIZED
