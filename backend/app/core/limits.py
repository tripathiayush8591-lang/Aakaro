from collections import deque
from contextlib import contextmanager
from time import monotonic

from app.core.errors import AppError


class UserLimiter:
    """Event-loop-local controls. Use one worker; these are not shared across instances."""

    def __init__(self, limit: int, window: int):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque[float]] = {}
        self.active: set[str] = set()

    @contextmanager
    def acquire(self, uid: str):
        now = monotonic()
        for key in list(self.hits):
            while self.hits[key] and self.hits[key][0] <= now - self.window:
                self.hits[key].popleft()
            if not self.hits[key] and key not in self.active:
                del self.hits[key]
        if uid in self.active:
            raise AppError(
                429,
                "REQUEST_IN_PROGRESS",
                "An AI request is already running. Wait for it to finish.",
                True,
            )
        hits = self.hits.setdefault(uid, deque())
        if len(hits) >= self.limit:
            raise AppError(
                429,
                "USER_RATE_LIMIT",
                f"Too many requests. Try again after {self.window} seconds.",
                True,
            )
        hits.append(now)
        self.active.add(uid)
        try:
            yield
        finally:
            self.active.discard(uid)
