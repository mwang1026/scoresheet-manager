"""User settings schemas."""

import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, field_validator


class UserSettingsResponse(BaseModel):
    settings_json: dict[str, Any]
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("settings_json", mode="before")
    @classmethod
    def parse_settings_json(cls, v: Any) -> Any:
        if isinstance(v, str):
            return json.loads(v)
        return v


class UserSettingsUpdateRequest(BaseModel):
    settings_json: dict[str, Any]
