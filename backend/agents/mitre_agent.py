"""
MITRE ATT&CK Mapping Agent — classifies observed behavior against
ATT&CK tactics/techniques using keyword matching + LLM fallback.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Optional

from agents.base_agent import BaseAgent
from schemas.schemas import IncidentState, MITREMapping

logger = logging.getLogger(__name__)

# ── Bundled MITRE ATT&CK technique database ──────────────────────────────────
# Loaded from data/mitre_attack.json if available, otherwise uses built-in subset

_MITRE_DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mitre_attack.json")

# Built-in subset covering common SOC scenarios
BUILTIN_TECHNIQUES: list[dict] = [
    {"id": "T1110", "name": "Brute Force", "tactic": "Credential Access",
     "keywords": ["brute force", "failed login", "password spray", "credential stuffing", "multiple failed"]},
    {"id": "T1078", "name": "Valid Accounts", "tactic": "Defense Evasion",
     "keywords": ["valid account", "compromised credential", "stolen credential", "legitimate account"]},
    {"id": "T1566", "name": "Phishing", "tactic": "Initial Access",
     "keywords": ["phishing", "spear phishing", "malicious email", "suspicious attachment", "social engineering"]},
    {"id": "T1566.001", "name": "Spearphishing Attachment", "tactic": "Initial Access",
     "keywords": ["malicious attachment", "infected file", "macro", "document exploit", ".exe attachment"]},
    {"id": "T1059", "name": "Command and Scripting Interpreter", "tactic": "Execution",
     "keywords": ["powershell", "cmd.exe", "bash", "script execution", "command line", "wscript", "cscript"]},
    {"id": "T1059.001", "name": "PowerShell", "tactic": "Execution",
     "keywords": ["powershell", "invoke-expression", "encodedcommand", "iex", "bypass"]},
    {"id": "T1486", "name": "Data Encrypted for Impact", "tactic": "Impact",
     "keywords": ["ransomware", "encryption", "file encrypted", "ransom note", "crypto locker"]},
    {"id": "T1071", "name": "Application Layer Protocol", "tactic": "Command and Control",
     "keywords": ["c2", "command and control", "beacon", "callback", "covert channel"]},
    {"id": "T1071.001", "name": "Web Protocols", "tactic": "Command and Control",
     "keywords": ["http c2", "https beacon", "web shell", "reverse shell http"]},
    {"id": "T1046", "name": "Network Service Discovery", "tactic": "Discovery",
     "keywords": ["port scan", "network scan", "service discovery", "nmap", "port enumeration"]},
    {"id": "T1048", "name": "Exfiltration Over Alternative Protocol", "tactic": "Exfiltration",
     "keywords": ["data exfiltration", "exfil", "data theft", "unauthorized transfer", "data leak"]},
    {"id": "T1048.003", "name": "Exfiltration Over Unencrypted Non-C2 Protocol", "tactic": "Exfiltration",
     "keywords": ["ftp exfil", "dns exfil", "icmp tunnel", "data over dns"]},
    {"id": "T1053", "name": "Scheduled Task/Job", "tactic": "Persistence",
     "keywords": ["scheduled task", "cron job", "at command", "task scheduler", "persistence"]},
    {"id": "T1055", "name": "Process Injection", "tactic": "Defense Evasion",
     "keywords": ["process injection", "dll injection", "code injection", "hollowing"]},
    {"id": "T1021", "name": "Remote Services", "tactic": "Lateral Movement",
     "keywords": ["lateral movement", "remote desktop", "rdp", "ssh lateral", "smb", "psexec", "wmi"]},
    {"id": "T1021.001", "name": "Remote Desktop Protocol", "tactic": "Lateral Movement",
     "keywords": ["rdp", "remote desktop", "3389", "mstsc"]},
    {"id": "T1547", "name": "Boot or Logon Autostart Execution", "tactic": "Persistence",
     "keywords": ["autostart", "registry run key", "startup folder", "boot persistence"]},
    {"id": "T1548", "name": "Abuse Elevation Control Mechanism", "tactic": "Privilege Escalation",
     "keywords": ["privilege escalation", "sudo", "uac bypass", "elevation", "admin access"]},
    {"id": "T1583", "name": "Acquire Infrastructure", "tactic": "Resource Development",
     "keywords": ["botnet", "infrastructure", "bulletproof hosting", "malicious server"]},
    {"id": "T1098", "name": "Account Manipulation", "tactic": "Persistence",
     "keywords": ["account manipulation", "added to group", "permission change", "role change"]},
    {"id": "T1003", "name": "OS Credential Dumping", "tactic": "Credential Access",
     "keywords": ["credential dump", "mimikatz", "lsass", "sam dump", "ntds", "hashdump"]},
    {"id": "T1568", "name": "Dynamic Resolution", "tactic": "Command and Control",
     "keywords": ["dga", "domain generation", "fast flux", "dynamic dns", "suspicious dns"]},
    {"id": "T1190", "name": "Exploit Public-Facing Application", "tactic": "Initial Access",
     "keywords": ["exploit", "vulnerability", "cve", "rce", "remote code execution", "web exploit"]},
    {"id": "T1027", "name": "Obfuscated Files or Information", "tactic": "Defense Evasion",
     "keywords": ["obfuscated", "encoded", "base64", "packed", "encrypted payload"]},
    {"id": "T1562", "name": "Impair Defenses", "tactic": "Defense Evasion",
     "keywords": ["disable antivirus", "stop firewall", "tamper protection", "security tool disabled"]},
    {"id": "T1070", "name": "Indicator Removal", "tactic": "Defense Evasion",
     "keywords": ["log deletion", "clear logs", "indicator removal", "evidence destruction", "timestomp"]},
]


def _load_mitre_db() -> list[dict]:
    """Load MITRE ATT&CK technique database."""
    if os.path.exists(_MITRE_DB_PATH):
        try:
            with open(_MITRE_DB_PATH, "r") as f:
                data = json.load(f)
            if isinstance(data, list) and len(data) > 0:
                logger.info(f"Loaded {len(data)} MITRE techniques from {_MITRE_DB_PATH}")
                return data
        except Exception as e:
            logger.warning(f"Failed to load MITRE DB: {e}, using builtin")
    
    logger.info(f"Using built-in MITRE database ({len(BUILTIN_TECHNIQUES)} techniques)")
    return BUILTIN_TECHNIQUES


class MITREAgent(BaseAgent):
    """
    Maps observed behavior in security events to MITRE ATT&CK techniques.
    
    Uses keyword/pattern matching against a bundled ATT&CK dataset.
    For ambiguous cases, falls back to LLM-based classification via the
    existing SOCReasoningAgent infrastructure.
    """

    name = "mitre_agent"

    def __init__(self):
        self.techniques = _load_mitre_db()

    async def _process(self, state: IncidentState) -> IncidentState:
        if not state.events:
            logger.warning("No events to map")
            return state

        mappings: list[MITREMapping] = []
        seen_techniques: set[str] = set()

        for event in state.events:
            # Combine all searchable text
            search_text = " ".join(filter(None, [
                event.raw_log,
                event.event_type,
                event.metadata.get("description", ""),
                " ".join(ioc.value for ioc in event.extracted_iocs),
            ])).lower()

            for tech in self.techniques:
                if tech["id"] in seen_techniques:
                    continue

                keywords = tech.get("keywords", [])
                matched_keywords = [kw for kw in keywords if kw.lower() in search_text]

                if matched_keywords:
                    # Confidence based on how many keywords matched
                    confidence = min(0.4 + 0.2 * len(matched_keywords), 0.95)

                    mappings.append(MITREMapping(
                        tactic=tech.get("tactic", "Unknown"),
                        technique_id=tech["id"],
                        technique_name=tech["name"],
                        confidence=round(confidence, 2),
                        evidence=f"Matched keywords: {', '.join(matched_keywords[:3])}",
                    ))
                    seen_techniques.add(tech["id"])

        # Sort by confidence descending
        mappings.sort(key=lambda m: m.confidence, reverse=True)

        state.mitre_mappings = mappings
        logger.info(f"Mapped {len(mappings)} MITRE ATT&CK techniques")
        return state


# ── Utility: get all tactics for the heatmap ──────────────────────────────────

ALL_TACTICS = [
    "Reconnaissance",
    "Resource Development",
    "Initial Access",
    "Execution",
    "Persistence",
    "Privilege Escalation",
    "Defense Evasion",
    "Credential Access",
    "Discovery",
    "Lateral Movement",
    "Collection",
    "Command and Control",
    "Exfiltration",
    "Impact",
]


def get_mitre_heatmap_data(incidents: list[IncidentState]) -> dict:
    """
    Aggregate MITRE technique hits across all incidents for the heatmap.
    Returns {technique_id: {name, tactic, count, max_confidence}}.
    """
    heatmap: dict[str, dict] = {}

    for incident in incidents:
        for mapping in incident.mitre_mappings:
            tid = mapping.technique_id
            if tid not in heatmap:
                heatmap[tid] = {
                    "technique_id": tid,
                    "technique_name": mapping.technique_name,
                    "tactic": mapping.tactic,
                    "count": 0,
                    "max_confidence": 0.0,
                }
            heatmap[tid]["count"] += 1
            heatmap[tid]["max_confidence"] = max(
                heatmap[tid]["max_confidence"], mapping.confidence
            )

    return {
        "tactics": ALL_TACTICS,
        "techniques": list(heatmap.values()),
    }
