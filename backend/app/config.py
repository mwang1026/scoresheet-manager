from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/scoresheet"
    JWT_SECRET: str = "change-me-in-production"
    MLB_API_BASE_URL: str = "https://statsapi.mlb.com/api/v1"
    SCORESHEET_BASE_URL: str = "https://www.scoresheet.com"
    CORS_ORIGINS: str = "http://localhost:3000"
    INTERNAL_API_KEY: str = ""  # Empty = disabled (dev mode). Set in prod.

    # Multi-user settings (temporary until auth is implemented)
    DEFAULT_TEAM_ID: int = 1
    DEFAULT_LEAGUE_ID: int = 1

    # Seed script configuration
    SEED_LEAGUE_NAME: str = "AL Catfish Hunter"
    SEED_LEAGUE_SEASON: int = 2026
    SEED_LEAGUE_DATA_PATH: str = "FOR_WWW1/AL_Catfish_Hunter"
    SEED_USERS: str = "user@example.com:1:owner"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
