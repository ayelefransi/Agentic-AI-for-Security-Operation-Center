# NEXUS Command: Autonomous SOC Agent
<img width="1536" height="1024" alt="SOC Agent" src="https://github.com/user-attachments/assets/941a7a14-3661-4ae2-bcbe-81e2a5289518" />

NEXUS Command is an AI-powered Security Operations Center (SOC) platform. It uses a graph-based multi-agent architecture to ingest raw security telemetry, enrich it with threat intelligence, map behaviors to MITRE ATT&CK, and output analyst-ready triage decisions.

## Architecture Highlights

- **Multi-Agent Pipeline**: Built on LangGraph, the system cascades alerts through specialized agents (Ingestion, Enrichment, MITRE Mapping, Correlation, Triage, and Decision).
- **Free-Tier Resilience**: Integrates with VirusTotal, AbuseIPDB, AlienVault OTX, GreyNoise, and IPinfo.io. Includes a robust token-bucket rate limiter and SQLite caching to ensure the system never exceeds free API limits.
- **Glassmorphism UI**: A custom Next.js frontend built with pure CSS, featuring dynamic telemetry charts, MITRE heatmaps, and real-time incident feeds.

## Project Structure

```
soc-agent/
├── app/                  # Next.js Frontend
│   ├── analyze/          # Alert ingestion interface
│   ├── components/       # Reusable Glassmorphism UI components
│   ├── incidents/        # Incident feed
│   ├── mitre/            # MITRE ATT&CK heatmap
│   └── page.tsx          # Dashboard
├── backend/              # Python Backend
│   ├── agents/           # Specialized LangGraph Agents
│   ├── api/              # FastAPI endpoints
│   ├── config/           # Environment & Settings
│   ├── data/             # Bundled datasets (MITRE, Synthetic Alerts)
│   ├── gateways/         # Threat Intel API Integrations
│   ├── graph/            # LangGraph Workflow Orchestrator
│   └── schemas/          # Pydantic state models
└── README.md
```

## Running the System

1. Add your API keys to `.env` (copy from `.env.example`).
2. Install Python dependencies: `pip install -r requirements.txt`
3. Run the backend: `cd backend && uvicorn api.main:app --reload --port 8000`
4. Install Node dependencies: `npm install`
5. Run the frontend: `npm run dev`

Navigate to `http://localhost:3000` to access the NEXUS Command dashboard.
