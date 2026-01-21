"""Tests for the auth security module (password hashing, JWT tokens).

Tests follow FIRST principles:
- Fast: Unit tests without external dependencies
- Independent: Each test is self-contained
- Repeatable: Deterministic results
- Self-verifying: Clear assertions
- Timely: Written alongside the code
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
import pytest

from backend.core.security import (
    create_access_token,
    create_refresh_token,
    create_token_pair,
    decode_token,
    get_password_hash,
    verify_password,
)


class TestPasswordHashing:
    """Tests for password hashing functions."""

    def test_returns_bcrypt_hash(self):
        """get_password_hash returns a valid bcrypt hash."""
        # Arrange
        password = "mysecretpassword"

        # Act
        hashed = get_password_hash(password)

        # Assert
        assert hashed != password
        assert hashed.startswith("$2b$")  # bcrypt prefix
        assert len(hashed) == 60  # bcrypt hash length

    def test_uses_unique_salt_each_time(self):
        """Same password produces different hashes due to unique salts."""
        # Arrange
        password = "mysecretpassword"

        # Act
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Assert
        assert hash1 != hash2

    @pytest.mark.parametrize(
        ("password", "should_match"),
        [
            ("correctpassword", True),
            ("wrongpassword", False),
            ("CORRECTPASSWORD", False),  # Case sensitive
            ("correctpassword ", False),  # Trailing space
            (" correctpassword", False),  # Leading space
        ],
    )
    def test_verify_password_matching(self, password: str, should_match: bool):
        """verify_password correctly validates passwords."""
        # Arrange
        original = "correctpassword"
        hashed = get_password_hash(original)

        # Act & Assert
        assert verify_password(password, hashed) is should_match

    def test_verify_empty_password(self):
        """Empty passwords can be hashed and verified."""
        # Arrange
        hashed = get_password_hash("")

        # Act & Assert
        assert verify_password("", hashed) is True
        assert verify_password("notempty", hashed) is False

    def test_verify_unicode_password(self):
        """Unicode passwords are handled correctly."""
        # Arrange
        password = "пароль日本語🔐"
        hashed = get_password_hash(password)

        # Act & Assert
        assert verify_password(password, hashed) is True

    def test_verify_long_password(self):
        """Long passwords are handled (bcrypt truncates at 72 bytes)."""
        # Arrange - password longer than 72 bytes
        password = "a" * 100
        hashed = get_password_hash(password)

        # Act & Assert
        assert verify_password(password, hashed) is True


class TestAccessToken:
    """Tests for access token creation."""

    def test_contains_required_claims(self):
        """Access token contains all required JWT claims."""
        # Arrange
        user_id = str(uuid4())

        # Act
        token, jti, _ = create_access_token(user_id)
        decoded = decode_token(token)

        # Assert
        assert decoded["sub"] == user_id
        assert decoded["type"] == "access"
        assert decoded["jti"] == jti
        assert "exp" in decoded
        assert "iat" in decoded

    def test_custom_expiry_is_respected(self):
        """Custom expiry delta is applied correctly."""
        # Arrange
        user_id = str(uuid4())
        custom_delta = timedelta(hours=2)

        # Act
        _, _, expires_at = create_access_token(user_id, expires_delta=custom_delta)
        now = datetime.now(UTC)

        # Assert - allow 1 minute tolerance for test execution time
        expected_min = now + timedelta(hours=1, minutes=59)
        expected_max = now + timedelta(hours=2, minutes=1)
        assert expected_min < expires_at < expected_max

    def test_generates_unique_jti_each_call(self):
        """Each token gets a unique JTI for revocation tracking."""
        # Arrange
        user_id = str(uuid4())

        # Act
        _, jti1, _ = create_access_token(user_id)
        _, jti2, _ = create_access_token(user_id)

        # Assert
        assert jti1 != jti2


class TestRefreshToken:
    """Tests for refresh token creation."""

    def test_contains_required_claims(self):
        """Refresh token contains all required JWT claims."""
        # Arrange
        user_id = str(uuid4())

        # Act
        token, jti, _ = create_refresh_token(user_id)
        decoded = decode_token(token)

        # Assert
        assert decoded["sub"] == user_id
        assert decoded["type"] == "refresh"
        assert decoded["jti"] == jti
        assert "exp" in decoded
        assert "iat" in decoded

    def test_custom_expiry_is_respected(self):
        """Custom expiry delta is applied correctly."""
        # Arrange
        user_id = str(uuid4())
        custom_delta = timedelta(days=30)

        # Act
        _, _, expires_at = create_refresh_token(user_id, expires_delta=custom_delta)
        now = datetime.now(UTC)

        # Assert - allow 1 hour tolerance
        expected_min = now + timedelta(days=29, hours=23)
        expected_max = now + timedelta(days=30, hours=1)
        assert expected_min < expires_at < expected_max


class TestTokenPair:
    """Tests for creating access/refresh token pairs."""

    def test_returns_both_token_types(self):
        """Token pair contains both access and refresh tokens."""
        # Arrange
        user_id = str(uuid4())

        # Act
        access_token, refresh_token, _ = create_token_pair(user_id)
        access_decoded = decode_token(access_token)
        refresh_decoded = decode_token(refresh_token)

        # Assert
        assert access_decoded["type"] == "access"
        assert refresh_decoded["type"] == "refresh"

    def test_tokens_have_same_subject(self):
        """Both tokens reference the same user."""
        # Arrange
        user_id = str(uuid4())

        # Act
        access_token, refresh_token, _ = create_token_pair(user_id)
        access_decoded = decode_token(access_token)
        refresh_decoded = decode_token(refresh_token)

        # Assert
        assert access_decoded["sub"] == user_id
        assert refresh_decoded["sub"] == user_id

    def test_returns_expires_in_seconds(self):
        """expires_in is returned in seconds."""
        # Arrange
        user_id = str(uuid4())

        # Act
        _, _, expires_in = create_token_pair(user_id)

        # Assert - should be a positive integer representing seconds
        assert isinstance(expires_in, int)
        assert expires_in > 0


class TestDecodeToken:
    """Tests for token decoding and validation."""

    def test_decodes_valid_token(self):
        """Valid token is decoded successfully."""
        # Arrange
        user_id = str(uuid4())
        token, _, _ = create_access_token(user_id)

        # Act
        decoded = decode_token(token)

        # Assert
        assert decoded["sub"] == user_id
        assert decoded["type"] == "access"

    def test_raises_on_expired_token(self):
        """Expired token raises ExpiredSignatureError."""
        # Arrange
        user_id = str(uuid4())
        token, _, _ = create_access_token(user_id, expires_delta=timedelta(seconds=-1))

        # Act & Assert
        with pytest.raises(jwt.ExpiredSignatureError):
            decode_token(token)

    def test_raises_on_invalid_token_format(self):
        """Invalid token format raises DecodeError."""
        # Act & Assert
        with pytest.raises(jwt.DecodeError):
            decode_token("invalid-token")

    def test_raises_on_tampered_token(self):
        """Tampered token raises InvalidSignatureError."""
        # Arrange
        user_id = str(uuid4())
        token, _, _ = create_access_token(user_id)
        tampered = token[:-5] + "XXXXX"

        # Act & Assert
        with pytest.raises(jwt.InvalidSignatureError):
            decode_token(tampered)

    def test_raises_on_empty_token(self):
        """Empty token raises DecodeError."""
        # Act & Assert
        with pytest.raises(jwt.DecodeError):
            decode_token("")
