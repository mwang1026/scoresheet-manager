"""Tests for app.services.name_matching — shared name matching module."""

import pytest

from app.services.name_matching import (
    FANGRAPHS_TEAM_MAP,
    NAME_SUFFIXES,
    PLAYER_NAME_OVERRIDES,
    ROTOWIRE_TEAM_MAP,
    TEAM_ABBR_MAP,
    build_player_lookups,
    match_player,
    normalize_for_match,
    normalize_name,
    split_name,
)


# ---------------------------------------------------------------------------
# TEAM_ABBR_MAP
# ---------------------------------------------------------------------------


class TestTeamAbbrMap:
    """TEAM_ABBR_MAP covers all FanGraphs/ATC and RotoWire abbreviations."""

    def test_common_fangraphs_mappings(self):
        assert TEAM_ABBR_MAP["NYY"] == "NYA"
        assert TEAM_ABBR_MAP["NYM"] == "NYN"
        assert TEAM_ABBR_MAP["CHC"] == "ChN"
        assert TEAM_ABBR_MAP["CHW"] == "ChA"
        assert TEAM_ABBR_MAP["SFG"] == "SF"
        assert TEAM_ABBR_MAP["SDP"] == "SD"
        assert TEAM_ABBR_MAP["KCR"] == "KC"
        assert TEAM_ABBR_MAP["TBR"] == "TB"
        assert TEAM_ABBR_MAP["WSN"] == "Was"

    def test_rotowire_specific_keys(self):
        """RotoWire uses CWS and WSH that FanGraphs doesn't."""
        assert TEAM_ABBR_MAP["CWS"] == "ChA"
        assert TEAM_ABBR_MAP["WSH"] == "Was"

    def test_oakland_aliases(self):
        assert TEAM_ABBR_MAP["ATH"] == "Ath"
        assert TEAM_ABBR_MAP["OAK"] == "Ath"

    def test_short_form_aliases(self):
        assert TEAM_ABBR_MAP["SF"] == "SF"
        assert TEAM_ABBR_MAP["SD"] == "SD"
        assert TEAM_ABBR_MAP["TB"] == "TB"
        assert TEAM_ABBR_MAP["KC"] == "KC"

    def test_backward_compat_aliases_are_same_object(self):
        """FANGRAPHS_TEAM_MAP and ROTOWIRE_TEAM_MAP are the same dict."""
        assert FANGRAPHS_TEAM_MAP is TEAM_ABBR_MAP
        assert ROTOWIRE_TEAM_MAP is TEAM_ABBR_MAP


# ---------------------------------------------------------------------------
# PLAYER_NAME_OVERRIDES
# ---------------------------------------------------------------------------


class TestPlayerNameOverrides:
    def test_override_count(self):
        """Exactly 7 overrides remain after normalization improvements."""
        assert len(PLAYER_NAME_OVERRIDES) == 7

    def test_override_keys_use_scoresheet_teams(self):
        """Override keys use Scoresheet team format, not source format."""
        for _name, team in PLAYER_NAME_OVERRIDES:
            assert team in TEAM_ABBR_MAP.values(), f"Team {team!r} not a Scoresheet abbreviation"

    def test_specific_overrides(self):
        assert PLAYER_NAME_OVERRIDES[("Jung Hoo Lee", "SF")] == "JungHoo Lee"
        assert PLAYER_NAME_OVERRIDES[("Dom Keegan", "TB")] == "Dominic Keegan"
        assert PLAYER_NAME_OVERRIDES[("Leo De Vries", "Ath")] == "Leodalis DeVries"
        assert PLAYER_NAME_OVERRIDES[("Dax Fulton", "Mia")] == "Daxton Fulton"


# ---------------------------------------------------------------------------
# normalize_name
# ---------------------------------------------------------------------------


