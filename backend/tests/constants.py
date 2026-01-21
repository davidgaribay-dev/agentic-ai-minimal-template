"""Centralized test constants for consistent test data across all test modules.

This module provides standardized test values to:
- Avoid magic strings scattered across tests
- Ensure consistency in test data
- Make it easy to update test values globally
- Support parametrized tests with reusable data
"""

# =============================================================================
# User Test Data
# =============================================================================

# Standard test user
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "SecureP@ss123!"
TEST_USER_FULL_NAME = "Test User"

# Admin test user
TEST_ADMIN_EMAIL = "admin@example.com"
TEST_ADMIN_PASSWORD = "AdminP@ss456!"
TEST_ADMIN_FULL_NAME = "Admin User"

# Secondary test user (for multi-user scenarios)
TEST_USER2_EMAIL = "testuser2@example.com"
TEST_USER2_PASSWORD = "User2P@ss789!"
TEST_USER2_FULL_NAME = "Test User 2"

# Inactive test user
TEST_INACTIVE_USER_EMAIL = "inactive@example.com"
TEST_INACTIVE_USER_PASSWORD = "InactiveP@ss000!"

# =============================================================================
# Organization Test Data
# =============================================================================

TEST_ORG_NAME = "Test Organization"
TEST_ORG_SLUG = "test-org"
TEST_ORG2_NAME = "Second Organization"
TEST_ORG2_SLUG = "second-org"

# =============================================================================
# Team Test Data
# =============================================================================

TEST_TEAM_NAME = "Test Team"
TEST_TEAM_SLUG = "test-team"
TEST_TEAM2_NAME = "Second Team"
TEST_TEAM2_SLUG = "second-team"

# =============================================================================
# Conversation Test Data
# =============================================================================

TEST_CONVERSATION_TITLE = "Test Conversation"
TEST_MESSAGE_CONTENT = "Hello, this is a test message."
TEST_ASSISTANT_RESPONSE = "I understand. How can I help you?"

# =============================================================================
# MCP Test Data
# =============================================================================

TEST_MCP_SERVER_NAME = "test-mcp-server"
TEST_MCP_SERVER_URL = "http://localhost:3000/mcp"
TEST_MCP_TOOL_NAME = "test_tool"

# =============================================================================
# Document/RAG Test Data
# =============================================================================

TEST_DOCUMENT_TITLE = "Test Document"
TEST_DOCUMENT_CONTENT = "This is test document content for RAG testing."
TEST_CHUNK_SIZE = 500
TEST_CHUNK_OVERLAP = 50

# =============================================================================
# Invalid Test Data (for negative tests)
# =============================================================================

INVALID_EMAIL = "not-an-email"
INVALID_UUID = "not-a-uuid"
WEAK_PASSWORD = "123"  # Too short, no special chars
EMPTY_STRING = ""

# =============================================================================
# API Response Codes
# =============================================================================

HTTP_OK = 200
HTTP_CREATED = 201
HTTP_ACCEPTED = 202
HTTP_NO_CONTENT = 204
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_UNPROCESSABLE_ENTITY = 422
HTTP_TOO_MANY_REQUESTS = 429
HTTP_INTERNAL_ERROR = 500
HTTP_BAD_GATEWAY = 502
HTTP_SERVICE_UNAVAILABLE = 503
HTTP_GATEWAY_TIMEOUT = 504

# =============================================================================
# Error Codes (matching backend/core/exceptions.py)
# =============================================================================

ERROR_AUTH_FAILED = "AUTH_FAILED"
ERROR_FORBIDDEN = "FORBIDDEN"
ERROR_VALIDATION = "VALIDATION_ERROR"
ERROR_NOT_FOUND_SUFFIX = "_NOT_FOUND"
ERROR_EXISTS_SUFFIX = "_EXISTS"
ERROR_RATE_LIMIT = "RATE_LIMIT_EXCEEDED"
ERROR_LLM_NOT_CONFIGURED = "LLM_NOT_CONFIGURED"
ERROR_LLM_INVOCATION_FAILED = "LLM_INVOCATION_FAILED"
ERROR_TOOL_EXECUTION_FAILED = "TOOL_EXECUTION_FAILED"
ERROR_TOOL_APPROVAL_REQUIRED = "TOOL_APPROVAL_REQUIRED"
ERROR_MCP_SERVER = "MCP_SERVER_ERROR"
ERROR_MCP_TOOL_NOT_FOUND = "MCP_TOOL_NOT_FOUND"

# =============================================================================
# Test Timeouts and Limits
# =============================================================================

TEST_CACHE_TTL_SECONDS = 300
TEST_TOKEN_EXPIRY_MINUTES = 30
TEST_REFRESH_TOKEN_DAYS = 7
TEST_MAX_RETRIES = 3
TEST_TIMEOUT_SECONDS = 5
