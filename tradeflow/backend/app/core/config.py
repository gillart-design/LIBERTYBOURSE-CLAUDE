from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "TradeFlow"
    DEBUG: bool = False
    DEMO_MODE: bool = True
    DEMO_SEED: int = 42

    # Security
    SECRET_KEY: str = "dev_secret_key_change_in_production_min_32_chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tradeflow:tradeflow_secret@localhost:5432/tradeflow"

    # Redis
    REDIS_URL: str = "redis://:redis_secret@localhost:6379/0"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

    # Market data providers (priority order: polygon > twelve_data > yahoo)
    POLYGON_API_KEY: Optional[str] = None
    TWELVE_DATA_API_KEY: Optional[str] = None
    ALPHA_VANTAGE_API_KEY: Optional[str] = None
    YAHOO_FALLBACK: bool = True

    # Data settings
    PRICE_REFRESH_INTERVAL: int = 15   # seconds
    PRICE_CACHE_TTL: int = 10          # seconds
    HISTORY_CACHE_TTL: int = 3600      # seconds

    @property
    def active_provider(self) -> str:
        if self.POLYGON_API_KEY:
            return "polygon"
        if self.TWELVE_DATA_API_KEY:
            return "twelve_data"
        if self.ALPHA_VANTAGE_API_KEY:
            return "alpha_vantage"
        return "yahoo"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
