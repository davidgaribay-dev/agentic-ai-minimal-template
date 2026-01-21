"""Database fixtures for integration tests.

Provides SQLite in-memory database with automatic table creation/teardown
for fast, isolated database tests.

Uses StaticPool to keep a single connection open across all tests,
which is required for SQLite in-memory databases.
"""

from collections.abc import Generator

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from backend.core.db import get_db
from backend.main import app

# In-memory SQLite for fast tests
TEST_DATABASE_URL = "sqlite:///:memory:"

# Create test engine with StaticPool (keeps connection open across all tests)
# check_same_thread=False is required for SQLite to work with FastAPI's
# dependency injection across different threads
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Create a fresh database session for each test.

    Creates all tables at the start and drops them at the end.
    Uses SQLite in-memory database for speed.

    This fixture provides test isolation by:
    1. Creating all tables fresh for each test
    2. Yielding a session for the test to use
    3. Dropping all tables after the test completes

    Note: For tests that need transaction rollback instead of table recreation,
    see the transactional_session fixture in this module.
    """
    # Create all tables
    SQLModel.metadata.create_all(test_engine)

    with Session(test_engine) as session:
        yield session

    # Drop all tables after test
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Create a FastAPI TestClient with overridden database dependency.

    The get_db dependency is overridden to use the test session,
    ensuring all requests use the same isolated database.

    Args:
        db_session: The test database session fixture

    Yields:
        TestClient configured to use the test database
    """

    def get_test_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = get_test_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
