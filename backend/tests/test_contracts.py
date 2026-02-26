"""Contract tests: verify api-schemas.json matches current Pydantic schemas."""

import json
from datetime import date
from pathlib import Path

import pytest

# Re-use the generator's logic for building the expected contract
from scripts.generate_contracts import SCHEMAS, build_contract

CONTRACT_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "api-schemas.json"

METADATA_KEYS = {"_generator", "_generated"}


class TestContractStaleness:
    """Verify the committed contract file matches current Pydantic schemas."""

    def test_contract_file_exists(self):
        assert CONTRACT_PATH.exists(), (
            f"Contract file not found at {CONTRACT_PATH}. "
            "Run: cd backend && python scripts/generate_contracts.py"
        )

    def test_contract_is_up_to_date(self):
        committed = json.loads(CONTRACT_PATH.read_text())
        expected = build_contract()

        # Compare schema entries only (skip metadata)
        committed_schemas = {k: v for k, v in committed.items() if k not in METADATA_KEYS}
        expected_schemas = {k: v for k, v in expected.items() if k not in METADATA_KEYS}

        assert committed_schemas == expected_schemas, (
            "Contract file is stale. Run: cd backend && python scripts/generate_contracts.py"
        )


class TestRoundTripSerialization:
    """Verify each schema can be constructed and serialized with all contract fields."""

    # Dummy values by TS type string
    DUMMY_VALUES = {
        "number": 1,
        "string": "test",
        "boolean": True,
        "number | null": 1,
        "string | null": "test",
    }

    def _dummy_for_type(self, ts_type: str, field_name: str):
        """Return a dummy value appropriate for the given TS type string."""
        if ts_type in self.DUMMY_VALUES:
            return self.DUMMY_VALUES[ts_type]
        if ts_type.startswith("'"):
            # Literal — strip quotes
            return ts_type.strip("'")
        if ts_type.endswith(" | null"):
            base = ts_type.removesuffix(" | null")
            if base in self.DUMMY_VALUES:
                return self.DUMMY_VALUES[base]
            # Nested model reference — return None (valid for nullable)
            return None
        # Unknown — return None
        return None

    @pytest.mark.parametrize("schema_name", list(SCHEMAS.keys()))
    def test_serialized_output_has_all_contract_fields(self, schema_name: str):
        schema_cls = SCHEMAS[schema_name]
        contract = build_contract()
        field_map = contract[schema_name]

        # Build dummy kwargs
        kwargs = {}
        for field_name, ts_type in field_map.items():
            kwargs[field_name] = self._dummy_for_type(ts_type, field_name)

        instance = schema_cls.model_construct(**kwargs)
        serialized = instance.model_dump(mode="json")

        missing = [f for f in field_map if f not in serialized]
        assert missing == [], (
            f"{schema_name}: fields {missing} are in the contract but missing from serialized output"
        )
