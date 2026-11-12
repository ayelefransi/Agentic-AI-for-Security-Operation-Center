"""
Unit & integration tests for authentication, user management, and dashboard endpoints.
"""

from datetime import datetime, timezone
from fastapi.testclient import TestClient
import pytest

import db
from api.main import app
from middleware.auth import SESSION_COOKIE_NAME
from tests.conftest import (
    TEST_ADMIN_EMAIL,
    TEST_ADMIN_PASSWORD,
    TEST_ANALYST_EMAIL,
    TEST_ANALYST_PASSWORD,
)
from schemas.schemas import (
    IncidentState,
    IncidentStatus,
    AgentStepLog,
    AgentNodeStatus,
    TriageScore,
    Severity,
)


@pytest.fixture(autouse=True)
def isolated_env(tmp_path, monkeypatch):
    """Use an isolated SQLite DB for each test."""
    test_db = str(tmp_path / "test_incidents.db")
    monkeypatch.setattr(db, "DB_PATH", test_db)
    db.init_db()
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def analyst_client(client):
    """Client signed in as the analyst through the real login flow (session cookie)."""
    res = _login_as(client, TEST_ANALYST_EMAIL, TEST_ANALYST_PASSWORD, ip="10.0.9.1")
    assert res.status_code == 200
    return client


def _login_as(client: TestClient, email: str, password: str, ip: str = "10.0.0.10"):
    return client.post(
        "/api/auth/login",
        json={"email": email, "password": password, "remember_me": False},
        headers={"X-Forwarded-For": ip},
    )


class TestAuthAndLockout:
    def test_login_success_sets_httponly_cookie_and_returns_me(self, client):
        res = _login_as(client, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, ip="10.0.1.1")
        assert res.status_code == 200
        data = res.json()
        assert data["user"]["email"] == TEST_ADMIN_EMAIL
        assert data["user"]["role"] == "admin"

        cookie_header = res.headers.get("set-cookie", "")
        assert SESSION_COOKIE_NAME in cookie_header
        assert "HttpOnly" in cookie_header or "httponly" in cookie_header.lower()
        assert "Max-Age=28800" in cookie_header  # 8 hours

        me = client.get("/api/auth/me")
        assert me.status_code == 200
        assert me.json()["email"] == TEST_ADMIN_EMAIL

    def test_auth_me_requires_session(self, client):
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_account_locks_for_15_minutes_after_5_failed_attempts(self, client):
        for i in range(4):
            res = _login_as(client, TEST_ANALYST_EMAIL, "WrongPass!", ip="10.0.2.1")
            assert res.status_code == 401
            assert "incorrect" in res.json()["detail"].lower()

        fifth = _login_as(client, TEST_ANALYST_EMAIL, "WrongPass!", ip="10.0.2.1")
        assert fifth.status_code == 401
        assert "locked" in fifth.json()["detail"].lower()
        assert "15 minutes" in fifth.json()["detail"].lower()

        # Even valid password fails while locked
        locked_attempt = _login_as(client, TEST_ANALYST_EMAIL, TEST_ANALYST_PASSWORD, ip="10.0.2.2")
        assert locked_attempt.status_code == 401
        assert "locked" in locked_attempt.json()["detail"].lower()

    def test_login_rate_limiter_returns_429(self, client):
        ip = "10.0.3.99"
        for _ in range(10):
            res = _login_as(client, "nonexistent@awra.ai", "badpass", ip=ip)
            assert res.status_code == 401

        limited = _login_as(client, "nonexistent@awra.ai", "badpass", ip=ip)
        assert limited.status_code == 429


