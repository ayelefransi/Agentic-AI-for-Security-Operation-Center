import sqlite3
import json
import os
from datetime import datetime
import logging
from typing import List, Optional

from schemas.schemas import IncidentState

logger = logging.getLogger(__name__)

DB_PATH = "/tmp/incidents.db" if os.environ.get("VERCEL") else os.path.join(os.path.dirname(__file__), "incidents.db")

def _get_connection():
    # Detect if we are in a testing environment where threading rules need relaxing
    return sqlite3.connect(DB_PATH, check_same_thread=False)

def init_db():
    """Initialize the database schema."""
    try:
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS incidents (
                    id TEXT PRIMARY KEY,
                    status TEXT,
                    created_at TIMESTAMP,
                    data TEXT
                )
            """)
            conn.commit()
            logger.info(f"Database initialized at {DB_PATH}")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

def save_incident(incident: IncidentState):
    """Insert or update an incident in the database."""
    try:
        data_json = incident.model_dump_json()
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO incidents (id, status, created_at, data)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    data=excluded.data
            """, (incident.id, incident.status.value, incident.created_at, data_json))
            conn.commit()
    except Exception as e:
        logger.error(f"Failed to save incident {incident.id}: {e}")

def get_incident(incident_id: str) -> Optional[IncidentState]:
    """Retrieve a single incident by ID."""
    try:
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM incidents WHERE id = ?", (incident_id,))
            row = cursor.fetchone()
            if row:
                return IncidentState.model_validate_json(row[0])
    except Exception as e:
        logger.error(f"Failed to retrieve incident {incident_id}: {e}")
    return None

def list_incidents() -> List[IncidentState]:
    """List all incidents, ordered by created_at descending."""
    try:
        with _get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM incidents ORDER BY created_at DESC")
            rows = cursor.fetchall()
            return [IncidentState.model_validate_json(row[0]) for row in rows]
    except Exception as e:
        logger.error(f"Failed to list incidents: {e}")
        return []

# Initialize on module import
init_db()