class TestNormalizeName:
    def test_basic_lowercase(self):
        assert normalize_name("Mike Trout") == "mike trout"

    def test_strips_accents(self):
        assert normalize_name("José Ramírez") == "jose ramirez"

    def test_strips_parenthetical(self):
        assert normalize_name("Smith(Tex)") == "smith"
        assert normalize_name("Jones (hurt)") == "jones"

    def test_strips_two_way_suffix(self):
        assert normalize_name("Ohtani-P") == "ohtani"
        assert normalize_name("Ohtani-H") == "ohtani"

    def test_strips_trailing_middle_initial(self):
        """Enhancement 1: 'EuryR.' → 'eury', 'JoshH.' → 'josh'."""
        assert normalize_name("EuryR.") == "eury"
        assert normalize_name("JoshH.") == "josh"
        assert normalize_name("MaxP.") == "max"
        assert normalize_name("CarlosE.") == "carlos"
        assert normalize_name("JaredK.") == "jared"

    def test_trailing_initial_safe_for_dj(self):
        """DJ (all caps) should NOT be stripped."""
        assert normalize_name("DJ") == "dj"

    def test_trailing_initial_safe_for_normal_names(self):
        """Regular names without trailing initial are unaffected."""
        assert normalize_name("Mike") == "mike"
        assert normalize_name("Ronald") == "ronald"

    def test_strips_dots(self):
        assert normalize_name("J.D.") == "jd"

    def test_combined_parenthetical_and_accent(self):
        """Accent + parenthetical both stripped."""
        assert normalize_name("Pérez(Mia)") == "perez"

    def test_middle_initial_on_standalone_token(self):
        """Middle initial stripping works on individual first name tokens."""
        # In practice, normalize_name is called on individual name parts
        assert normalize_name("EuryR.") == "eury"
        assert normalize_name("Pérez") == "perez"


# ---------------------------------------------------------------------------
# normalize_for_match
# ---------------------------------------------------------------------------


class TestNormalizeForMatch:
    def test_strips_all_spaces(self):
        """Enhancement 2: compound surnames match regardless of spacing."""
        assert normalize_for_match("De La Cruz") == "delacruz"
        assert normalize_for_match("DeLaCruz") == "delacruz"

    def test_del_castillo_variants(self):
        assert normalize_for_match("Del Castillo") == "delcastillo"
        assert normalize_for_match("DelCastillo") == "delcastillo"

    def test_de_los_santos_variants(self):
        assert normalize_for_match("De Los Santos") == "delossantos"
        assert normalize_for_match("DeLosSantos") == "delossantos"

    def test_la_sorsa_variants(self):
        assert normalize_for_match("La Sorsa") == "lasorsa"
        assert normalize_for_match("LaSorsa") == "lasorsa"

    def test_woods_richardson_variants(self):
        assert normalize_for_match("Woods Richardson") == "woodsrichardson"
        assert normalize_for_match("WoodsRichardson") == "woodsrichardson"

    def test_includes_middle_initial_stripping(self):
        """Middle initial stripping works on individual tokens passed through normalize_for_match."""
        assert normalize_for_match("EuryR.") == "eury"

    def test_basic_name(self):
        assert normalize_for_match("Mike Trout") == "miketrout"


# ---------------------------------------------------------------------------
# split_name
# ---------------------------------------------------------------------------


class TestSplitName:
    def test_basic_split(self):
        assert split_name("Mike Trout") == ("mike", "trout")

    def test_strips_suffix(self):
        assert split_name("Vladimir Guerrero Jr.") == ("vladimir", "guerrero")

    def test_single_name(self):
        first, last = split_name("Ohtani")
        assert first == "ohtani"
        assert last == ""

    def test_strips_middle_initial_token(self):
        """Enhancement 3: 'Jose A. Ferrer' → ('jose', 'ferrer')."""
        assert split_name("Jose A. Ferrer") == ("jose", "ferrer")

    def test_preserves_jd_at_start(self):
        """J.D. at position 0 is kept, not stripped."""
        first, last = split_name("J.D. Martinez")
        assert first == "jd"
        assert last == "martinez"

    def test_multi_word_last_name(self):
        first, last = split_name("Elly De La Cruz")
        assert first == "elly"
        assert last == "de la cruz"

    def test_compound_name_with_accent(self):
        first, last = split_name("José Ramírez")
        assert first == "jose"
        assert last == "ramirez"

    def test_two_word_name_no_suffix(self):
        assert split_name("Aaron Judge") == ("aaron", "judge")

    def test_middle_initial_with_no_dot(self):
        """Single-letter token without dot is also stripped from middle."""
        assert split_name("Jose A Ferrer") == ("jose", "ferrer")


# ---------------------------------------------------------------------------
# build_player_lookups + match_player (unit tests with mock DB)
# ---------------------------------------------------------------------------


class _FakeRow:
    """Mimics a SQLAlchemy result row for build_player_lookups."""

    def __init__(self, first_name, last_name, mlb_id, team, position):
        self.first_name = first_name
        self.last_name = last_name
        self.mlb_id = mlb_id
        self.current_mlb_team = team
        self.primary_position = position

    def __iter__(self):
        return iter([self.first_name, self.last_name, self.mlb_id,
                     self.current_mlb_team, self.primary_position])


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDB:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, _stmt):
        return _FakeResult(self._rows)