class TestUserManagementRBAC:
    def test_users_requires_auth(self, client):
        assert client.get("/api/users").status_code == 401

    def test_users_forbidden_for_analyst(self, client):
        res = _login_as(client, TEST_ANALYST_EMAIL, TEST_ANALYST_PASSWORD, ip="10.0.4.1")
        assert res.status_code == 200
        assert client.get("/api/users").status_code == 403

    def test_admin_can_list_create_update_delete_users(self, client):
        res = _login_as(client, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD, ip="10.0.5.1")
        assert res.status_code == 200

        # List
        listed = client.get("/api/users")
        assert listed.status_code == 200
        emails = {u["email"] for u in listed.json()["users"]}
        assert TEST_ADMIN_EMAIL in emails
        assert TEST_ANALYST_EMAIL in emails

        # Create
        created = client.post(
            "/api/users",
            json={
                "email": "new.responder@awra.ai",
                "name": "New Responder",
                "password": "StrongPassword123!",
                "role": "analyst",
            },
        )
        assert created.status_code == 200
        new_id = created.json()["user"]["id"]
        assert created.json()["user"]["role"] == "analyst"

        # Update role
        updated = client.patch(f"/api/users/{new_id}", json={"role": "admin"})
        assert updated.status_code == 200
        assert updated.json()["user"]["role"] == "admin"

        # Delete
        deleted = client.delete(f"/api/users/{new_id}")
        assert deleted.status_code == 200


class TestDashboardEndpoints:
    def _seed_incident(self, inc_id: str = "inc-test-01", severity: Severity = Severity.HIGH):
        now = datetime.now(timezone.utc)
        inc = IncidentState(
            id=inc_id,
            raw_alert="Suspicious SSH login attempt from 198.51.100.44",
            status=IncidentStatus.OPEN,
            created_at=now,
            triage=TriageScore(severity=severity, score=80.0),
            agent_trace=[
                AgentStepLog(
                    agent_name="SupervisorAgent",
                    status=AgentNodeStatus.DONE,
                    started_at=now,
                    completed_at=now,
                    duration_ms=142.0,
                ),
                AgentStepLog(
                    agent_name="TriageAgent",
                    status=AgentNodeStatus.DONE,
                    started_at=now,
                    completed_at=now,
                    duration_ms=58.0,
                ),
            ],
        )
        db.save_incident(inc)
        return inc

    def test_volume_endpoint_returns_real_buckets(self, analyst_client):
        client = analyst_client
        self._seed_incident("inc-vol-1")

        res_24h = client.get("/api/incidents/volume?range=24h")
        assert res_24h.status_code == 200
        body_24h = res_24h.json()
        assert body_24h["range"] == "24h"
        assert len(body_24h["buckets"]) == 24
        assert sum(b["count"] for b in body_24h["buckets"]) == 1

        res_7d = client.get("/api/incidents/volume?range=7d")
        assert res_7d.status_code == 200
        body_7d = res_7d.json()
        assert body_7d["range"] == "7d"
        assert len(body_7d["buckets"]) == 7
        assert sum(b["count"] for b in body_7d["buckets"]) == 1

    def test_patch_incident_status_updates_open_stats(self, analyst_client):
        client = analyst_client
        self._seed_incident("inc-stat-1", severity=Severity.CRITICAL)

        stats_before = client.get("/api/stats").json()
        assert stats_before["open_incidents"] == 1
        assert stats_before["critical_alerts"] == 1

        ack = client.patch("/api/incidents/inc-stat-1/status", json={"status": "acknowledged"})
        assert ack.status_code == 200
        assert ack.json()["incident"]["status"] == "acknowledged"

        esc = client.patch("/api/incidents/inc-stat-1/status", json={"status": "escalated"})
        assert esc.status_code == 200
        assert esc.json()["incident"]["status"] == "escalated"

        closed = client.patch("/api/incidents/inc-stat-1/status", json={"status": "closed"})
        assert closed.status_code == 200
        assert closed.json()["incident"]["status"] == "closed"

        stats_after = client.get("/api/stats").json()
        assert stats_after["open_incidents"] == 0

    def test_agents_health_reads_real_trace_metrics(self, analyst_client):
        client = analyst_client
        self._seed_incident("inc-agent-1")

        res = client.get("/api/agents/health")
        assert res.status_code == 200
        agents = {a["name"]: a for a in res.json()["agents"]}
        assert len(agents) == 6
        assert agents["Supervisor"]["latency_ms"] == 142
        assert agents["Triage"]["latency_ms"] == 58
        assert agents["Ingestion"]["last_run"] == "No runs yet"

    def test_dashboard_endpoints_reject_anonymous_callers(self, client):
        for path in ("/api/stats", "/api/incidents", "/api/incidents/volume?range=24h", "/api/agents/health", "/api/mitre-heatmap"):
            assert client.get(path).status_code == 401, path
