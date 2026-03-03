"""Tests for ATC pitcher projection parsing in app.services.projection_import."""

import pytest

from app.services.projection_import import parse_atc_pitcher_projection


def _make_atc_pitcher_row(**overrides) -> dict[str, str]:
    """Build a sample ATC pitcher row dict."""
    defaults = {
        "#": "1",
        "Name": "Tarik Skubal",
        "Team": "DET",
        "GS": "29",
        "G": "29",
        "IP": "188.1",
        "W": "14",
        "L": "7",
        "QS": "18",
        "SV": "0",
        "HLD": "0",
        "H": "144",
        "ER": "57",
        "HR": "18",
        "SO": "228",
        "BB": "38",
        "K/9": "10.91",
        "BB/9": "1.83",
        "K/BB": "5.95",
        "HR/9": "0.88",
        "AVG": ".208",
        "WHIP": "0.97",
        "BABIP": ".282",
        "LOB%": "76.9%",
        "ERA": "2.72",
        "FIP": "2.69",
        "ADP": "6.8",
        "Vol": "3.34",
        "Skew": "1.21",
        "Dim": "2.28",
    }
    defaults.update(overrides)
    return defaults


class TestParseAtcPitcherProjection:
    """Tests for parse_atc_pitcher_projection()."""

    def test_counting_stats_parsed(self):
        row = _make_atc_pitcher_row()
        result = parse_atc_pitcher_projection(row, player_id=42)

        assert result["player_id"] == 42
        assert result["source"] == "ATC"
        assert result["w"] == 14
        assert result["l"] == 7
        assert result["sv"] == 0
        assert result["hld"] == 0
        assert result["g"] == 29
        assert result["gs"] == 29
        assert result["qs"] == 18
        assert result["h"] == 144
        assert result["hr"] == 18
        assert result["so"] == 228
        assert result["bb"] == 38

    def test_ip_converted_to_outs(self):
        """IP 188.1 → 188*3 + 1 ≈ round(188.1*3) = 564."""
        row = _make_atc_pitcher_row(IP="192.0")
        result = parse_atc_pitcher_projection(row, player_id=1)
        assert result["ip_outs"] == 576  # 192 * 3

    def test_ip_with_partial_innings(self):
        """IP 188.1 → round(188.1 * 3) = round(564.3) = 564."""
        row = _make_atc_pitcher_row(IP="188.1")
        result = parse_atc_pitcher_projection(row, player_id=1)
        assert result["ip_outs"] == 564

    def test_rate_stats_parsed(self):
        row = _make_atc_pitcher_row(
            ERA="2.72", WHIP="0.97", BABIP=".282",
        )
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["era"] == pytest.approx(2.72)
        assert result["whip"] == pytest.approx(0.97)
        assert result["babip"] == pytest.approx(0.282)

    def test_k9_and_bb9_mapped(self):
        """K/9 maps to so9, BB/9 maps to bb9."""
        row = _make_atc_pitcher_row(**{"K/9": "10.91", "BB/9": "1.83"})
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["so9"] == pytest.approx(10.91)
        assert result["bb9"] == pytest.approx(1.83)

    def test_fip_parsed(self):
        """ATC provides FIP — unlike hitter PECOTA-only fields, this is stored."""
        row = _make_atc_pitcher_row(FIP="2.69")
        result = parse_atc_pitcher_projection(row, player_id=1)
        assert result["fip"] == pytest.approx(2.69)

    def test_bf_and_hbp_default_to_zero(self):
        """ATC doesn't provide bf or hbp — they default to 0."""
        row = _make_atc_pitcher_row()
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["bf"] == 0
        assert result["hbp"] == 0

    def test_pecota_specific_fields_are_none(self):
        """PECOTA-only advanced metrics should be None/False for ATC."""
        row = _make_atc_pitcher_row()
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["cfip"] is None
        assert result["dra"] is None
        assert result["dra_minus"] is None
        assert result["warp"] is None
        assert result["gb_percent"] is None
        assert result["dc_fl"] is False
        assert result["comparables"] is None

    def test_empty_counting_stats_default_to_zero(self):
        """Missing or empty counting stats default to 0."""
        row = _make_atc_pitcher_row(
            W="", L="", SV="", HLD="", G="", GS="", QS="",
            H="", HR="", SO="", BB="", IP="",
        )
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["w"] == 0
        assert result["l"] == 0
        assert result["sv"] == 0
        assert result["hld"] == 0
        assert result["g"] == 0
        assert result["gs"] == 0
        assert result["qs"] == 0
        assert result["h"] == 0
        assert result["hr"] == 0
        assert result["so"] == 0
        assert result["bb"] == 0
        assert result["ip_outs"] == 0

    def test_empty_rate_stats_are_none(self):
        """Missing rate stats should be None, not 0."""
        row = _make_atc_pitcher_row(
            ERA="", WHIP="", BABIP="", FIP="",
            **{"K/9": "", "BB/9": ""},
        )
        result = parse_atc_pitcher_projection(row, player_id=1)

        assert result["era"] is None
        assert result["whip"] is None
        assert result["babip"] is None
        assert result["fip"] is None
        assert result["so9"] is None
        assert result["bb9"] is None

    def test_reliever_stats(self):
        """Reliever with saves and holds parses correctly."""
        row = _make_atc_pitcher_row(
            Name="Emmanuel Clase", Team="CLE",
            GS="0", G="65", IP="65.0", W="4", L="3",
            QS="0", SV="40", HLD="0",
            H="50", ER="15", HR="3", SO="60", BB="15",
        )
        result = parse_atc_pitcher_projection(row, player_id=99)

        assert result["gs"] == 0
        assert result["g"] == 65
        assert result["sv"] == 40
        assert result["ip_outs"] == 195  # 65 * 3
