"""Agent lifecycle management with testable state encapsulation.

This module provides the AgentManager class that encapsulates global agent state
(connection pool, checkpointer, agent instance) into a manageable singleton with
proper lifecycle control and test isolation support.

Replaces module-level globals in base.py for improved testability.
"""

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Depends
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from backend.core.config import settings
from backend.core.logging import get_logger

logger = get_logger(__name__)


@dataclass
class AgentState:
    """Encapsulated agent runtime state.

    Groups all mutable state that was previously module-level globals.
    Allows clean reset between tests without module reloading.
    """

    pool: AsyncConnectionPool | None = None
    checkpointer: AsyncPostgresSaver | None = None
    agent: Any = None
    initialized: bool = False


class AgentManager:
    """Manages agent lifecycle with testable interface.

    Provides:
    - Lazy initialization of checkpointer and connection pool
    - Clean shutdown of resources
    - Test isolation via reset_for_testing()
    - Dependency injection support via FastAPI Depends()

    Example usage in routes:
        @router.post("/chat")
        async def chat(manager: AgentManagerDep):
            agent = await manager.get_agent()
            # Use agent...

    Example test override:
        app.dependency_overrides[get_agent_manager_dep] = lambda: mock_manager
    """

    # Connection pool settings
    POOL_MAX_SIZE = 20

    def __init__(self) -> None:
        self._state = AgentState()

    @property
    def is_initialized(self) -> bool:
        """Check if the manager has been initialized."""
        return self._state.initialized

    @property
    def checkpointer(self) -> AsyncPostgresSaver | None:
        """Get the current checkpointer instance."""
        return self._state.checkpointer

    async def init_checkpointer(self) -> AsyncPostgresSaver:
        """Initialize the PostgreSQL checkpointer with connection pool.

        Creates and configures:
        - AsyncConnectionPool with autocommit mode
        - AsyncPostgresSaver with schema setup

        Returns:
            Configured AsyncPostgresSaver instance

        Raises:
            Exception: If connection or setup fails (pool is cleaned up)
        """
        if self._state.checkpointer is not None:
            return self._state.checkpointer

        pool = AsyncConnectionPool(
            conninfo=settings.CHECKPOINT_DATABASE_URI,
            max_size=self.POOL_MAX_SIZE,
            kwargs={"autocommit": True},
            open=False,
        )
        await pool.open()

        try:
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()
        except Exception:
            # Clean up pool if checkpointer setup fails
            await pool.close()
            raise

        # Only assign after successful setup
        self._state.pool = pool
        self._state.checkpointer = checkpointer
        self._state.initialized = True

        logger.info(
            "agent_manager_checkpointer_initialized",
            pool_max_size=self.POOL_MAX_SIZE,
        )
        return checkpointer

    async def get_agent(self) -> Any:
        """Get or create the agent instance.

        Lazy initialization - creates checkpointer and agent on first call.

        Returns:
            Configured agent graph instance
        """
        if self._state.agent is None:
            checkpointer = await self.init_checkpointer()
            # Import here to avoid circular imports
            from backend.agents.base import create_agent_graph

            self._state.agent = create_agent_graph(checkpointer=checkpointer)

        return self._state.agent

    async def cleanup(self) -> None:
        """Clean up all resources.

        Should be called during app shutdown or after tests.
        Safely closes pool and resets state.
        """
        if self._state.pool is not None:
            try:
                await self._state.pool.close()
            except Exception as e:
                logger.warning("agent_manager_cleanup_error", error=str(e))

        self._state = AgentState()
        logger.info("agent_manager_cleanup_complete")

    def reset_for_testing(self) -> None:
        """Reset state for test isolation (synchronous).

        Use this in test fixtures to ensure clean state.
        Note: Does NOT close pool - use cleanup() for that.

        Example:
            @pytest.fixture(autouse=True)
            def reset_agent_state():
                yield
                get_agent_manager().reset_for_testing()
        """
        self._state = AgentState()

    def get_stats(self) -> dict[str, Any]:
        """Get manager statistics for monitoring.

        Returns:
            Dict with initialization status and pool info
        """
        pool_stats = None
        if self._state.pool is not None:
            pool_stats = {
                "size": self._state.pool.get_stats().get("pool_size", 0),
                "available": self._state.pool.get_stats().get("pool_available", 0),
            }

        return {
            "initialized": self._state.initialized,
            "has_checkpointer": self._state.checkpointer is not None,
            "has_agent": self._state.agent is not None,
            "pool": pool_stats,
        }


# =============================================================================
# Singleton and Dependency Injection
# =============================================================================

_agent_manager: AgentManager | None = None


def get_agent_manager() -> AgentManager:
    """Get the singleton AgentManager instance.

    Creates the manager on first call.
    """
    global _agent_manager
    if _agent_manager is None:
        _agent_manager = AgentManager()
    return _agent_manager


def get_agent_manager_dep() -> AgentManager:
    """FastAPI dependency for AgentManager.

    Use this with Depends() in route handlers:

        @router.post("/chat")
        async def chat(manager: AgentManagerDep):
            agent = await manager.get_agent()

    Tests can override via app.dependency_overrides:

        app.dependency_overrides[get_agent_manager_dep] = lambda: mock_manager
    """
    return get_agent_manager()


AgentManagerDep = Annotated[AgentManager, Depends(get_agent_manager_dep)]
