"""Generate contracts/api-schemas.json from Pydantic schemas.

Run from the backend directory:
    python scripts/generate_contracts.py
"""

import json
import sys
import types
from datetime import date, datetime
from pathlib import Path
from typing import Literal, Optional, Union, get_args, get_origin

from pydantic import BaseModel

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.schemas.player import PlayerListItem
from app.schemas.projection import (
    HitterProjectionAdvanced,
    HitterProjectionItem,
    PitcherProjectionAdvanced,
    PitcherProjectionItem,
)
from app.schemas.stats import HitterDailyStatsItem, PitcherDailyStatsItem
from app.schemas.team import TeamListItem

# Schemas to include in the contract, keyed by their contract name
SCHEMAS: dict[str, type[BaseModel]] = {
    "PlayerListItem": PlayerListItem,
    "HitterDailyStatsItem": HitterDailyStatsItem,
    "PitcherDailyStatsItem": PitcherDailyStatsItem,
    "HitterProjectionItem": HitterProjectionItem,
    "PitcherProjectionItem": PitcherProjectionItem,
    "HitterProjectionAdvanced": HitterProjectionAdvanced,
    "PitcherProjectionAdvanced": PitcherProjectionAdvanced,
    "TeamListItem": TeamListItem,
}

OUTPUT_PATH = Path(__file__).resolve().parent.parent.parent / "contracts" / "api-schemas.json"


def python_type_to_ts(annotation: type) -> str:
    """Convert a Python type annotation to a TypeScript-compatible type string."""
    origin = get_origin(annotation)
    args = get_args(annotation)

    # Handle Union types (X | None pattern, Optional[X])
    if origin is Union or origin is types.UnionType:
        non_none = [a for a in args if a is not type(None)]
        has_none = type(None) in args
        if len(non_none) == 1:
            base = python_type_to_ts(non_none[0])
            return f"{base} | null" if has_none else base
        # Multi-type union (shouldn't happen in our schemas)
        parts = [python_type_to_ts(a) for a in args if a is not type(None)]
        result = " | ".join(parts)
        return f"{result} | null" if has_none else result

    # Handle Literal types
    if origin is Literal:
        parts = [f"'{a}'" if isinstance(a, str) else str(a) for a in args]
        return " | ".join(parts)

    # Handle Optional[X] (already covered by Union, but just in case)
    if origin is Optional:
        inner = python_type_to_ts(args[0])
        return f"{inner} | null"

    # Pydantic model → reference by class name
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation.__name__

    # Primitive mappings
    if annotation is int or annotation is float:
        return "number"
    if annotation is str:
        return "string"
    if annotation is bool:
        return "boolean"
    if annotation is date or annotation is datetime:
        return "string"

    return "unknown"


def build_field_map(schema: type[BaseModel]) -> dict[str, str]:
    """Build a field name → TS type string map from a Pydantic schema."""
    fields: dict[str, str] = {}
    for name, field_info in schema.model_fields.items():
        fields[name] = python_type_to_ts(field_info.annotation)
    return fields


def build_contract() -> dict:
    """Build the full contract dict."""
    contract: dict = {
        "_generator": "backend/scripts/generate_contracts.py",
    }
    for name, schema in SCHEMAS.items():
        contract[name] = build_field_map(schema)
    return contract


def main() -> None:
    contract = build_contract()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(contract, indent=2) + "\n")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
