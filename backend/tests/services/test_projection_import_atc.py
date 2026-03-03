"""Tests for ATC projection parsing in app.services.projection_import."""

import pytest

from app.services.projection_import import (
    FANGRAPHS_TEAM_MAP,
    parse_atc_hitter_projection,
)


def _make_atc_row(**overrides) -> dict[str, str]:
    """Build a sample ATC hitter row dict."""
    defaults = {
        "#": "1",
        "Name": "Aaron Judge",
        "Team": "NYY",
        "G": "155",
        "PA": "685",
        "AB": "560",
        "H": "160",
        "2B": "30",
        "3B": "2",
        "HR": "48",
        "R": "120",
        "RBI": "115",
        "BB": "110",
        "SO": "175",
        "HBP": "8",
        "SB": "8",
        "CS": "2",
        "BB%": "16.1%",
        "K%": "25.5%",
        "ISO": ".304",
        "BABIP": ".320",
        "AVG": ".286",
        "OBP": ".410",
        "SLG": ".590",
        "OPS": "1.000",
        "wOBA": ".420",
        "wRC+": "180",
        "ADP": "5.5",
        "Vol": "1.2",
        "Skew": "-0.3",
        "Dim": "0.5",
    }
    defaults.update(overrides)
    return defaults


class TestParseAtcHitterProjection:
    """Tests for parse_atc_hitter_projection()."""

    def test_counting_stats_parsed(self):
        row = _make_atc_row()
        result = parse_atc_hitter_projection(row, player_id=42)

        assert result["player_id"] == 42
        assert result["source"] == "ATC"
        assert result["pa"] == 685
        assert result["g"] == 155
        assert result["ab"] == 560
        assert result["h"] == 160
        assert result["b2"] == 30
        assert result["b3"] == 2
        assert result["hr"] == 48
        assert result["r"] == 120
        assert result["rbi"] == 115
        assert result["bb"] == 110
        assert result["so"] == 175
        assert result["hbp"] == 8
        assert result["sb"] == 8
        assert result["cs"] == 2

    def test_singles_derived(self):
        """b1 = H - 2B - 3B - HR."""
        row = _make_atc_row(H="160", **{"2B": "30", "3B": "2"}, HR="48")
        result = parse_atc_hitter_projection(row, player_id=1)
        assert result["b1"] == 160 - 30 - 2 - 48  # 80

    def test_total_bases_derived(self):
        """tb = b1 + 2*b2 + 3*b3 + 4*hr."""
        row = _make_atc_row(H="160", **{"2B": "30", "3B": "2"}, HR="48")
        result = parse_atc_hitter_projection(row, player_id=1)
        b1 = 160 - 30 - 2 - 48  # 80
        expected_tb = b1 + 2 * 30 + 3 * 2 + 4 * 48  # 80 + 60 + 6 + 192 = 338
        assert result["tb"] == expected_tb

    def test_rate_stats_from_decimal_strings(self):
        """ATC provides rate stats as '.290' format — parsed correctly."""
        row = _make_atc_row(AVG=".286", OBP=".410", SLG=".590", BABIP=".320")
        result = parse_atc_hitter_projection(row, player_id=1)

        assert result["avg"] == pytest.approx(0.286)
        assert result["obp"] == pytest.approx(0.410)
        assert result["slg"] == pytest.approx(0.590)
        assert result["babip"] == pytest.approx(0.320)

    def test_pecota_specific_fields_are_none(self):
        """PECOTA-only advanced metrics should be None/False for ATC."""
        row = _make_atc_row()
        result = parse_atc_hitter_projection(row, player_id=1)

        assert result["drc_plus"] is None
        assert result["drb"] is None
        assert result["drp"] is None
        assert result["vorp"] is None
        assert result["warp"] is None
        assert result["dc_fl"] is False
        assert result["drp_str"] is None
        assert result["comparables"] is None

    def test_empty_values_default_to_zero(self):
        """Missing or empty counting stats default to 0."""
        row = _make_atc_row(G="", PA="", AB="", H="", **{"2B": "", "3B": ""}, HR="")
        result = parse_atc_hitter_projection(row, player_id=1)

        assert result["g"] == 0
        assert result["pa"] == 0
        assert result["ab"] == 0
        assert result["h"] == 0
        assert result["b1"] == 0
        assert result["b2"] == 0
        assert result["b3"] == 0
        assert result["hr"] == 0
        assert result["tb"] == 0

    def test_empty_rate_stats_are_none(self):
        """Missing rate stats should be None, not 0."""
        row = _make_atc_row(AVG="", OBP="", SLG="", BABIP="")
        result = parse_atc_hitter_projection(row, player_id=1)

        assert result["avg"] is None
        assert result["obp"] is None
        assert result["slg"] is None
        assert result["babip"] is None


class TestFangraphsTeamMap:
    """Tests for FANGRAPHS_TEAM_MAP."""

    def test_common_mappings(self):
        assert FANGRAPHS_TEAM_MAP["NYY"] == "NYA"
        assert FANGRAPHS_TEAM_MAP["NYM"] == "NYN"
        assert FANGRAPHS_TEAM_MAP["CHC"] == "ChN"
        assert FANGRAPHS_TEAM_MAP["CHW"] == "ChA"
        assert FANGRAPHS_TEAM_MAP["SFG"] == "SF"
        assert FANGRAPHS_TEAM_MAP["SDP"] == "SD"
        assert FANGRAPHS_TEAM_MAP["KCR"] == "KC"
        assert FANGRAPHS_TEAM_MAP["TBR"] == "TB"
        assert FANGRAPHS_TEAM_MAP["WSN"] == "Was"

    def test_oakland_aliases(self):
        """Both ATH and OAK map to Ath."""
        assert FANGRAPHS_TEAM_MAP["ATH"] == "Ath"
        assert FANGRAPHS_TEAM_MAP["OAK"] == "Ath"

    def test_short_aliases(self):
        """Short forms also work."""
        assert FANGRAPHS_TEAM_MAP["SF"] == "SF"
        assert FANGRAPHS_TEAM_MAP["SD"] == "SD"
        assert FANGRAPHS_TEAM_MAP["TB"] == "TB"
