from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# --- Engine ---
# echo=True logs all SQL statements; set to False in production
engine = create_async_engine(
    settings.database_url,
    echo=True,
    connect_args={"check_same_thread": False},  # Required for SQLite
)

# --- Session Factory ---
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevents DetachedInstanceError in async context
)


# --- Base Class for all ORM models ---
class Base(DeclarativeBase):
    pass


# --- Dependency Injection helper for FastAPI routes ---
async def get_db() -> AsyncSession:
    """
    Yields a database session per request and ensures it is
    closed afterwards, even if an exception occurs.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()