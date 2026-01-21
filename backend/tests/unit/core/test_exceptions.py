"""Tests for the core exceptions module."""


from backend.core.exceptions import (
    AppException,
    AuthenticationError,
    AuthorizationError,
    ExternalServiceError,
    LLMConfigurationError,
    LLMInvocationError,
    MCPServerError,
    MCPToolNotFoundError,
    RateLimitError,
    ResourceExistsError,
    ResourceNotFoundError,
    TimeoutError,
    ToolApprovalRequiredError,
    ToolExecutionError,
    ValidationError,
)


class TestAppException:
    """Tests for the base AppException class."""

    def test_basic_exception(self):
        exc = AppException(
            message="Something went wrong",
            error_code="TEST_ERROR",
            status_code=500,
        )
        assert exc.message == "Something went wrong"
        assert exc.error_code == "TEST_ERROR"
        assert exc.status_code == 500
        assert exc.details == {}
        assert exc.message_key is None
        assert exc.params == {}

    def test_exception_with_details(self):
        exc = AppException(
            message="Error with details",
            error_code="DETAILED_ERROR",
            status_code=400,
            details={"field": "email", "reason": "invalid format"},
        )
        assert exc.details == {"field": "email", "reason": "invalid format"}

    def test_exception_with_i18n(self):
        exc = AppException(
            message="Fallback message",
            error_code="I18N_ERROR",
            message_key="error_i18n_test",
            params={"name": "value"},
        )
        assert exc.message_key == "error_i18n_test"
        assert exc.params == {"name": "value"}

    def test_to_dict_basic(self):
        exc = AppException(
            message="Test error",
            error_code="TEST",
            status_code=500,
        )
        result = exc.to_dict()
        assert result == {
            "error_code": "TEST",
            "message": "Test error",
            "details": {},
        }

    def test_to_dict_with_message_key(self):
        exc = AppException(
            message="Test error",
            error_code="TEST",
            message_key="error_test_key",
        )
        result = exc.to_dict()
        assert "message_key" in result
        assert result["message_key"] == "error_test_key"


class TestAuthenticationError:
    """Tests for AuthenticationError."""

    def test_default_message(self):
        exc = AuthenticationError()
        assert exc.message == "Authentication failed"
        assert exc.error_code == "AUTH_FAILED"
        assert exc.status_code == 401
        assert exc.message_key == "error_auth_failed"

    def test_custom_message(self):
        exc = AuthenticationError("Invalid token")
        assert exc.message == "Invalid token"
        assert exc.status_code == 401


class TestAuthorizationError:
    """Tests for AuthorizationError."""

    def test_default_message(self):
        exc = AuthorizationError()
        assert exc.message == "Permission denied"
        assert exc.error_code == "FORBIDDEN"
        assert exc.status_code == 403
        assert exc.message_key == "error_permission_denied"

    def test_custom_message(self):
        exc = AuthorizationError("Cannot access this resource")
        assert exc.message == "Cannot access this resource"


class TestResourceNotFoundError:
    """Tests for ResourceNotFoundError."""

    def test_without_identifier(self):
        exc = ResourceNotFoundError("User")
        assert exc.message == "User not found"
        assert exc.error_code == "USER_NOT_FOUND"
        assert exc.status_code == 404
        assert exc.message_key == "error_not_found"
        assert exc.params == {"resource": "User"}
        assert exc.details == {"resource": "User"}

    def test_with_identifier(self):
        exc = ResourceNotFoundError("User", "123")
        assert exc.message == "User not found: 123"
        assert exc.error_code == "USER_NOT_FOUND"
        assert exc.message_key == "error_not_found_with_id"
        assert exc.params == {"resource": "User", "id": "123"}
        assert exc.details == {"resource": "User", "id": "123"}

    def test_multi_word_resource(self):
        exc = ResourceNotFoundError("API key")
        assert exc.error_code == "API_KEY_NOT_FOUND"


class TestResourceExistsError:
    """Tests for ResourceExistsError."""

    def test_without_field(self):
        exc = ResourceExistsError("User")
        assert exc.message == "User already exists"
        assert exc.error_code == "USER_EXISTS"
        assert exc.status_code == 409
        assert exc.message_key == "error_already_exists"

    def test_with_field(self):
        exc = ResourceExistsError("User", "email")
        assert exc.message == "User with this email already exists"
        assert exc.message_key == "error_already_exists_with_field"
        assert exc.params == {"resource": "User", "field": "email"}


class TestValidationError:
    """Tests for ValidationError."""

    def test_without_field(self):
        exc = ValidationError("Invalid input")
        assert exc.message == "Invalid input"
        assert exc.error_code == "VALIDATION_ERROR"
        assert exc.status_code == 422
        assert exc.details == {}

    def test_with_field(self):
        exc = ValidationError("Must be a valid email", "email")
        assert exc.details == {"field": "email"}
        assert exc.message_key == "error_validation_with_message"


