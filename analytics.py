"""
Nesso Content Engine V20 — Render Analytics (SQLite)

Tracks every render with metadata for understanding what works.
"""

import logging
import os
import sqlite3
from datetime import datetime

from config import BASE_DIR

log = logging.getLogger(__name__)

DB_PATH = os.path.join(BASE_DIR, "analytics.db")


def _get_db():
    """Get a database connection, creating tables if needed."""
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS renders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            hook_query TEXT,
            hook_category TEXT,
            hook_description TEXT,
            transition TEXT,
            script_length INTEGER,
            duration REAL,
            theme TEXT,
            success INTEGER NOT NULL,
            error TEXT
        )
    """)
    db.commit()
    return db


def log_render(
    hook_query: str = "",
    hook_category: str = "",
    hook_description: str = "",
    transition: str = "",
    script_length: int = 0,
    duration: float = 0,
    theme: str = "",
    success: bool = True,
    error: str = "",
):
    """Log a render to the analytics database."""
    try:
        db = _get_db()
        db.execute(
            """INSERT INTO renders
               (timestamp, hook_query, hook_category, hook_description,
                transition, script_length, duration, theme, success, error)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                datetime.utcnow().isoformat(),
                hook_query,
                hook_category,
                hook_description,
                transition,
                script_length,
                duration,
                theme,
                1 if success else 0,
                error,
            ),
        )
        db.commit()
        db.close()
    except Exception as e:
        log.warning("Analytics log failed: %s", e)


def get_stats() -> dict:
    """Get render statistics."""
    try:
        db = _get_db()
        cur = db.cursor()

        total = cur.execute("SELECT COUNT(*) FROM renders").fetchone()[0]
        successes = cur.execute("SELECT COUNT(*) FROM renders WHERE success=1").fetchone()[0]
        failures = total - successes

        avg_dur = cur.execute(
            "SELECT AVG(duration) FROM renders WHERE success=1 AND duration > 0"
        ).fetchone()[0] or 0

        # Top categories
        top_cats = cur.execute(
            """SELECT hook_category, COUNT(*) as cnt FROM renders
               WHERE success=1 GROUP BY hook_category ORDER BY cnt DESC LIMIT 5"""
        ).fetchall()

        # Top transitions
        top_trans = cur.execute(
            """SELECT transition, COUNT(*) as cnt FROM renders
               WHERE success=1 AND transition != '' GROUP BY transition ORDER BY cnt DESC LIMIT 5"""
        ).fetchall()

        # Recent errors
        recent_errors = cur.execute(
            """SELECT timestamp, error FROM renders
               WHERE success=0 ORDER BY id DESC LIMIT 3"""
        ).fetchall()

        # Last 24h
        last_24h = cur.execute(
            """SELECT COUNT(*) FROM renders
               WHERE timestamp > datetime('now', '-1 day')"""
        ).fetchone()[0]

        db.close()

        return {
            "total": total,
            "successes": successes,
            "failures": failures,
            "avg_duration": round(avg_dur, 1),
            "top_categories": top_cats,
            "top_transitions": top_trans,
            "recent_errors": recent_errors,
            "last_24h": last_24h,
        }
    except Exception as e:
        log.warning("Analytics stats failed: %s", e)
        return {"total": 0, "successes": 0, "failures": 0, "error": str(e)}
