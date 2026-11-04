import os
import stat
from pathlib import Path

import chess
import chess.engine
import pytest

from app.services.engine import EnginePool, EngineUnavailableError, find_stockfish


def test_explicit_path_wins(stockfish_path: str) -> None:
    assert find_stockfish(stockfish_path) == stockfish_path


def test_bad_explicit_path_falls_back_to_discovery(tmp_path: Path) -> None:
    missing = str(tmp_path / "no-stockfish")
    assert find_stockfish(missing) == find_stockfish(None)


def test_non_executable_file_is_ignored(tmp_path: Path) -> None:
    fake = tmp_path / "stockfish"
    fake.write_text("not a binary")
    fake.chmod(stat.S_IRUSR | stat.S_IWUSR)
    assert find_stockfish(str(fake)) != str(fake)


def test_pool_without_binary() -> None:
    pool = EnginePool(None)
    assert pool.available() is False
    with pytest.raises(EngineUnavailableError, match="no engine"), pool.acquire():
        pass


def test_pool_with_broken_binary(tmp_path: Path) -> None:
    broken = tmp_path / "broken-engine"
    broken.write_text("#!/bin/sh\nexit 1\n")
    broken.chmod(0o755)
    pool = EnginePool(str(broken), wait=0.1, start_timeout=2.0)
    assert pool.available() is False
    with pytest.raises(EngineUnavailableError, match="cannot start"), pool.acquire():
        pass
    pool.close()


@pytest.mark.requires_stockfish
def test_pool_reuses_engines(stockfish_path: str) -> None:
    pool = EnginePool(stockfish_path, size=1, wait=0.2)
    try:
        assert pool.available() is True
        with pool.acquire() as first:
            info = first.analyse(chess.Board(), chess.engine.Limit(depth=4))
            assert "score" in info
            # The only engine is busy: a second request gives up quickly.
            with pytest.raises(EngineUnavailableError, match="busy"), pool.acquire(wait=0.05):
                pass
            assert pool.available() is True  # busy still means usable
        with pool.acquire() as second:
            assert second is first
        assert pool.name.startswith("Stockfish")
    finally:
        pool.close()
    assert pool.available() is False


def _use_dead_engine(pool: EnginePool) -> None:
    with pool.acquire() as engine:
        engine.quit()  # the process is gone: the next command fails
        engine.analyse(chess.Board(), chess.engine.Limit(depth=2))


@pytest.mark.requires_stockfish
def test_engine_failure_in_use_is_a_clean_error(stockfish_path: str) -> None:
    pool = EnginePool(stockfish_path, size=1)
    try:
        assert pool.available() is True
        with pytest.raises(EngineUnavailableError, match="engine failure"):
            _use_dead_engine(pool)
        with pool.acquire() as replacement:
            assert "score" in replacement.analyse(chess.Board(), chess.engine.Limit(depth=2))
        assert pool.available() is True
    finally:
        pool.close()


@pytest.mark.requires_stockfish
def test_idle_engine_that_died_is_replaced(stockfish_path: str) -> None:
    pool = EnginePool(stockfish_path, size=1)
    try:
        with pool.acquire() as engine:
            pass
        engine.quit()  # dies while idle in the pool
        with pool.acquire() as fresh:
            assert fresh is not engine
            assert "score" in fresh.analyse(chess.Board(), chess.engine.Limit(depth=2))
    finally:
        pool.close()


def test_stockfish_env_var_is_respected(monkeypatch: pytest.MonkeyPatch, stockfish_path: str) -> None:
    monkeypatch.setenv("STOCKFISH_PATH", stockfish_path)
    assert find_stockfish(os.environ["STOCKFISH_PATH"]) == stockfish_path
