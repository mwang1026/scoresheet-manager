import os
import re

from alembic import context
from sqlalchemy import create_engine

from app.models import Base

config = context.config

target_metadata = Base.metadata


def normalize_database_url(url: str) -> str:
    """Normalize any PostgreSQL URL variant to use the psycopg sync driver.

    Handles: postgres://, postgresql://, postgresql+asyncpg:// → postgresql+psycopg://
    """
    return re.sub(
        r"^(?:postgres(?:ql)?(?:\+\w+)?)(://)",
        r"postgresql+psycopg\1",
        url,
    )


database_url = normalize_database_url(
    os.environ.get(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/scoresheet",
    )
)


def run_migrations_offline():
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = create_engine(database_url)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
