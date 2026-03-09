"""Unit tests for OOP rating calculations."""

import pytest

from app.lib.oop_ratings import OOP_BASE_RATINGS, SOURCE_AVERAGES, compute_oop_rating, get_valid_oop_targets


class TestComputeOOPRating:
    """Tests for compute_oop_rating()."""

    def test_ss_to_of_average_defense(self):
        """SS with average defense -> OF should get base rating."""
        rating = compute_oop_rating("SS", {"SS": 4.75}, "OF")
        assert rating == pytest.approx(2.07, abs=0.01)

    def test_ss_to_of_above_average(self):
        """Above-average SS gets higher OOP OF rating."""
        rating = compute_oop_rating("SS", {"SS": 5.00}, "OF")
        expected = 2.07 * (5.00 / 4.75)
        assert rating == pytest.approx(expected, abs=0.01)

    def test_ss_to_of_below_average(self):
        """Below-average SS gets lower OOP OF rating."""
        rating = compute_oop_rating("SS", {"SS": 4.00}, "OF")
        expected = 2.07 * (4.00 / 4.75)
        assert rating == pytest.approx(expected, abs=0.01)

    def test_multi_position_picks_best(self):
        """SS/3B player picks best route to OF."""
        # Via SS: 2.07 * (5.00 / 4.75) = 2.178
        # Via 3B: 2.01 * (2.80 / 2.65) = 2.123
        rating = compute_oop_rating("SS", {"SS": 5.00, "3B": 2.80}, "OF")
        via_ss = 2.07 * (5.00 / 4.75)
        via_3b = 2.01 * (2.80 / 2.65)
        assert rating == pytest.approx(max(via_ss, via_3b), abs=0.01)
        assert rating == pytest.approx(via_ss, abs=0.01)  # SS route wins

    def test_c_to_1b_no_multiplier(self):
        """C -> 1B uses base directly (no defense fields)."""
        rating = compute_oop_rating("C", {}, "1B")
        assert rating == pytest.approx(1.73, abs=0.01)

    def test_c_to_of_no_multiplier(self):
        """C -> OF uses base directly."""
        rating = compute_oop_rating("C", {}, "OF")
        assert rating == pytest.approx(1.93, abs=0.01)

    def test_dh_to_1b_no_multiplier(self):
        """DH -> 1B uses base directly."""
        rating = compute_oop_rating("DH", {}, "1B")
        assert rating == pytest.approx(1.70, abs=0.01)

    def test_dh_to_of_no_multiplier(self):
        """DH -> OF uses base directly."""
        rating = compute_oop_rating("DH", {}, "OF")
        assert rating == pytest.approx(1.90, abs=0.01)

    def test_infielder_to_1b_fallback(self):
        """SS -> 1B uses fallback (DEFENSE_AVERAGES['1B'] = 1.85)."""
        rating = compute_oop_rating("SS", {"SS": 4.75}, "1B")
        # base = 1.85, multiplier = 4.75 / 4.75 = 1.0
        assert rating == pytest.approx(1.85, abs=0.01)

    def test_2b_to_ss(self):
        """2B -> SS with average defense."""
        rating = compute_oop_rating("2B", {"2B": 4.25}, "SS")
        assert rating == pytest.approx(4.40, abs=0.01)

    def test_3b_to_2b(self):
        """3B -> 2B with average defense."""
        rating = compute_oop_rating("3B", {"3B": 2.65}, "2B")
        assert rating == pytest.approx(3.97, abs=0.01)

    def test_of_to_1b(self):
        """OF -> 1B (no source average for OF, uses base directly)."""
        rating = compute_oop_rating("OF", {"OF": 2.07}, "1B")
        assert rating == pytest.approx(1.79, abs=0.01)

    def test_1b_to_of(self):
        """1B -> OF with average defense."""
        rating = compute_oop_rating("1B", {"1B": 1.85}, "OF")
        assert rating == pytest.approx(1.94, abs=0.01)

    def test_returns_none_for_invalid_path(self):
        """Returns None when no valid source->target path exists."""
        assert compute_oop_rating("SS", {"SS": 4.75}, "C") is None
        assert compute_oop_rating("OF", {"OF": 2.07}, "SS") is None

    def test_every_base_rating_entry(self):
        """Every from->to in OOP_BASE_RATINGS produces a non-None rating."""
        for source, targets in OOP_BASE_RATINGS.items():
            for target in targets:
                positions = {}
                if source in SOURCE_AVERAGES:
                    positions[source] = SOURCE_AVERAGES[source]
                rating = compute_oop_rating(source, positions, target)
                assert rating is not None, f"Expected rating for {source}->{target}"
                assert rating > 0


class TestGetValidOOPTargets:
    """Tests for get_valid_oop_targets()."""

    def test_ss_targets(self):
        targets = get_valid_oop_targets("SS", {"SS": 4.75})
        assert "2B" in targets
        assert "3B" in targets
        assert "OF" in targets
        assert "1B" in targets  # infielder->1B fallback
        assert "SS" not in targets

    def test_excludes_natural_eligibility(self):
        """SS/2B player should not see 2B or SS."""
        targets = get_valid_oop_targets("SS", {"SS": 4.75, "2B": 4.10})
        assert "2B" not in targets
        assert "SS" not in targets
        assert "3B" in targets
        assert "OF" in targets

    def test_c_targets(self):
        targets = get_valid_oop_targets("C", {})
        assert "1B" in targets
        assert "OF" in targets
        assert "2B" not in targets
        assert "3B" not in targets

    def test_sorted(self):
        targets = get_valid_oop_targets("SS", {"SS": 4.75})
        assert targets == sorted(targets)
