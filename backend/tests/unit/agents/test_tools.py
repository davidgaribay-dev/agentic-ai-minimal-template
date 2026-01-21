"""Tests for the agent tools module.

Tests follow FIRST principles:
- Fast: Pure unit tests without external dependencies
- Independent: Each test is self-contained
- Repeatable: Deterministic results (mocked time for get_current_time)
- Self-verifying: Clear assertions
- Timely: Written alongside the code
"""

from freezegun import freeze_time
import pytest

from backend.agents.tools import (
    calculate,
    get_available_tools,
    get_current_time,
)


@pytest.mark.unit
@pytest.mark.agents
class TestCalculateTool:
    """Tests for the calculate tool."""

    def test_basic_addition(self) -> None:
        """Calculate handles basic addition."""
        # Act
        result = calculate.invoke("2 + 3")

        # Assert
        assert result == "5"

    def test_basic_subtraction(self) -> None:
        """Calculate handles basic subtraction."""
        # Act
        result = calculate.invoke("10 - 4")

        # Assert
        assert result == "6"

    def test_multiplication(self) -> None:
        """Calculate handles multiplication."""
        # Act
        result = calculate.invoke("6 * 7")

        # Assert
        assert result == "42"

    def test_division(self) -> None:
        """Calculate handles division with float result."""
        # Act
        result = calculate.invoke("10 / 4")

        # Assert
        assert result == "2.5"

    def test_floor_division(self) -> None:
        """Calculate handles floor division."""
        # Act
        result = calculate.invoke("10 // 3")

        # Assert
        assert result == "3"

    def test_modulo(self) -> None:
        """Calculate handles modulo operation."""
        # Act
        result = calculate.invoke("17 % 5")

        # Assert
        assert result == "2"

    def test_power(self) -> None:
        """Calculate handles exponentiation."""
        # Act
        result = calculate.invoke("2 ** 10")

        # Assert
        assert result == "1024"

    def test_negative_numbers(self) -> None:
        """Calculate handles negative numbers."""
        # Act
        result = calculate.invoke("-5 + 3")

        # Assert
        assert result == "-2"

    def test_complex_expression(self) -> None:
        """Calculate handles complex expressions with operator precedence."""
        # Act
        result = calculate.invoke("2 + 3 * 4")

        # Assert - multiplication before addition
        assert result == "14"

    def test_parentheses(self) -> None:
        """Calculate respects parentheses."""
        # Act
        result = calculate.invoke("(2 + 3) * 4")

        # Assert
        assert result == "20"

    def test_division_by_zero_returns_error(self) -> None:
        """Calculate returns error for division by zero."""
        # Act
        result = calculate.invoke("10 / 0")

        # Assert
        assert "error" in result.lower()
        assert "zero" in result.lower()

    def test_invalid_expression_returns_error(self) -> None:
        """Calculate returns error for invalid expressions."""
        # Act
        result = calculate.invoke("2 +")

        # Assert
        assert "error" in result.lower()

    def test_unsupported_operator_returns_error(self) -> None:
        """Calculate rejects unsupported operations like bitwise."""
        # Act
        result = calculate.invoke("5 & 3")  # Bitwise AND

        # Assert
        assert "error" in result.lower()

    def test_rejects_function_calls(self) -> None:
        """Calculate rejects function calls for security."""
        # Act
        result = calculate.invoke("import('os')")

        # Assert
        assert "error" in result.lower()

    def test_floating_point(self) -> None:
        """Calculate handles floating point numbers."""
        # Act
        result = calculate.invoke("3.14 * 2")

        # Assert
        assert float(result) == pytest.approx(6.28)


@pytest.mark.unit
@pytest.mark.agents
class TestGetCurrentTimeTool:
    """Tests for the get_current_time tool."""

    @freeze_time("2025-06-15 14:30:00+00:00")
    def test_returns_iso_format(self) -> None:
        """get_current_time returns ISO formatted datetime."""
        # Act
        result = get_current_time.invoke({})

        # Assert
        assert "2025-06-15" in result
        assert "14:30:00" in result

    @freeze_time("2025-12-31 23:59:59+00:00")
    def test_returns_current_frozen_time(self) -> None:
        """get_current_time returns the mocked time."""
        # Act
        result = get_current_time.invoke({})

        # Assert
        assert "2025-12-31" in result
        assert "23:59:59" in result


@pytest.mark.unit
@pytest.mark.agents
class TestGetAvailableTools:
    """Tests for tool discovery."""

    def test_returns_basic_tools(self) -> None:
        """get_available_tools returns the basic tool set."""
        # Act
        tools = get_available_tools()

        # Assert
        assert len(tools) >= 2
        tool_names = [t.name for t in tools]
        assert "get_current_time" in tool_names
        assert "calculate" in tool_names

    def test_tools_are_invocable(self) -> None:
        """All returned tools can be invoked."""
        # Arrange
        tools = get_available_tools()

        # Assert
        for tool in tools:
            assert hasattr(tool, "invoke") or hasattr(tool, "run")
            assert hasattr(tool, "name")
            assert hasattr(tool, "description")


@pytest.mark.unit
@pytest.mark.agents
class TestSafeEvalSecurity:
    """Security tests for the safe eval implementation."""

    @pytest.mark.parametrize(
        "malicious_input",
        [
            "__import__('os').system('ls')",
            "eval('1+1')",
            "exec('print(1)')",
            "open('/etc/passwd')",
            "globals()",
            "locals()",
            "[x for x in ().__class__.__bases__[0].__subclasses__()]",
            "getattr((), '__class__')",
        ],
    )
    def test_rejects_malicious_input(self, malicious_input: str) -> None:
        """Calculate rejects various malicious inputs."""
        # Act
        result = calculate.invoke(malicious_input)

        # Assert - should return error, not execute
        assert "error" in result.lower()
