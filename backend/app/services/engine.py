"""Stockfish discovery and a small thread-safe pool of UCI engine processes."""

from __future__ import annotations

import logging
import os
import shutil
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Final

import chess.engine

LOG = logging.getLogger(__name__)

KNOWN_LOCATIONS: Final = (
    "/usr/games/stockfish",
    "/usr/bin/stockfish",
    "/usr/local/bin/stockfish",
    "/opt/homebrew/bin/stockfish",
)
PROBE_RETRY_SECONDS: Final = 60.0
ENGINE_ERRORS: Final = (chess.engine.EngineError, chess.engine.EngineTerminatedError, OSError, TimeoutError)


class EngineUnavailableError(RuntimeError):
    """No engine process could be used (missing binary, crash or all busy)."""


def _is_executable(path: str) -> bool:
    return os.path.isfile(path) and os.access(path, os.X_OK)


def find_stockfish(explicit: str | None = None) -> str | None:
    """Locate Stockfish: explicit path (``STOCKFISH_PATH``), then ``PATH``, then known paths."""
    if explicit:
        resolved = explicit if os.sep in explicit else shutil.which(explicit)
        if resolved and _is_executable(resolved):
            return resolved
        LOG.warning("STOCKFISH_PATH=%r is not executable; trying auto-discovery", explicit)
    on_path = shutil.which("stockfish")
    if on_path:
        return on_path
    return next((path for path in KNOWN_LOCATIONS if _is_executable(path)), None)


class EnginePool:
    """Lazily started, reusable engine processes.

    ``size`` processes at most; a request waits up to ``wait`` seconds for a free
    one. A process that fails is discarded and replaced on the next request.
    """

    def __init__(
        self,
        path: str | None,
        *,
        size: int = 1,
        threads: int = 1,
        hash_mb: int = 32,
        wait: float = 20.0,
        start_timeout: float = 10.0,
    ) -> None:
        self.path = path
        self._threads = threads
        self._hash_mb = hash_mb
        self._wait = wait
        self._start_timeout = start_timeout
        self._slots = threading.BoundedSemaphore(max(1, size))
        self._lock = threading.Lock()
        self._idle: list[chess.engine.SimpleEngine] = []
        self._name: str | None = None
        self._probe: tuple[bool, float] | None = None
        self._closed = False

    @property
    def name(self) -> str:
        return self._name or "Stockfish"

    def available(self) -> bool:
        """Whether an engine can be used, starting one if needed (result cached)."""
        if self.path is None or self._closed:
            return False
        probe = self._probe
        if probe is not None and (probe[0] or time.monotonic() - probe[1] < PROBE_RETRY_SECONDS):
            return probe[0]
        if not self._slots.acquire(blocking=False):
            return True  # every slot is busy, so engines are running
        try:
            engine = self._take_idle() or self._start()
            self._give_back(engine)
        except EngineUnavailableError:
            return False
        finally:
            self._slots.release()
        return True

    @contextmanager
    def acquire(self, wait: float | None = None) -> Iterator[chess.engine.SimpleEngine]:
        """Borrow an engine; engine failures surface as :class:`EngineUnavailableError`."""
        if self.path is None or self._closed:
            msg = "no engine binary"
            raise EngineUnavailableError(msg)
        if not self._slots.acquire(timeout=self._wait if wait is None else wait):
            msg = "all engines are busy"
            raise EngineUnavailableError(msg)
        engine: chess.engine.SimpleEngine | None = None
        try:
            engine = self._take_live_idle() or self._start()
            try:
                yield engine
            except ENGINE_ERRORS as exc:
                self._discard(engine)
                engine = None
                self._probe = None  # re-check on the next health probe
                msg = f"engine failure: {exc!r}"
                raise EngineUnavailableError(msg) from exc
        finally:
            if engine is not None:
                self._give_back(engine)
            self._slots.release()

    def close(self) -> None:
        with self._lock:
            self._closed = True
            engines, self._idle = self._idle, []
        for engine in engines:
            self._discard(engine)

    def _take_idle(self) -> chess.engine.SimpleEngine | None:
        with self._lock:
            return self._idle.pop() if self._idle else None

    def _take_live_idle(self) -> chess.engine.SimpleEngine | None:
        """An idle engine that still answers (dead ones are dropped)."""
        while (engine := self._take_idle()) is not None:
            try:
                engine.ping()
            except ENGINE_ERRORS:
                LOG.warning("dropping an idle engine that stopped responding")
                self._discard(engine)
                continue
            return engine
        return None

    def _give_back(self, engine: chess.engine.SimpleEngine) -> None:
        with self._lock:
            if not self._closed:
                self._idle.append(engine)
                return
        self._discard(engine)

    def _start(self) -> chess.engine.SimpleEngine:
        assert self.path is not None
        try:
            engine = chess.engine.SimpleEngine.popen_uci(self.path, timeout=self._start_timeout)
        except ENGINE_ERRORS as exc:
            self._probe = (False, time.monotonic())
            LOG.warning("cannot start %s: %r", self.path, exc)
            msg = f"cannot start engine: {exc!r}"
            raise EngineUnavailableError(msg) from exc
        try:
            options: dict[str, str | int | bool | None] = {}
            if "Threads" in engine.options:
                options["Threads"] = self._threads
            if "Hash" in engine.options:
                options["Hash"] = self._hash_mb
            engine.configure(options)
        except ENGINE_ERRORS as exc:
            self._discard(engine)
            self._probe = (False, time.monotonic())
            msg = f"cannot configure engine: {exc!r}"
            raise EngineUnavailableError(msg) from exc
        self._name = engine.id.get("name") or "Stockfish"
        self._probe = (True, time.monotonic())
        LOG.info("started %s (%s)", self._name, self.path)
        return engine

    @staticmethod
    def _discard(engine: chess.engine.SimpleEngine) -> None:
        try:
            engine.quit()
        except Exception:  # noqa: BLE001 - best effort, the process may already be gone
            try:
                engine.close()
            except Exception:
                LOG.debug("engine close failed", exc_info=True)
