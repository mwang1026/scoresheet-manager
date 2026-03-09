"""Out of Position (OOP) penalty rating calculations.

Uses Scoresheet-published OOP base ratings scaled by the player's
defensive ability relative to the league average at their source position.
"""

from app.constants import DEFENSE_AVERAGES

# Inlined from contracts/oop-base-ratings.json — contract tests verify these match
OOP_BASE_RATINGS: dict[str, dict[str, float]] = {
    "1B": {"OF": 1.94},
    "2B": {"3B": 2.53, "SS": 4.40, "OF": 2.04},
    "3B": {"2B": 3.97, "SS": 4.33, "OF": 2.01},
    "SS": {"2B": 4.14, "3B": 2.61, "OF": 2.07},
    "C": {"1B": 1.73, "OF": 1.93},
    "DH": {"1B": 1.70, "OF": 1.90},
    "OF": {"1B": 1.79},
}

# Inlined from contracts/oop-source-averages.json — contract tests verify these match
SOURCE_AVERAGES: dict[str, float] = {"1B": 1.85, "2B": 4.25, "3B": 2.65, "SS": 4.75}


def compute_oop_rating(
    primary_position: str,
    position_ratings: dict[str, float],
    target: str,
) -> float | None:
    """Calculate the OOP defense rating for a player at a target position.

    Formula: OOP_Rating = OOP_base × (Player_def_at_source / Avg_at_source)
    Picks the best (highest) result across all valid source positions.

    Args:
        primary_position: Player's primary position (e.g. "SS", "C", "DH")
        position_ratings: Map of position -> defense rating from PlayerPosition records
        target: The target position to compute OOP rating for

    Returns:
        Best OOP rating, or None if no valid source→target path exists.
    """
    # Collect all natural positions: primary + keys of position_ratings
    natural_positions = {primary_position} | set(position_ratings.keys())

    best_rating: float | None = None

    for source_pos in natural_positions:
        # Look up OOP base from source → target
        base_rating: float | None = None

        if source_pos in OOP_BASE_RATINGS and target in OOP_BASE_RATINGS[source_pos]:
            base_rating = OOP_BASE_RATINGS[source_pos][target]

        # Infielder→1B fallback: if source is 2B/3B/SS and target is 1B
        if base_rating is None and target == "1B" and source_pos in ("2B", "3B", "SS"):
            base_rating = DEFENSE_AVERAGES["1B"]  # 1.85

        if base_rating is None:
            continue

        # Calculate multiplier
        source_avg = SOURCE_AVERAGES.get(source_pos)
        player_def = position_ratings.get(source_pos)

        if source_pos in ("C", "DH") or player_def is None or source_avg is None:
            # C and DH have no defense fields — use base directly
            rating = base_rating
        else:
            rating = base_rating * (player_def / source_avg)

        if best_rating is None or rating > best_rating:
            best_rating = rating

    return best_rating


def get_valid_oop_targets(
    primary_position: str,
    position_ratings: dict[str, float],
) -> list[str]:
    """Get positions a player could play via OOP that they don't naturally qualify for.

    Args:
        primary_position: Player's primary position
        position_ratings: Map of position -> defense rating

    Returns:
        Sorted list of valid OOP target positions.
    """
    natural_positions = {primary_position} | set(position_ratings.keys())
    targets: set[str] = set()

    for source_pos in natural_positions:
        oop_targets = OOP_BASE_RATINGS.get(source_pos)
        if oop_targets:
            for t in oop_targets:
                if t not in natural_positions:
                    targets.add(t)
        # Infielder→1B fallback
        if source_pos in ("2B", "3B", "SS") and "1B" not in natural_positions:
            targets.add("1B")

    return sorted(targets)
