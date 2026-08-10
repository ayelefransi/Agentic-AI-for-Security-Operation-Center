# NEXUS Command: Autonomous SOC Agent
<img width="1536" height="1024" alt="SOC Agent" src="https://github.com/user-attachments/assets/941a7a14-3661-4ae2-bcbe-81e2a5289518" />

NEXUS Command is an AI-powered Security Operations Center (SOC) platform. It uses a graph-based multi-agent architecture to ingest raw security telemetry, enrich it with threat intelligence, map behaviors to MITRE ATT&CK, and output analyst-ready triage decisions.

## System Architecture

NEXUS Command operates on a decoupled client-server architecture with a Next.js frontend and a FastAPI/LangGraph Python backend. 

### High-Level Architecture Diagram

<Img src="./SOC Agent.png"></Img>

### Components

#### 1. Frontend (Next.js & React)
- **Framework**: Next.js App Router for optimized client-side rendering and routing.
- **Design System**: A custom CSS-module based "Glassmorphism" design system utilizing dynamic CSS variables for fluid transitions, skeleton loaders, and a centralized `ThemeProvider` for Light/Dark mode toggling.
- **Key Modules**:
  - `LayoutShell`: Manages the global layout, floating sidebar, and top navigation bar.
  - `CommandPalette`: Global `⌘K` search overlay for rapid navigation.
  - `Analyze Page`: Real-time interactive UI featuring a Monaco Editor for raw alert JSON drop-in, synchronized with an AI "thinking" animation pipeline and a dynamic scoring ring.

#### 2. Backend Orchestration (FastAPI & LangGraph)
- **API Layer (FastAPI)**: Serves RESTful endpoints (`/api/stats`, `/api/incidents`, `/api/analyze-alert`) providing asynchronous, non-blocking communication with the frontend.
- **Persistence (SQLite)**: A local SQLite database tracks historical incidents, agent verdicts, and extracted IOCs.
- **LangGraph Multi-Agent Pipeline**: The core reasoning engine. A sequential state machine where specific AI agents perform distinct tasks:
  1. **Ingestion**: Normalizes unstructured alerts and extracts IOCs (IPs, hashes, domains).
  2. **Enrichment**: Queries external threat intelligence APIs. Includes a robust token-bucket rate limiter and SQLite caching layer to aggressively avoid hitting free-tier API limits.
  3. **MITRE Mapping**: Maps identified adversary behaviors to the MITRE ATT&CK framework (Tactics & Techniques).
  4. **Triage & Decision**: Synthesizes all gathered intelligence into a final analyst-ready report, issuing a definitive verdict and severity score.

#### 3. External Integrations
- **Threat Intel**: Integrates with VirusTotal, AbuseIPDB, AlienVault OTX, GreyNoise, and IPinfo.io.
- **LLM Providers**: Pluggable architecture supporting OpenAI (GPT-4) and Groq (Llama 3) for the reasoning tasks inside the LangGraph nodes.

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
