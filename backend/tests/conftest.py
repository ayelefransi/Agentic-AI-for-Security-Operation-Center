"""
Shared test fixtures.

Protected endpoints require a session or a service API key, and bootstrap
accounts exist only when their passwords are configured. These fixtures give
every test a known admin/analyst pair and a service key without touching .env.
"""

from datetime import datetime, timezone

import pytest

from middleware.auth import APIKey, api_key_store, login_rate_limiter, user_store

TEST_ADMIN_EMAIL = "admin@awra.ai"
TEST_ADMIN_PASSWORD = "Test-Admin-Pass-123!"
TEST_ANALYST_EMAIL = "analyst@awra.ai"
TEST_ANALYST_PASSWORD = "Test-Analyst-Pass-123!"
TEST_SERVICE_KEY = "test_service_key_do_not_use_in_production"


@pytest.fixture(autouse=True)
def seeded_auth_state(monkeypatch):
    """Reseed users from known test credentials and provision a service key."""
    monkeypatch.setenv("ADMIN_EMAIL", TEST_ADMIN_EMAIL)
    monkeypatch.setenv("ADMIN_PASSWORD", TEST_ADMIN_PASSWORD)
    monkeypatch.setenv("ANALYST_EMAIL", TEST_ANALYST_EMAIL)
    monkeypatch.setenv("ANALYST_PASSWORD", TEST_ANALYST_PASSWORD)

    user_store._users.clear()
    user_store._seed_default_users()
    login_rate_limiter._attempts.clear()

    api_key_store._keys[TEST_SERVICE_KEY] = APIKey(
        key=TEST_SERVICE_KEY,
        name="Test Service Key",
        created_at=datetime.now(timezone.utc),
        permissions=["read", "write"],
    )
    yield
    api_key_store._keys.pop(TEST_SERVICE_KEY, None)


@pytest.fixture
def service_headers():
    """Authorization header for a service-key caller."""
    return {"Authorization": f"Bearer {TEST_SERVICE_KEY}"}
