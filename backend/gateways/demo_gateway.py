"""
Demo Threat Intel Gateway.

Returns synthetic, highly realistic enrichment data when no live API keys
are configured. Ensures the system is always demonstrable.
"""

import asyncio
import hashlib
from typing import Any

from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict


class DemoGateway(ThreatIntelGateway):
    """Provides realistic synthetic data based on deterministic IOC hashing."""

    source_name = "demo_intel"
    rate_limit_requests = 1000
    rate_limit_window_seconds = 1
    supported_types = {IOCType.IP, IOCType.DOMAIN, IOCType.HASH, IOCType.URL}

    def _pseudo_random_score(self, value: str) -> int:
        """Generate a deterministic score 0-100 based on the IOC value."""
        # Simple hash trick to get a stable "random" number
        h = int(hashlib.md5(value.encode()).hexdigest()[:8], 16)
        return h % 101

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        # Simulate slight network latency
        await asyncio.sleep(0.1)

        score = self._pseudo_random_score(ioc.value)
        
        # Hardcode some known values for consistent demos
        known_malicious_ips = {"198.51.100.22", "203.0.113.44", "185.220.101.14"}
        known_benign_ips = {"8.8.8.8", "1.1.1.1", "10.0.0.5", "192.168.1.50"}
        known_malicious_domains = {"evil-c2.net", "phishing-login.com"}
        
        verdict = Verdict.UNKNOWN
        confidence = 0.0
        raw_data: dict[str, Any] = {}
        tags = []

        if ioc.value in known_malicious_ips or ioc.value in known_malicious_domains or score > 85:
            verdict = Verdict.MALICIOUS
            confidence = 0.95 if score > 85 else 1.0
            tags = ["c2", "malware", "botnet"]
            raw_data = {"score": score, "reports": score // 5, "last_seen": "1h ago"}
        elif ioc.value in known_benign_ips or score < 20:
            verdict = Verdict.BENIGN
            confidence = 0.9
            tags = ["whitelist", "google", "cloudflare"]
            raw_data = {"score": score, "category": "cdn", "reports": 0}
        elif score > 60:
            verdict = Verdict.SUSPICIOUS
            confidence = 0.6
            tags = ["tor", "vpn", "anonymizer"]
            raw_data = {"score": score, "reports": 2}
        else:
            verdict = Verdict.UNKNOWN
            confidence = 0.0
            raw_data = {"score": score}

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=tags
        )
