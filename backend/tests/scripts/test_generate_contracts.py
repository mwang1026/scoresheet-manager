"""Tests for generate_contracts script — pure functions, no DB."""

import sys
from pathlib import Path
from typing import Literal, Optional
from unittest.mock import patch

import pytest
from pydantic import BaseModel

# Add backend to path so we can import the script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from scripts.generate_contracts import (
    SCHEMAS,
    build_contract,
    build_field_map,
    python_type_to_ts,
)


class TestPythonTypeToTs:
    """Tests for python_type_to_ts conversion."""

    def test_int_to_number(self):
        assert python_type_to_ts(int) == "number"

    def test_float_to_number(self):
        assert python_type_to_ts(float) == "number"

    def test_str_to_string(self):
        assert python_type_to_ts(str) == "string"

    def test_bool_to_boolean(self):
        assert python_type_to_ts(bool) == "boolean"

    def test_optional_int_to_number_or_null(self):
        assert python_type_to_ts(Optional[int]) == "number | null"

    def test_optional_str_to_string_or_null(self):
        assert python_type_to_ts(Optional[str]) == "string | null"

    def test_literal_strings(self):
        result = python_type_to_ts(Literal["hitter", "pitcher"])
        assert result == "'hitter' | 'pitcher'"

    def test_literal_ints(self):
        result = python_type_to_ts(Literal[1, 2, 3])
        assert result == "1 | 2 | 3"

    def test_union_type_syntax(self):
        """Test Python 3.10+ union syntax (int | None)."""
        result = python_type_to_ts(int | None)
        assert result == "number | null"

    def test_date_to_string(self):
        from datetime import date

        assert python_type_to_ts(date) == "string"

    def test_datetime_to_string(self):
        from datetime import datetime

        assert python_type_to_ts(datetime) == "string"

    def test_pydantic_model_returns_class_name(self):
        class MyModel(BaseModel):
            x: int

        assert python_type_to_ts(MyModel) == "MyModel"


class TestBuildFieldMap:
    """Tests for build_field_map."""

    def test_simple_schema(self):
        class SimpleSchema(BaseModel):
            name: str
            age: int
            score: float

        result = build_field_map(SimpleSchema)
        assert result == {"name": "string", "age": "number", "score": "number"}

    def test_schema_with_optional_fields(self):
        class OptionalSchema(BaseModel):
            name: str
            nickname: Optional[str] = None

        result = build_field_map(OptionalSchema)
        assert result["name"] == "string"
        assert result["nickname"] == "string | null"

    def test_known_schema_returns_correct_fields(self):
        """Test build_field_map on a real schema from SCHEMAS."""
        from app.schemas.team import TeamListItem

        result = build_field_map(TeamListItem)
        assert "name" in result
        assert isinstance(result["name"], str)


class TestBuildContract:
    """Tests for build_contract."""

    def test_includes_all_schema_keys(self):
        contract = build_contract()
        for name in SCHEMAS:
            assert name in contract, f"Missing schema: {name}"

    def test_includes_generator_field(self):
        contract = build_contract()
        assert contract["_generator"] == "backend/scripts/generate_contracts.py"

    def test_schema_values_are_dicts(self):
        contract = build_contract()
        for name in SCHEMAS:
            assert isinstance(contract[name], dict), f"{name} should be a dict"
