from schemas.alert_schema import SOCAgentOutput

class ReporterAgent:
    def generate_report(self, alert: str, analysis: SOCAgentOutput) -> str:
        
        evidence_str = ""
        if analysis.evidence:
            for i, ev in enumerate(analysis.evidence):
                evidence_str += f"- **[Source {ev.source_id}]** {ev.excerpt}\n"
        else:
            evidence_str = "- No contextual logs or policies retrieved.\n"

        report = f"""### 🚨 General Alert Summary
{alert}

### 📊 Triage Analytics
- **Classification Verdict:** `{analysis.classification}`
- **System Confidence:** `{analysis.confidence_score * 100:.1f}%`

### 🧠 Root Cause Reasoning
{analysis.reasoning}

### 🔬 Correlated Evidence & Telemetry
{evidence_str}
### ⚡ Requested Countermeasures
- {analysis.recommended_action}
"""
        return report
