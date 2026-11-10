from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CC_", hide_input_in_errors=True)
    database_url: str = Field(min_length=1)
    redis_url: str = Field(min_length=1)
    s3_endpoint: str = Field(min_length=1)
    s3_access_key: str = Field(min_length=1)
    s3_secret_key: str = Field(min_length=16)
    s3_bucket: str = Field(min_length=3)
