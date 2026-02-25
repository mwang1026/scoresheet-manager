PITCHER_POSITIONS: tuple[str, ...] = ("P", "SR")


def is_pitcher_position(position: str) -> bool:
    return position in PITCHER_POSITIONS


# Scoresheet player ID range boundaries for AL/NL league eligibility.
# AL home range:  scoresheet_id < AL_NL_BOUNDARY
# NL home range:  AL_NL_BOUNDARY <= scoresheet_id < NL_HOME_END
# Interleague AL: INTERLEAGUE_AL_START <= scoresheet_id < INTERLEAGUE_NL_START
# Interleague NL: INTERLEAGUE_NL_START <= scoresheet_id < INTERLEAGUE_END
AL_NL_BOUNDARY: int = 1000
NL_HOME_END: int = 2000
INTERLEAGUE_AL_START: int = 4000
INTERLEAGUE_NL_START: int = 5000
INTERLEAGUE_END: int = 6000
