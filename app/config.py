from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"
    DB_NAME: str = "attendance_db"

    
    SECRET_KEY: str = "change_this_secret_key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480   

    
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin@123"

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
