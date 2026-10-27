import os
import pytest
import psycopg2
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app import database
from app.seed import seed_data
from app.routers.auth import _LOGIN_ATTEMPTS

settings = get_settings()

if "TEST_DATABASE_URL" in os.environ:
    settings.database_url = os.environ["TEST_DATABASE_URL"]

# Use NullPool during tests to avoid cross-event-loop connection sharing with asyncpg
test_engine = create_async_engine(
    settings.database_url,
    poolclass=NullPool,
)
database.engine = test_engine
database.AsyncSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

@pytest.fixture(scope="session", autouse=True)
def assert_postgres_dialect():
    """Ensure tests are genuinely running against PostgreSQL when configured for it."""
    dialect_name = database.engine.dialect.name
    if os.environ.get("ALLOW_SQLITE_TESTS") == "1":
        return
    assert dialect_name == "postgresql", (
        f"Dialect assertion failed: expected 'postgresql', got '{dialect_name}'. "
        "Tests must run against real PostgreSQL."
    )

@pytest.fixture(scope="session", autouse=True)
def seed_test_database():
    """Seed base curriculum data into cm_test once per test session."""
    import asyncio
    if os.environ.get("ALLOW_SQLITE_TESTS") == "1":
        return
    asyncio.run(seed_data())

@pytest.fixture(autouse=True)
def clean_database_between_tests():
    """Clean mutable user and session data between tests, keeping seeded content."""
    _LOGIN_ATTEMPTS.clear()
    if os.environ.get("ALLOW_SQLITE_TESTS") == "1":
        yield
        return
    sync_url = os.environ.get(
        "DATABASE_URL_SYNC", 
        "postgresql://postgres:sandeep%402004@localhost:5432/cm_test"
    )
    with psycopg2.connect(sync_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "TRUNCATE TABLE users, user_profiles, user_sessions, "
                "lesson_progress, quiz_attempts, assessment_results, xp_transactions "
                "CASCADE;"
            )
    yield
