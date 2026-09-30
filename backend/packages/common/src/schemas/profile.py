"""Profile + change-password schemas (POST /profile/...)."""
from pydantic import BaseModel, Field, field_validator

from ..password_policy import validate_password_strength


class UpdateProfileRequest(BaseModel):
    """All fields optional — clients send only what they're changing."""
    first_name: str | None = Field(None, max_length=100)
    last_name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=20)
    country: str | None = Field(None, max_length=100)
    address: str | None = None
    city: str | None = Field(None, max_length=100)
    state: str | None = Field(None, max_length=100)
    postal_code: str | None = Field(None, max_length=20)
    avatar: str | None = None  # preset-avatar JSON or photo data-URI/URL
    language: str | None = Field(None, max_length=10)
    theme: str | None = Field(None, pattern="^(light|dark)$")
    date_of_birth: str | None = None
    # Self-declared Islamic PREFERENCE: the account picker then offers only
    # swap-free account types. It does not by itself make any account swap-
    # free — only a swap-free account type (admin-controlled) does.
    is_islamic: bool | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong_password(cls, v: str) -> str:
        return validate_password_strength(v)
