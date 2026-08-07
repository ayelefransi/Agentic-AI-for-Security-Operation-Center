"""
SQLite-based cache for IOC lookups with TTL.

Prevents re-querying the same IOC within a time window — critical for
surviving free-tier rate limits on VirusTotal, AbuseIPDB, etc.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from typing import Any, Optional

logger = logging.getLogger(__name__)

# Default cache TTL: 1 hour
DEFAULT_TTL_SECONDS = 3600

# Cache DB location (relative to backend/)
_CACHE_DB_PATH = os.path.join(os.path.dirname(__file__), "ioc_cache.db")


class IOCCache:
    """Thread-safe SQLite cache for IOC enrichment results."""

    def __init__(self, db_path: str = _CACHE_DB_PATH, ttl: int = DEFAULT_TTL_SECONDS):
        self.db_path = db_path
        self.ttl = ttl
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS ioc_cache (
                    cache_key TEXT PRIMARY KEY,
                    source TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_cache_created 
                ON ioc_cache(created_at)
            """)
            conn.commit()
        logger.info(f"IOC cache initialized at {self.db_path}")

    @staticmethod
    def _make_key(ioc_type: str, ioc_value: str, source: str) -> str:
        return f"{source}:{ioc_type}:{ioc_value}".lower()

    def get(self, ioc_type: str, ioc_value: str, source: str) -> Optional[dict[str, Any]]:
        """Retrieve a cached result if it exists and hasn't expired."""
        key = self._make_key(ioc_type, ioc_value, source)
        now = time.time()

        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT data, created_at FROM ioc_cache WHERE cache_key = ?",
                (key,),
            ).fetchone()

        if row is None:
            return None

        data_str, created_at = row
        if now - created_at > self.ttl:
            # Expired — delete and return None
            self.delete(ioc_type, ioc_value, source)
            return None

        try:
            return json.loads(data_str)
        except json.JSONDecodeError:
            return None

    def set(self, ioc_type: str, ioc_value: str, source: str, data: dict[str, Any]):
        """Store a result in the cache."""
        key = self._make_key(ioc_type, ioc_value, source)
        data_str = json.dumps(data, default=str)
        now = time.time()

        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                """INSERT OR REPLACE INTO ioc_cache (cache_key, source, data, created_at)
                   VALUES (?, ?, ?, ?)""",
                (key, source, data_str, now),
            )
            conn.commit()

    def delete(self, ioc_type: str, ioc_value: str, source: str):
        """Remove a specific entry."""
        key = self._make_key(ioc_type, ioc_value, source)
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("DELETE FROM ioc_cache WHERE cache_key = ?", (key,))
            conn.commit()

    def clear_expired(self):
        """Purge all expired entries."""
        cutoff = time.time() - self.ttl
        with sqlite3.connect(self.db_path) as conn:
            deleted = conn.execute(
                "DELETE FROM ioc_cache WHERE created_at < ?", (cutoff,)
            ).rowcount
            conn.commit()
        if deleted:
            logger.info(f"Purged {deleted} expired cache entries")

    def stats(self) -> dict[str, int]:
        """Return cache stats."""
        now = time.time()
        with sqlite3.connect(self.db_path) as conn:
            total = conn.execute("SELECT COUNT(*) FROM ioc_cache").fetchone()[0]
            valid = conn.execute(
                "SELECT COUNT(*) FROM ioc_cache WHERE created_at > ?",
                (now - self.ttl,),
            ).fetchone()[0]
        return {"total_entries": total, "valid_entries": valid, "expired": total - valid}


# Singleton instance
_cache_instance: Optional[IOCCache] = None


def get_cache() -> IOCCache:
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = IOCCache()
    return _cache_instance
