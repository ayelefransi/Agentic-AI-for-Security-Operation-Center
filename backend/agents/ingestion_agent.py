"""
Ingestion Agent — parses raw alert text into normalized SecurityEvents
and extracts IOCs (IPs, domains, hashes, URLs, emails).
"""

from __future__ import annotations

import re
import json
import logging
from datetime import datetime
from typing import Optional

from agents.base_agent import BaseAgent
from schemas.schemas import (
    IncidentState, SecurityEvent, IOC, IOCType, Severity,
)

logger = logging.getLogger(__name__)

# ── IOC Extraction Patterns ───────────────────────────────────────────────────

# IPv4 address (avoid matching version numbers like 1.2.3)
_IPV4_RE = re.compile(
    r'\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b'
)

# MD5
_MD5_RE = re.compile(r'\b[a-fA-F0-9]{32}\b')

# SHA1
_SHA1_RE = re.compile(r'\b[a-fA-F0-9]{40}\b')

# SHA256
_SHA256_RE = re.compile(r'\b[a-fA-F0-9]{64}\b')

# Domain (simplified — excludes common FPs)
_DOMAIN_RE = re.compile(
    r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|io|info|biz|ru|cn|xyz|top|tk|ml|ga|cf|gq|cc|pw|de|uk|fr|nl|au|ca|br|in|jp|kr|za|edu|gov|mil)\b',
    re.IGNORECASE,
)

# URL
_URL_RE = re.compile(
    r'https?://[^\s<>"\'}\]]+',
    re.IGNORECASE,
)

# Email
_EMAIL_RE = re.compile(
    r'\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b'
)

# Private/internal IPs to optionally flag but still include
_PRIVATE_IP_RE = re.compile(
    r'^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.)'
)

# Severity keyword hints
_SEVERITY_KEYWORDS = {
    Severity.CRITICAL: ['critical', 'ransomware', 'data breach', 'exfiltration', 'c2', 'command and control', 'apt'],
    Severity.HIGH: ['high', 'malware', 'exploit', 'privilege escalation', 'brute force', 'lateral movement'],
    Severity.MEDIUM: ['medium', 'suspicious', 'anomaly', 'unusual', 'phishing', 'scan'],
    Severity.LOW: ['low', 'informational', 'benign', 'false positive'],
}


def _extract_iocs(text: str) -> list[IOC]:
    """Extract all IOCs from text."""
    iocs: list[IOC] = []
    seen: set[str] = set()

    def _add(ioc_type: IOCType, value: str, context: str = ""):
        key = f"{ioc_type}:{value.lower()}"
        if key not in seen:
            seen.add(key)
            iocs.append(IOC(type=ioc_type, value=value, context=context[:200]))

    # URLs first (so we don't double-extract domains from URLs)
    for m in _URL_RE.finditer(text):
        _add(IOCType.URL, m.group().rstrip('.,;:)'), m.group())

    # Emails
    for m in _EMAIL_RE.finditer(text):
        _add(IOCType.EMAIL, m.group())

    # Hashes (longest first to avoid substring collisions)
    for m in _SHA256_RE.finditer(text):
        _add(IOCType.HASH, m.group(), "SHA256")
    for m in _SHA1_RE.finditer(text):
        if f"{IOCType.HASH}:{m.group().lower()}" not in seen:
            _add(IOCType.HASH, m.group(), "SHA1")
    for m in _MD5_RE.finditer(text):
        if f"{IOCType.HASH}:{m.group().lower()}" not in seen:
            _add(IOCType.HASH, m.group(), "MD5")

    # IPs
    for m in _IPV4_RE.finditer(text):
        ip = m.group()
        is_private = bool(_PRIVATE_IP_RE.match(ip))
        _add(IOCType.IP, ip, "internal" if is_private else "external")

    # Domains (skip if already captured as part of a URL or email)
    url_domains = set()
    for ioc in iocs:
        if ioc.type == IOCType.URL:
            try:
                from urllib.parse import urlparse
                url_domains.add(urlparse(ioc.value).hostname)
            except Exception:
                pass
        elif ioc.type == IOCType.EMAIL:
            url_domains.add(ioc.value.split("@")[-1])

    for m in _DOMAIN_RE.finditer(text):
        domain = m.group().lower()
        if domain not in url_domains:
            _add(IOCType.DOMAIN, domain)

    return iocs


