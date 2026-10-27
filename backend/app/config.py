from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str
    database_url_sync: str

    # Security
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    # CORS
    frontend_origin: str = "http://localhost:3000"

    # AI Providers
    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    groq_api_key: str = ""
    ai_model: str = "auto"
    ai_max_tokens: int = 1500

    # App
    app_env: str = "development"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
