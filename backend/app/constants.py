PITCHER_POSITIONS: tuple[str, ...] = ("P", "SR")


def is_pitcher_position(position: str) -> bool:
    return position in PITCHER_POSITIONS
