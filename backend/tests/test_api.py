"""
Integration tests for API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from api.main import app


@pytest.fixture
def client(service_headers):
    """Test client authenticated with the test service key."""
    return TestClient(app, headers=service_headers)


@pytest.fixture
def mock_workflow():
    """Mock workflow for testing."""
    with patch('api.main.workflow') as mock:
        # Mock the run method to return sample data
        mock.run = AsyncMock(return_value={
            "id": "test-123",
            "soc_analysis": {
                "decision": "True Positive - Malicious Activity Detected",
                "score": 85,
                "iocs": [],
                "mitre_techniques": []
            },
            "report": "# Investigation Report\n\nMalicious activity detected.",
            "rewrite_iterations": 1
        })
        yield mock


class TestHealthEndpoint:
    """Test health check endpoint."""
    
    def test_health_check(self, client):
        """Test that health endpoint returns 200."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestAnalyzeAlertEndpoint:
    """Test alert analysis endpoint."""
    
    def test_analyze_alert_success(self, client, mock_workflow):
        """Test successful alert analysis."""
        alert_data = {
            "alert": "Port scan detected from 192.168.1.1"
        }
        
        response = client.post("/api/analyze-alert", json=alert_data)
        
        assert response.status_code == 200
        data = response.json()
        assert "structured_json" in data
        assert "report" in data
        assert "iterations" in data
    
    def test_analyze_alert_empty(self, client):
        """Test that empty alerts are rejected."""
        alert_data = {"alert": ""}
        
        response = client.post("/api/analyze-alert", json=alert_data)
        assert response.status_code == 422  # Validation error
    
    def test_analyze_alert_too_long(self, client):
        """Test that overly long alerts are rejected."""
        alert_data = {"alert": "A" * 60000}
        
        response = client.post("/api/analyze-alert", json=alert_data)
        assert response.status_code == 400
    
    def test_analyze_alert_sql_injection(self, client):
        """Test that SQL injection is blocked."""
        alert_data = {"alert": "'; DROP TABLE incidents--"}
        
        response = client.post("/api/analyze-alert", json=alert_data)
        assert response.status_code == 400
        assert "SQL" in response.json()["detail"]


class TestIncidentsEndpoint:
    """Test incidents endpoints."""
    
    @patch('api.main.db.list_incidents')
    def test_list_incidents(self, mock_list, client):
        """Test listing incidents."""
        mock_list.return_value = []
        
        response = client.get("/api/incidents")
        assert response.status_code == 200
        assert "incidents" in response.json()
    
    @patch('api.main.db.get_incident')
    def test_get_incident_found(self, mock_get, client):
        """Test getting a specific incident."""
        from schemas.schemas import IncidentState
        from datetime import datetime
        
        mock_incident = IncidentState(
            id="test-123",
            raw_alert="Test alert",
            created_at=datetime.utcnow()
        )
        mock_get.return_value = mock_incident
        
        response = client.get("/api/incidents/test-123")
        assert response.status_code == 200
        assert response.json()["id"] == "test-123"
    
    @patch('api.main.db.get_incident')
    def test_get_incident_not_found(self, mock_get, client):
        """Test getting a non-existent incident."""
        mock_get.return_value = None
        
        response = client.get("/api/incidents/nonexistent")
        assert response.status_code == 404


class TestStatsEndpoint:
    """Test stats endpoint."""
    
    @patch('api.main.db.list_incidents')
    def test_get_stats(self, mock_list, client):
        """Test getting dashboard stats."""
        mock_list.return_value = []
        
        response = client.get("/api/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_alerts" in data
        assert "open_incidents" in data
        assert "critical_alerts" in data
        assert "avg_triage_seconds" in data


class TestFeedbackEndpoint:
    """Test feedback submission."""
    
    @patch('api.main.db.get_incident')
    @patch('api.main.db.save_incident')
    def test_submit_feedback(self, mock_save, mock_get, client):
        """Test submitting analyst feedback."""
        from schemas.schemas import IncidentState
        from datetime import datetime
        
        mock_incident = IncidentState(
            id="test-123",
            raw_alert="Test alert",
            created_at=datetime.utcnow()
        )
        mock_get.return_value = mock_incident
        
        feedback_data = {
            "override_verdict": "False Positive",
            "notes": "Benign traffic"
        }
        
        response = client.post("/api/feedback/test-123", json=feedback_data)
        assert response.status_code == 200
        assert response.json()["status"] == "success"
        
        # Verify save was called
        mock_save.assert_called_once()
    
    @patch('api.main.db.get_incident')
    def test_submit_feedback_incident_not_found(self, mock_get, client):
        """Test feedback for non-existent incident."""
        mock_get.return_value = None
        
        feedback_data = {"notes": "Test"}
        response = client.post("/api/feedback/nonexistent", json=feedback_data)
        
        assert response.status_code == 404