def _infer_severity(text: str) -> Optional[Severity]:
    """Infer severity from keyword hints in the raw text."""
    text_lower = text.lower()
    for severity, keywords in _SEVERITY_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return severity
    return None


def _infer_event_type(text: str) -> str:
    """Infer event type from content."""
    text_lower = text.lower()
    type_map = [
        ("brute force", "Brute Force"),
        ("failed login", "Failed Login"),
        ("malware", "Malware Detection"),
        ("ransomware", "Ransomware"),
        ("phishing", "Phishing"),
        ("port scan", "Port Scan"),
        ("data exfil", "Data Exfiltration"),
        ("privilege escalation", "Privilege Escalation"),
        ("lateral movement", "Lateral Movement"),
        ("c2", "C2 Communication"),
        ("command and control", "C2 Communication"),
        ("dns", "Suspicious DNS"),
        ("powershell", "Suspicious Process"),
        ("credential", "Credential Abuse"),
    ]
    for keyword, event_type in type_map:
        if keyword in text_lower:
            return event_type
    return "Security Alert"


def _try_parse_json(text: str) -> Optional[dict]:
    """Try to parse the raw alert as JSON."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


class IngestionAgent(BaseAgent):
    """
    Parses raw alert text → normalized SecurityEvent(s) with extracted IOCs.
    
    Handles:
    - Free-text alerts
    - JSON-formatted alerts
    - Syslog-style lines
    """

    name = "ingestion_agent"

    async def _process(self, state: IncidentState) -> IncidentState:
        raw = state.raw_alert
        if not raw.strip():
            logger.warning("Empty alert received")
            return state

        # Try JSON parse
        json_data = _try_parse_json(raw)

        # Extract IOCs from the raw text
        iocs = _extract_iocs(raw)

        # Build SecurityEvent
        event = SecurityEvent(
            raw_log=raw,
            event_type=_infer_event_type(raw),
            severity_hint=_infer_severity(raw),
            extracted_iocs=iocs,
            source="manual",
        )

        # If JSON, populate structured fields
        if json_data and isinstance(json_data, dict):
            event.src_ip = json_data.get("source_ip") or json_data.get("src_ip")
            event.dst_ip = json_data.get("destination_ip") or json_data.get("dst_ip")
            event.user = json_data.get("user") or json_data.get("username")
            event.file_hash = json_data.get("file_hash") or json_data.get("hash")
            event.url = json_data.get("url")
            event.domain = json_data.get("domain")
            event.hostname = json_data.get("hostname")
            if json_data.get("event_type"):
                event.event_type = json_data["event_type"]
            if json_data.get("timestamp"):
                try:
                    event.timestamp = datetime.fromisoformat(json_data["timestamp"].replace("Z", "+00:00"))
                except (ValueError, AttributeError):
                    pass
            event.metadata = {k: v for k, v in json_data.items() 
                           if k not in {"source_ip", "src_ip", "destination_ip", "dst_ip", 
                                       "user", "username", "file_hash", "hash", "url", 
                                       "domain", "hostname", "event_type", "timestamp"}}
        else:
            # Try to extract IPs from IOCs into structured fields
            ip_iocs = [i for i in iocs if i.type == IOCType.IP]
            if len(ip_iocs) >= 2:
                event.src_ip = ip_iocs[0].value
                event.dst_ip = ip_iocs[1].value
            elif len(ip_iocs) == 1:
                event.src_ip = ip_iocs[0].value

            hash_iocs = [i for i in iocs if i.type == IOCType.HASH]
            if hash_iocs:
                event.file_hash = hash_iocs[0].value

            url_iocs = [i for i in iocs if i.type == IOCType.URL]
            if url_iocs:
                event.url = url_iocs[0].value

            domain_iocs = [i for i in iocs if i.type == IOCType.DOMAIN]
            if domain_iocs:
                event.domain = domain_iocs[0].value

        state.events.append(event)
        logger.info(
            f"Ingested event: type={event.event_type}, "
            f"IOCs={len(iocs)} ({', '.join(f'{i.type.value}:{i.value}' for i in iocs[:5])})"
        )
        return state