def _make_db(*players):
    """Create a fake DB with the given player tuples: (first, last, mlb_id, team, pos)."""
    rows = [tuple(p) for p in players]
    return _FakeDB(rows)


class TestBuildPlayerLookups:
    def test_exact_lookup_uses_normalize_for_match(self):
        """Compound names should be accessible with spaces stripped."""
        db = _make_db(("Elly", "DeLaCruz", 682829, "Cin", "SS"))
        exact, name = build_player_lookups(db)
        # "delacruz" with no spaces
        assert ("elly", "delacruz", "Cin") in exact

    def test_middle_initial_stripped_from_first_name(self):
        """'EuryR.' in DB → key first='eury'."""
        db = _make_db(("EuryR.", "Perez", 691587, "Mia", "P"))
        exact, name = build_player_lookups(db)
        assert ("eury", "perez", "Mia") in exact

    def test_name_lookup_populated(self):
        db = _make_db(("Mike", "Trout", 545361, "LAA", "CF"))
        _exact, name = build_player_lookups(db)
        assert ("mike", "trout") in name
        assert name[("mike", "trout")][0] == (545361, "CF")

    def test_jr_stripped_from_first(self):
        """'VladimirJr.' → 'vladimir'."""
        db = _make_db(("VladimirJr.", "Guerrero", 665489, "Tor", "1B"))
        exact, _name = build_player_lookups(db)
        assert ("vladimir", "guerrero", "Tor") in exact

    def test_compound_last_name_no_space(self):
        """'WoodsRichardson' matches 'woodsrichardson'."""
        db = _make_db(("Simeon", "WoodsRichardson", 680573, "Min", "P"))
        exact, _name = build_player_lookups(db)
        assert ("simeon", "woodsrichardson", "Min") in exact


class TestMatchPlayer:
    def test_exact_match_by_team(self):
        db = _make_db(("Mike", "Trout", 545361, "LAA", "CF"))
        exact, name = build_player_lookups(db)
        assert match_player("mike", "trout", "LAA", exact, name) == 545361

    def test_name_only_fallback(self):
        db = _make_db(("Mike", "Trout", 545361, "LAA", "CF"))
        exact, name = build_player_lookups(db)
        assert match_player("mike", "trout", None, exact, name) == 545361

    def test_prefer_hitter_by_default(self):
        """Two-way player: default prefers non-pitcher."""
        db = _make_db(
            ("Shohei", "Ohtani", 660271, "LAD", "DH"),
            ("Shohei", "Ohtani", 660272, "LAD", "P"),
        )
        exact, name = build_player_lookups(db)
        result = match_player("shohei", "ohtani", None, exact, name)
        assert result == 660271  # the DH

    def test_prefer_pitcher_kwarg(self):
        """prefer_pitcher=True picks the pitcher entry."""
        db = _make_db(
            ("Shohei", "Ohtani", 660271, "LAD", "DH"),
            ("Shohei", "Ohtani", 660272, "LAD", "P"),
        )
        exact, name = build_player_lookups(db)
        result = match_player("shohei", "ohtani", None, exact, name, prefer_pitcher=True)
        assert result == 660272  # the pitcher

    def test_no_match_returns_none(self):
        db = _make_db(("Mike", "Trout", 545361, "LAA", "CF"))
        exact, name = build_player_lookups(db)
        assert match_player("nobody", "here", "LAA", exact, name) is None

    def test_compound_name_match(self):
        """'de la cruz' (with spaces from split_name) matches 'delacruz' in lookup."""
        db = _make_db(("Elly", "DeLaCruz", 682829, "Cin", "SS"))
        exact, name = build_player_lookups(db)
        # split_name("Elly De La Cruz") → ("elly", "de la cruz")
        # match_player strips spaces internally → "delacruz"
        assert match_player("elly", "de la cruz", "Cin", exact, name) == 682829

    def test_compound_name_match_name_only(self):
        """Compound name match works without team too."""
        db = _make_db(("Elly", "DeLaCruz", 682829, "Cin", "SS"))
        exact, name = build_player_lookups(db)
        assert match_player("elly", "de la cruz", None, exact, name) == 682829

    def test_middle_initial_stripped_in_matching(self):
        """DB 'EuryR. Perez' matches ATC 'Eury Pérez'."""
        db = _make_db(("EuryR.", "Perez", 691587, "Mia", "P"))
        exact, name = build_player_lookups(db)
        # After normalize_name: "eury" (initial stripped), "perez" (accent stripped)
        assert match_player("eury", "perez", "Mia", exact, name) == 691587