class TestRateLimitError:
    """Tests for RateLimitError."""

    def test_default(self):
        exc = RateLimitError()
        assert exc.message == "Rate limit exceeded"
        assert exc.error_code == "RATE_LIMIT_EXCEEDED"
        assert exc.status_code == 429
        assert exc.message_key == "error_rate_limit"

    def test_with_retry_after(self):
        exc = RateLimitError("Slow down", retry_after=60)
        assert exc.details == {"retry_after": 60}
        assert exc.message_key == "error_rate_limit_with_retry"
        assert exc.params == {"seconds": 60}


class TestExternalServiceError:
    """Tests for ExternalServiceError."""

    def test_without_message(self):
        exc = ExternalServiceError("SeaweedFS")
        assert exc.message == "SeaweedFS is unavailable"
        assert exc.error_code == "EXTERNAL_SERVICE_ERROR"
        assert exc.status_code == 503
        assert exc.message_key == "error_service_unavailable"

    def test_with_message(self):
        exc = ExternalServiceError("PostgreSQL", "Connection refused")
        assert exc.message == "PostgreSQL: Connection refused"
        assert exc.message_key == "error_service_unavailable_with_message"


class TestTimeoutError:
    """Tests for TimeoutError."""

    def test_without_seconds(self):
        exc = TimeoutError("Database query")
        assert exc.message == "Database query timed out"
        assert exc.error_code == "TIMEOUT"
        assert exc.status_code == 504
        assert exc.message_key == "error_timeout"

    def test_with_seconds(self):
        exc = TimeoutError("API call", timeout_seconds=30.0)
        assert exc.message == "API call timed out after 30.0s"
        assert exc.message_key == "error_timeout_with_seconds"
        assert exc.params == {"operation": "API call", "seconds": 30.0}


class TestLLMConfigurationError:
    """Tests for LLMConfigurationError."""

    def test_default(self):
        exc = LLMConfigurationError()
        assert exc.message == "No LLM API key configured"
        assert exc.error_code == "LLM_NOT_CONFIGURED"
        assert exc.status_code == 503

    def test_with_provider(self):
        exc = LLMConfigurationError(provider="Anthropic")
        assert exc.message == "No Anthropic API key configured"
        assert exc.message_key == "error_llm_not_configured_with_provider"

    def test_with_provider_and_scope(self):
        exc = LLMConfigurationError(provider="OpenAI", scope="team")
        assert exc.message == "No OpenAI API key configured at team level"
        assert exc.message_key == "error_llm_not_configured_with_scope"


class TestLLMInvocationError:
    """Tests for LLMInvocationError."""

    def test_basic(self):
        exc = LLMInvocationError("Rate limit exceeded")
        assert exc.message == "Rate limit exceeded"
        assert exc.error_code == "LLM_INVOCATION_FAILED"
        assert exc.status_code == 502

    def test_with_provider(self):
        exc = LLMInvocationError("Invalid API key", provider="Anthropic")
        assert exc.details == {"provider": "Anthropic"}


class TestToolExecutionError:
    """Tests for ToolExecutionError."""

    def test_basic(self):
        exc = ToolExecutionError("search_docs", "Network error")
        assert exc.message == "Tool 'search_docs' failed: Network error"
        assert exc.error_code == "TOOL_EXECUTION_FAILED"
        assert exc.status_code == 500
        assert exc.details == {"tool": "search_docs", "reason": "Network error"}


class TestToolApprovalRequiredError:
    """Tests for ToolApprovalRequiredError."""

    def test_basic(self):
        exc = ToolApprovalRequiredError(
            tool_name="execute_query",
            tool_call_id="call_123",
        )
        assert exc.message == "Tool 'execute_query' requires approval"
        assert exc.error_code == "TOOL_APPROVAL_REQUIRED"
        assert exc.status_code == 202  # Accepted, needs action
        assert exc.details["tool_name"] == "execute_query"
        assert exc.details["tool_call_id"] == "call_123"

    def test_with_args(self):
        exc = ToolApprovalRequiredError(
            tool_name="delete_file",
            tool_call_id="call_456",
            args={"path": "/etc/passwd"},
        )
        assert exc.details["args"] == {"path": "/etc/passwd"}


class TestMCPServerError:
    """Tests for MCPServerError."""

    def test_basic(self):
        exc = MCPServerError("my-server", "Connection refused")
        assert exc.message == "MCP server 'my-server': Connection refused"
        assert exc.error_code == "MCP_SERVER_ERROR"
        assert exc.status_code == 502
        assert exc.details == {"server_name": "my-server"}


class TestMCPToolNotFoundError:
    """Tests for MCPToolNotFoundError."""

    def test_basic(self):
        exc = MCPToolNotFoundError("unknown_tool")
        assert exc.message == "MCP tool not found: unknown_tool"
        assert exc.error_code == "MCP_TOOL_NOT_FOUND"
        assert exc.status_code == 404
        assert exc.details == {"tool_name": "unknown_tool"}
