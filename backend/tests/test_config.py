from pathlib import Path

import pytest

from app.config import DEFAULT_PUZZLES_PATH, Settings, parse_origins


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, ("*",)),
        ("", ("*",)),
        ("  ,  ", ("*",)),
        ("*", ("*",)),
        ("https://a.example", ("https://a.example",)),
        (
            " https://a.example/ , http://localhost:3000,https://a.example ",
            ("https://a.example", "http://localhost:3000"),
        ),
    ],
)
def test_parse_origins(raw: str | None, expected: tuple[str, ...]) -> None:
    assert parse_origins(raw) == expected


def test_defaults_from_an_empty_environment() -> None:
    settings = Settings.from_env({})
    assert settings == Settings()
    assert settings.puzzles_path == DEFAULT_PUZZLES_PATH
    assert settings.engine_enabled is True
    assert settings.engine_threads == 1
    assert settings.engine_hash_mb == 32


def test_values_from_the_environment() -> None:
    settings = Settings.from_env(
        {
            "CORS_ORIGINS": "https://x.example",
            "PUZZLES_PATH": "/data/p.json",
            "STOCKFISH_PATH": "/opt/sf",
            "ENGINE_ENABLED": "no",
            "ENGINE_POOL_SIZE": "3",
            "ENGINE_THREADS": "2",
            "ENGINE_HASH_MB": "64",
            "ENGINE_MAX_TIME": "0.5",
            "ENGINE_WAIT": "5",
        },
    )
    assert settings == Settings(
        cors_origins=("https://x.example",),
        puzzles_path=Path("/data/p.json"),
        stockfish_path="/opt/sf",
        engine_enabled=False,
        engine_pool_size=3,
        engine_threads=2,
        engine_hash_mb=64,
        engine_max_time=0.5,
        engine_wait=5.0,
    )


def test_invalid_values_fall_back_or_clamp() -> None:
    settings = Settings.from_env(
        {
            "ENGINE_ENABLED": "maybe",
            "ENGINE_POOL_SIZE": "lots",
            "ENGINE_HASH_MB": "999999",
            "ENGINE_WAIT": "-3",
        },
    )
    assert settings.engine_enabled is True
    assert settings.engine_pool_size == 1
    assert settings.engine_hash_mb == 4096
    assert settings.engine_wait == 0.0
