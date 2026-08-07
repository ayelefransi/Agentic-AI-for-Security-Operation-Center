"""
VirusTotal API Gateway.

Uses the v3 public API. Free tier is 4 requests per minute, so rate
limiting is strictly enforced.
"""

import logging
import os
import httpx

from config.settings import settings
from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

logger = logging.getLogger(__name__)


class VirusTotalGateway(ThreatIntelGateway):
    """VirusTotal public API wrapper."""

    source_name = "virustotal"
    # Strict free tier limit: 4 per minute (we set to 3 to be safe)
    rate_limit_requests = 3
    rate_limit_window_seconds = 60
    
    supported_types = {IOCType.IP, IOCType.DOMAIN, IOCType.HASH, IOCType.URL}
    
    _base_url = "https://www.virustotal.com/api/v3"

    def __init__(self):
        super().__init__()
        # In a real app we'd inject this, but for simplicity we read from settings
        self.api_key = settings.virustotal_api_key or os.environ.get("VT_API_KEY")

    def _determine_verdict(self, stats: dict) -> tuple[Verdict, float]:
        """Convert VT stats to our Verdict system."""
        malicious = stats.get("malicious", 0)
        suspicious = stats.get("suspicious", 0)
        undetected = stats.get("undetected", 0)
        harmless = stats.get("harmless", 0)
        
        total = malicious + suspicious + undetected + harmless
        if total == 0:
            return Verdict.UNKNOWN, 0.0
            
        if malicious >= 3:
            return Verdict.MALICIOUS, min(malicious / 10.0, 1.0)
        elif malicious > 0 or suspicious >= 2:
            return Verdict.SUSPICIOUS, 0.6
        elif harmless > 10:
            return Verdict.BENIGN, 0.9
            
        return Verdict.UNKNOWN, 0.0

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        if not self.api_key:
            return EnrichmentResult(ioc=ioc, source=self.source_name, error="No VT_API_KEY configured")

        headers = {"x-apikey": self.api_key}
        
        endpoint_map = {
            IOCType.IP: f"/ip_addresses/{ioc.value}",
            IOCType.DOMAIN: f"/domains/{ioc.value}",
            IOCType.HASH: f"/files/{ioc.value}",
            # URLs require base64 encoding without padding for VT v3
            # Implementing URL later if needed, returning error for now to keep it simple
            IOCType.URL: "", 
        }
        
        endpoint = endpoint_map.get(ioc.type)
        if not endpoint:
            return EnrichmentResult(ioc=ioc, source=self.source_name, error="Unsupported or unimplemented VT type")

        url = f"{self._base_url}{endpoint}"
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=10.0)
            
            if resp.status_code == 404:
                return EnrichmentResult(ioc=ioc, source=self.source_name, verdict=Verdict.UNKNOWN)
            
            resp.raise_for_status()
            data = resp.json()
            
        attr = data.get("data", {}).get("attributes", {})
        stats = attr.get("last_analysis_stats", {})
        
        verdict, confidence = self._determine_verdict(stats)
        
        tags = attr.get("tags", [])
        if "reputation" in attr:
            raw_data = {"reputation": attr["reputation"], "stats": stats}
        else:
            raw_data = {"stats": stats}

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=tags[:5]  # Keep top 5 tags
        )
