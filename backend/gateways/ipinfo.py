"""
IPinfo.io Gateway.

Provides GeoIP and ASN data. Unauthenticated limits are 50,000/month.
"""

import logging
import httpx

from gateways.base_gateway import ThreatIntelGateway
from schemas.schemas import EnrichmentResult, IOC, IOCType, Verdict

logger = logging.getLogger(__name__)


class IPInfoGateway(ThreatIntelGateway):
    """IPInfo.io unauthenticated API wrapper."""

    source_name = "ipinfo"
    rate_limit_requests = 30
    rate_limit_window_seconds = 60
    
    supported_types = {IOCType.IP}
    
    _base_url = "https://ipinfo.io"

    async def _fetch(self, ioc: IOC) -> EnrichmentResult:
        url = f"{self._base_url}/{ioc.value}/json"
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            
            if resp.status_code == 404:
                return EnrichmentResult(ioc=ioc, source=self.source_name, verdict=Verdict.UNKNOWN)
            if resp.status_code == 429:
                return EnrichmentResult(ioc=ioc, source=self.source_name, error="Rate limited by API")
                
            resp.raise_for_status()
            data = resp.json()
            
        # IPInfo provides context, not verdicts
        verdict = Verdict.UNKNOWN
        confidence = 0.0
        
        org = data.get("org", "")
        country = data.get("country", "")
        
        tags = []
        if country: tags.append(country)
        
        raw_data = {
            "city": data.get("city"),
            "region": data.get("region"),
            "country": country,
            "org": org,
            "asn": org.split(" ")[0] if org and org.startswith("AS") else None
        }

        return EnrichmentResult(
            ioc=ioc,
            source=self.source_name,
            verdict=verdict,
            confidence=confidence,
            raw_data=raw_data,
            tags=tags
        )
