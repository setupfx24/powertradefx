from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

# Per-PROCESS pool sizes. Every uvicorn worker and every engine service has
# its own pool, so the total is (processes x (size + overflow)) and must stay
# below Postgres max_connections (set in docker-compose.prod.yml). With the
# production layout (gateway 6 workers, admin 3, three engines) the defaults
# give <= 240 main-DB connections against a limit of 300. QA 2026-09-29: the
# old 20+10 per process could open ~210 against a limit of 100.
import os as _os

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=int(_os.getenv("DB_POOL_SIZE", "10")),
    max_overflow=int(_os.getenv("DB_MAX_OVERFLOW", "10")),
    pool_pre_ping=True,
    pool_timeout=10,
)

timescale_engine = create_async_engine(
    settings.TIMESCALE_URL,
    echo=False,
    pool_size=int(_os.getenv("TS_POOL_SIZE", "5")),
    max_overflow=int(_os.getenv("TS_MAX_OVERFLOW", "5")),
    pool_pre_ping=True,
    pool_timeout=10,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

TimescaleSessionLocal = async_sessionmaker(
    timescale_engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


