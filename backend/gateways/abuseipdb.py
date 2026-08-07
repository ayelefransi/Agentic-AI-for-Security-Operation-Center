"""
AbuseIPDB Gateway.

Focuses solely on IP addresses. Free tier allows 1,000 lookups per day.
"""

import logging
import os
import httpx

from config.settings import settings
from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

logger = logging.getLogger(__name__)


class AbuseIPDBGateway(ThreatIntelGateway):
    """AbuseIPDB API wrapper."""

    source_name = "abuseipdb"
    # Free tier: 1000/day. We'll set a generous local rate limit
    rate_limit_requests = 10 
    rate_limit_window_seconds = 60
    
    supported_types = {IOCType.IP}
    
    _url = "https://api.abuseipdb.com/api/v2/check"

    def __init__(self):
        super().__init__()
        self.api_key = settings.abuseipdb_api_key or os.environ.get("ABUSEIPDB_API_KEY")

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        if not self.api_key:
            return EnrichmentResult(ioc=ioc, source=self.source_name, error="No ABUSEIPDB_API_KEY configured")

        headers = {
            "Key": self.api_key,
            "Accept": "application/json"
        }
        params = {
            "ipAddress": ioc.value,
            "maxAgeInDays": "30"
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(self._url, headers=headers, params=params, timeout=10.0)
            if resp.status_code == 429:
                return EnrichmentResult(ioc=ioc, source=self.source_name, error="Rate limited by API")
            if resp.status_code == 401:
                 return EnrichmentResult(ioc=ioc, source=self.source_name, error="Invalid API key")
            resp.raise_for_status()
            data = resp.json()
            
        attr = data.get("data", {})
        score = attr.get("abuseConfidenceScore", 0)
        total_reports = attr.get("totalReports", 0)
        
        # Determine verdict
        if score >= 80:
            verdict = Verdict.MALICIOUS
            confidence = score / 100.0
        elif score >= 20 or total_reports > 0:
            verdict = Verdict.SUSPICIOUS
            confidence = max(0.5, score / 100.0)
        else:
            verdict = Verdict.BENIGN
            confidence = 0.8
            
        tags = []
        if attr.get("isTor"): tags.append("tor")
        if attr.get("isPublicProxy"): tags.append("proxy")
        
        raw_data = {
            "abuseConfidenceScore": score,
            "totalReports": total_reports,
            "countryCode": attr.get("countryCode"),
            "domain": attr.get("domain")
        }

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=tags
        )
