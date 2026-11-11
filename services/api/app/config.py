from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CC_", hide_input_in_errors=True)
    database_url: str = Field(min_length=1)
    redis_url: str = Field(min_length=1)
    s3_endpoint: str = Field(min_length=1)
    s3_access_key: str = Field(min_length=1)
    s3_secret_key: str = Field(min_length=16)
    s3_bucket: str = Field(min_length=3)
    oidc_issuer: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_callback: str = "http://localhost:8000/api/v1/auth/callback"
    web_origin: str = "http://localhost:3000"
    session_secret: str = ""
    secure_cookies: bool = True
    synthetic_only: bool = True
    oidc_backchannel: str = ""
    rate_limit_enabled: bool = True
    rate_limit_per_minute: int = Field(default=120, ge=1, le=10000)

    @model_validator(mode="after")
    def secure_configuration(self) -> "Settings":
        if self.oidc_issuer and (len(self.session_secret) < 32 or not self.oidc_client_id):
            raise ValueError(
                "Configured OIDC requires client ID and at least 32-character session secret"
            )
        if not self.synthetic_only and (
            not self.secure_cookies
            or not self.oidc_issuer.startswith("https://")
            or not self.s3_endpoint.startswith("https://")
        ):
            raise ValueError("Production requires secure cookies and HTTPS identity/storage")
        return self
