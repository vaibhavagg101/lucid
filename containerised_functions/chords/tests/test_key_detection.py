"""Unit tests for the key detection module used by the chords service."""

import csv

import numpy as np
import pytest

from key_detection import (
    PITCH_CLASSES,
    chord_to_pitch_distribution,
    create_key_profiles,
    detect_key_from_chords,
    parse_chord,
)


def _write_chords_csv(tmp_path, rows):
    path = tmp_path / "chords.csv"
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["start_time", "end_time", "chord"])
        writer.writerows(rows)
    return str(path)


class TestParseChord:
    def test_returns_none_for_no_chord(self):
        assert parse_chord("N") == (None, None)

    def test_parses_major_chord(self):
        assert parse_chord("C:maj") == (0, "maj")

    def test_parses_sharp_root(self):
        assert parse_chord("C#:min") == (1, "min")

    def test_handles_inversions(self):
        assert parse_chord("G:7/C") == (7, "7")

    def test_returns_none_for_unparseable_chord(self):
        assert parse_chord("not-a-chord") == (None, None)


class TestChordToPitchDistribution:
    def test_major_triad(self):
        pitches = chord_to_pitch_distribution(0, "maj")
        expected = np.zeros(12)
        expected[[0, 4, 7]] = 1.0
        np.testing.assert_array_equal(pitches, expected)

    def test_minor_triad(self):
        pitches = chord_to_pitch_distribution(9, "min")
        expected = np.zeros(12)
        expected[[9, 0, 4]] = 1.0
        np.testing.assert_array_equal(pitches, expected)

    def test_dominant_seventh_adds_minor_seventh(self):
        pitches = chord_to_pitch_distribution(7, "7")
        expected = np.zeros(12)
        expected[[7, 11, 2, 5]] = 1.0
        np.testing.assert_array_equal(pitches, expected)

    def test_diminished_triad(self):
        pitches = chord_to_pitch_distribution(2, "dim")
        expected = np.zeros(12)
        expected[[2, 5, 8]] = 1.0
        np.testing.assert_array_equal(pitches, expected)

    def test_unknown_quality_falls_back_to_root_only(self):
        pitches = chord_to_pitch_distribution(4, "sus4")
        expected = np.zeros(12)
        expected[4] = 1.0
        np.testing.assert_array_equal(pitches, expected)


class TestCreateKeyProfiles:
    def test_returns_all_24_keys(self):
        profiles = create_key_profiles()
        assert len(profiles) == 24
        for pitch in PITCH_CLASSES:
            assert f"{pitch} Major" in profiles
            assert f"{pitch} Minor" in profiles

    def test_profiles_are_mean_centred(self):
        profiles = create_key_profiles()
        for profile in profiles.values():
            assert abs(np.mean(profile)) < 1e-10


class TestDetectKeyFromChords:
    def test_detects_c_major_from_a_c_f_g_progression(self, tmp_path):
        csv_path = _write_chords_csv(
            tmp_path,
            [
                (0.0, 4.0, "C:maj"),
                (4.0, 6.0, "F:maj"),
                (6.0, 8.0, "G:7"),
                (8.0, 10.0, "C:maj"),
            ],
        )

        assert detect_key_from_chords(csv_path) == "C Major"

    def test_detects_a_minor_from_an_am_dm_em_progression(self, tmp_path):
        csv_path = _write_chords_csv(
            tmp_path,
            [
                (0.0, 4.0, "A:min"),
                (4.0, 6.0, "D:min"),
                (6.0, 8.0, "E:min"),
                (8.0, 10.0, "A:min"),
            ],
        )

        assert detect_key_from_chords(csv_path) == "A Minor"

    def test_returns_unknown_for_no_chords(self, tmp_path):
        csv_path = _write_chords_csv(tmp_path, [(0.0, 4.0, "N"), (4.0, 8.0, "N")])

        assert detect_key_from_chords(csv_path) == "Unknown"

    def test_returns_none_for_missing_columns(self, tmp_path):
        path = tmp_path / "bad.csv"
        with open(path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["a", "b"])
            writer.writerow([1, 2])

        assert detect_key_from_chords(str(path)) is None
