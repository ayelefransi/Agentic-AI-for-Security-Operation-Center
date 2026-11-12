"""
Tests for dynamic SOC PDF report generation and API download endpoints.
"""

import io
from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from api.main import app
from reporting.pdf_generator import generate_incident_pdf
from schemas.schemas import (
    AgentNodeStatus,
    AgentStepLog,
    AnalystFeedback,
    EnrichmentResult,
    IOC,
    IOCEnrichmentSummary,
    IOCType,
    IncidentState,
    IncidentStatus,
    MITREMapping,
    SecurityEvent,
    Severity,
    TriageScore,
    Verdict,
)


def _sample_incident(incident_id: str = "inc-pdf-test-01") -> IncidentState:
    sha256_hash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    now = datetime(2026, 11, 11, 14, 30, 0, tzinfo=timezone.utc)
    long_raw_alert = (
        '{"event":"Powershell Encoded Execution","host":"WKS-FINANCE-042",'
        '"command":"powershell.exe -NoP -NonI -W Hidden -Enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkA",'
        '"extra":"<script>alert(1)</script> & details"}'
        + (" | padding-telemetry-line" * 18)
    )
    return IncidentState(
        id=incident_id,
        created_at=now,
        status=IncidentStatus.ESCALATED,
        raw_alert=long_raw_alert,
        events=[
            SecurityEvent(
                timestamp=now,
                source="EDR Telemetry",
                event_type="Suspicious Process Creation",
                src_ip="10.20.4.55",
                dst_ip="198.51.100.77",
                user="j.doe",
                hostname="WKS-FINANCE-042",
                extracted_iocs=[
                    IOC(type=IOCType.IP, value="198.51.100.77", context="Outbound C2 socket"),
                    IOC(type=IOCType.HASH, value=sha256_hash, context="Dropped payload"),
                    IOC(type=IOCType.DOMAIN, value="cdn-untracked-update.example", context="Secondary lookup"),
                ],
            )
        ],
        enrichments=[
            IOCEnrichmentSummary(
                ioc=IOC(type=IOCType.IP, value="198.51.100.77", context="Outbound C2 socket"),
                final_verdict=Verdict.MALICIOUS,
                final_confidence=0.94,
                tags=["c2", "cobalt-strike"],
                results=[
                    EnrichmentResult(
                        ioc=IOC(type=IOCType.IP, value="198.51.100.77"),
                        source="VirusTotal",
                        verdict=Verdict.MALICIOUS,
                        confidence=0.96,
                        cached=False,
                    ),
                    EnrichmentResult(
                        ioc=IOC(type=IOCType.IP, value="198.51.100.77"),
                        source="AbuseIPDB",
                        verdict=Verdict.SUSPICIOUS,
                        confidence=0.82,
                        cached=True,
                    ),
                ],
            ),
            IOCEnrichmentSummary(
                ioc=IOC(type=IOCType.HASH, value=sha256_hash, context="Dropped payload"),
                final_verdict=Verdict.MALICIOUS,
                final_confidence=0.99,
                tags=["ransomware-loader"],
                results=[],
            ),
        ],
        mitre_mappings=[
            MITREMapping(
                technique_id="T1059.001",
                technique_name="PowerShell",
                tactic="Execution",
                confidence=0.95,
                evidence="Encoded PowerShell execution spawning hidden web client download",
            ),
            MITREMapping(
                technique_id="T1071.001",
                technique_name="Web Protocols",
                tactic="Command and Control",
                confidence=0.89,
                evidence="HTTP beacon traffic to external IP 198.51.100.77",
            ),
        ],
        optimized_query="powershell encoded download cobalt strike c2",
        retrieved_docs=[{"title": "Playbook PB-104", "content": "Endpoint PowerShell C2 Containment"}],
        rewrite_iterations=1,
        is_sufficient=True,
        triage=TriageScore(
            score=91,
            severity=Severity.CRITICAL,
            confidence=0.95,
            breakdown={
                "ioc_reputation": 38.0,
                "mitre_severity": 31.0,
                "asset_criticality": 22.0,
            },
        ),
        decision="True Positive - Malicious C2 Activity",
        decision_reasoning=(
            "Confirmed malicious PowerShell stager connecting to external C2 infrastructure. "
            "Multiple threat feeds corroborate the destination IP and payload hash."
        ),
        recommended_actions=[
            "Isolate host WKS-FINANCE-042 immediately via EDR network quarantine.",
            "Block destination IP 198.51.100.77 and domain cdn-untracked-update.example at perimeter firewall.",
            "Revoke active session tokens and reset credentials for user j.doe.",
        ],
        investigation_plan_summary="Full deep-dive endpoint & C2 investigation pipeline",
        supervisor_plan={"depth": "deep", "agents": ["enrichment", "mitre", "triage", "decision"]},
        supervisor_iteration=2,
        supervisor_decision={
            "action": "conclude",
            "confidence": 0.92,
            "reasoning": "Sufficient evidence gathered across feeds.",
        },
        feedback=AnalystFeedback(
            analyst_id="secops-lead",
            override_verdict="True Positive - Confirmed",
            notes="Verified EDR isolation completed cleanly.",
            timestamp=now,
        ),
        agent_trace=[
            AgentStepLog(
                agent_name="ingestion_agent",
                status=AgentNodeStatus.DONE,
                duration_ms=42.5,
                output_summary="Parsed 1 event and extracted 3 IOCs",
            ),
            AgentStepLog(
                agent_name="enrichment_agent",
                status=AgentNodeStatus.DONE,
                duration_ms=315.2,
                output_summary="Enriched 2 primary IOCs via VirusTotal & AbuseIPDB",
            ),
            AgentStepLog(
                agent_name="mitre_agent",
                status=AgentNodeStatus.DONE,
                duration_ms=180.0,
                output_summary="Mapped T1059.001 and T1071.001",
            ),
        ],
        telemetry_data=[
            {"time": "08:00", "volume": 12, "severity": 40},
            {"time": "10:00", "volume": 28, "severity": 65},
            {"time": "12:00", "volume": 45, "severity": 91},
        ],
        report=(
            "# Security Investigation Report\n\n"
            "🚨 Alert narrative containing emojis and `አውራ AI` branding markers.\n\n"
            "## Executive Findings\n"
            "Host `WKS-FINANCE-042` executed **encoded PowerShell** retrieving payload from `198.51.100.77`.\n\n"
            "| Artifact | Verdict | Risk |\n"
            "|---|---|---|\n"
            "| 198.51.100.77 | Malicious | High |\n\n"
            "```powershell\n"
            "Get-Process powershell | Select-Object Id, Path\n"
            "```\n\n"
            "1. Quarantine host immediately\n"
            "2. Capture volatile memory\n"
        ),
    )


@pytest.fixture
def client(service_headers):
    """Test client authenticated with the test service key."""
    return TestClient(app, headers=service_headers)


def test_generate_incident_pdf_contains_all_sections_and_pages():
    incident = _sample_incident()
    pdf_bytes = generate_incident_pdf(incident)

    assert pdf_bytes.startswith(b"%PDF-")
    reader = PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) >= 3

    cover_text = reader.pages[0].extract_text()
    assert "Security Incident" in cover_text
    assert "inc-pdf-test-01" in cover_text
    assert "CRITICAL" in cover_text
    assert "91 / 100" in cover_text

    full_text = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert f"Page 2 of {len(reader.pages)}" in full_text
    assert "Executive Summary & Triage Assessment" in full_text
    assert "Raw Alert Payload & Normalized Events" in full_text
    assert "Indicators of Compromise (IOCs) & Enrichment" in full_text
    assert "MITRE ATT&CK Framework Mapping" in full_text
    assert "Recommended Countermeasures" in full_text
    assert "Multi-Agent Execution Timeline & Telemetry" in full_text
    assert "Complete Investigation Final Report" in full_text

    # Ensure structured data from every section appears without omission
    compact_text = "".join(full_text.split())
    assert "True Positive - Malicious C2 Activity" in full_text
    assert "198.51.100.77" in full_text
    assert "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" in compact_text
    assert "cdn-untracked-update.example" in compact_text
    assert "T1059.001" in full_text
    assert "T1071.001" in full_text
    assert "Isolate host WKS-FINANCE-042 immediately" in full_text
    assert "enrichment_agent" in full_text
    assert "secops-lead" in full_text
    assert "Playbook PB-104" in full_text
    # Emojis are dropped while the Ethiopic brand name is kept
    assert "AI branding markers" in full_text
    assert "🚨" not in full_text


def test_get_incident_pdf_endpoint_returns_pdf(client):
    incident = _sample_incident("inc-api-200")
    with patch("api.main.db.get_incident", return_value=incident):
        resp = client.get("/api/incidents/inc-api-200/report.pdf")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    assert 'filename="awra-soc-report-inc-api-200.pdf"' in resp.headers.get("content-disposition", "")
    assert resp.content.startswith(b"%PDF-")

    reader = PdfReader(io.BytesIO(resp.content))
    assert len(reader.pages) >= 2


def test_get_incident_pdf_not_found(client):
    with patch("api.main.db.get_incident", return_value=None):
        resp = client.get("/api/incidents/missing-id-999/report.pdf")

    assert resp.status_code == 404


def test_post_adhoc_report_pdf_supports_analyze_response_shape(client):
    payload = {
        "structured_json": {
            "id": "../../evil\r\nname",
            "decision": "Suspicious Activity",
            "score": 68,
            "triage": {"score": 68, "severity": "high", "confidence": 0.81},
            "recommended_actions": ["Block sender domain", "Audit mail rules"],
            "raw_alert": "Subject: Urgent Invoice Update",
        },
        "report": "# Ad-Hoc Analysis Report\n\nSuspicious phishing lure detected.",
        "telemetry_data": [{"time": "10:00", "volume": 5, "severity": 68}],
    }
    with patch("api.main.db.get_incident", return_value=None):
        resp = client.post("/api/reports/pdf", json=payload)

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/pdf")
    disposition = resp.headers.get("content-disposition", "")
    assert "\r" not in disposition and "\n" not in disposition and ".." not in disposition
    assert resp.content.startswith(b"%PDF-")

    reader = PdfReader(io.BytesIO(resp.content))
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    assert "Suspicious Activity" in extracted
    assert "Block sender domain" in extracted


def test_post_adhoc_report_pdf_rejects_empty_payload(client):
    resp = client.post("/api/reports/pdf", json={})
    assert resp.status_code == 400
