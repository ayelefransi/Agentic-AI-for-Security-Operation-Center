"use client";

import { useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  Shield,
  Zap,
  CheckCircle2,
  Clock,
  Terminal,
  Search,
  Database,
  Layers,
  FileText,
  ArrowRight,
  RefreshCw,
  Radio
} from 'lucide-react';
import { fetchIncidents, healthCheck } from '@/app/lib/api';
import styles from './page.module.css';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  phase: string;
  status: 'online' | 'ready' | 'standby';
  description: string;
  icon: any;
  triggers: string;
  parallelWith?: string[];
}

const CORE_AGENTS: AgentInfo[] = [
  {
    id: 'supervisor_agent',
    name: 'Supervisor Agent',
    role: 'Central Orchestration & Dynamic Routing',
    phase: 'Phase 1',
    status: 'online',
    description: 'Creates investigation plans, determines urgency & agent sequence, monitors evidence confidence, and manages bounded investigation loops.',
    icon: Shield,
    triggers: 'Always active on every alert ingestion',
  },
  {
    id: 'ingestion_agent',
    name: 'Ingestion Agent',
    role: 'IOC Extraction & Telemetry Normalization',
    phase: 'Phase 1',
    status: 'online',
    description: 'Extracts IP addresses, domains, file hashes, URLs, and emails. Normalizes heterogeneous log formats into canonical SecurityEvents.',
    icon: Terminal,
    triggers: 'Entry point for all incoming alerts',
  },
  {
    id: 'enrichment_agent',
    name: 'Enrichment Agent',
    role: 'Multi-Gateway Threat Intelligence',
    phase: 'Phase 1',
    status: 'online',
    description: 'Queries VirusTotal, AbuseIPDB, AlienVault OTX, GreyNoise, and IPinfo.io with rate-limiting, SQLite caching, and consensus scoring.',
    icon: Database,
    triggers: 'Activated when IOCs are extracted',
    parallelWith: ['mitre_agent'],
  },
  {
    id: 'mitre_agent',
    name: 'MITRE ATT&CK Agent',
    role: 'Behavioral Tactic & Technique Mapping',
    phase: 'Phase 1',
    status: 'online',
    description: 'Maps observed malicious behaviors, commands, and network traces to the MITRE Enterprise ATT&CK matrix.',
    icon: Layers,
    triggers: 'Activated on indicators & suspicious actions',
    parallelWith: ['enrichment_agent'],
  },
  {
    id: 'correlation_agent',
    name: 'Correlation Agent',
    role: 'Cross-Event IOC Deduplication',
    phase: 'Phase 1',
    status: 'online',
    description: 'Deduplicates identical indicators across multiple events and stitches related network & endpoint telemetry into a unified context.',
    icon: Cpu,
    triggers: 'Multi-event alerts or correlated telemetry',
  },
  {
    id: 'triage_agent',
    name: 'Triage Agent',
    role: 'Weighted Risk Scoring (0–100)',
    phase: 'Phase 1',
    status: 'online',
    description: 'Computes multi-factor risk scores considering indicator reputation, MITRE severity, asset criticality, and frequency.',
    icon: Activity,
    triggers: 'Always runs prior to final verdict',
  },
  {
    id: 'decision_agent',
    name: 'Decision Agent',
    role: 'LLM Reasoning & Verdict Synthesis',
    phase: 'Phase 1',
    status: 'online',
    description: 'Evaluates all collected evidence through deep LLM reasoning to determine classification (True/False Positive) and mitigation steps.',
    icon: Zap,
    triggers: 'Concludes investigation phase',
  },
  {
    id: 'reporter_agent',
    name: 'Reporter Agent',
    role: 'Investigation Report Synthesis',
    phase: 'Phase 1',
    status: 'online',
    description: 'Compiles executive summary, threat intelligence findings, MITRE framework mappings, and audit timelines into comprehensive Markdown.',
    icon: FileText,
    triggers: 'Finalization node after decision',
  },
];

const PLANNED_AGENTS = [
  {
    name: 'Threat Hunting Agent',
    role: 'Historical Incident Correlator',
    status: 'Phase 2 (In Development)',
    description: 'Searches historical incident logs and vector database memory to detect persistent adversary campaigns and recurring patterns.',
  },
  {
    name: 'Digital Forensics Agent',
    role: 'Attack Timeline Reconstruction',
    status: 'Phase 2 (In Development)',
    description: 'Reconstructs high-fidelity attack chains, process trees, and file modification sequences across endpoint artifacts.',
  },
  {
    name: 'Reviewer Agent',
    role: 'Independent Findings Validator',
    status: 'Phase 2 (In Development)',
    description: 'Acts as an adversarial critic to independently stress-test the Decision Agent verdict before human escalation.',
  },
];

export default function AgentMonitorPage() {
  const [modelInfo, setModelInfo] = useState<string>('Groq Llama 3');
  const [agentMetrics, setAgentMetrics] = useState<Record<string, { count: number; avgMs: number }>>({});
  const [loading, setLoading] = useState(true);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const health = await healthCheck();
      if (health.model) setModelInfo(health.model);

      const incidentsData = await fetchIncidents();
      const metrics: Record<string, { count: number; totalMs: number }> = {};

      incidentsData.incidents?.forEach((inc: any) => {
        inc.agent_trace?.forEach((step: any) => {
          if (!metrics[step.agent_name]) {
            metrics[step.agent_name] = { count: 0, totalMs: 0 };
          }
          metrics[step.agent_name].count += 1;
          metrics[step.agent_name].totalMs += step.duration_ms || 0;
        });
      });

      const formatted: Record<string, { count: number; avgMs: number }> = {};
      Object.entries(metrics).forEach(([k, v]) => {
        formatted[k] = {
          count: v.count,
          avgMs: v.count > 0 ? Math.round(v.totalMs / v.count) : 0,
        };
      });
      setAgentMetrics(formatted);
    } catch (err) {
      console.error('Failed to load agent metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Multi-Agent Control Room</h1>
          <p className={styles.subtitle}>
            Supervisor-orchestrated LangGraph state machine with adaptive investigation depth and parallel execution
          </p>
        </div>
        <div className={styles.headerBadges}>
          <div className={styles.modelBadge}>
            <span className={styles.modelDot} />
            <span>LLM: <strong style={{ color: 'var(--text-primary)' }}>{modelInfo}</strong></span>
          </div>
          <div className={styles.versionBadge}>
            Architecture V2.0 Active
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={checkStatus}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Overview Cards Strip */}
      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Core Agents</span>
          <span className={styles.metricValue}>8 / 8</span>
          <span className={styles.metricSubtext}>All specialist nodes operational</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Parallel Execution</span>
          <span className={styles.metricValue} style={{ color: 'var(--accent)' }}>
            Enabled
          </span>
          <span className={styles.metricSubtext}>Enrichment + MITRE run concurrently</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Adaptive Loops</span>
          <span className={styles.metricValue} style={{ color: 'var(--text-primary)' }}>
            1 – 3 Max
          </span>
          <span className={styles.metricSubtext}>Bounded supervisor loop control</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Threat Intel Gateways</span>
          <span className={styles.metricValue} style={{ color: 'var(--severity-high)' }}>
            5 Sources
          </span>
          <span className={styles.metricSubtext}>VT, AbuseIPDB, GreyNoise, OTX, IPinfo</span>
        </div>
      </div>

      {/* Core Agents Grid */}
      <div>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Active Specialist Agents (Phase 1)</h2>
        </div>
        <div className={styles.agentGrid}>
          {CORE_AGENTS.map((agent) => {
            const Icon = agent.icon;
            const metrics = agentMetrics[agent.id] || agentMetrics[agent.name.toLowerCase().replace(' agent', '_agent')];
            return (
              <div key={agent.id} className={styles.agentCard}>
                <div className={styles.agentCardHeader}>
                  <div className={styles.agentIconTitle}>
                    <div className={styles.agentIconBox}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <h3 className={styles.agentName}>{agent.name}</h3>
                      <div className={styles.agentRole}>{agent.role}</div>
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>
                    {agent.status}
                  </span>
                </div>

                <p className={styles.agentDescription}>
                  {agent.description}
                </p>

                <div className={styles.agentFooter}>
                  <span className={styles.agentTrigger}>
                    Trigger: <strong style={{ color: 'var(--text-secondary)' }}>{agent.triggers}</strong>
                  </span>
                  {metrics && (
                    <span className={styles.agentMetrics}>
                      avg {metrics.avgMs}ms ({metrics.count} runs)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Planned Phase 2 Agents */}
      <div className={styles.roadmapCard}>
        <h2 className={styles.sectionTitle}>Roadmap Specialists (Phase 2 Architecture)</h2>
        <div className={styles.plannedGrid}>
          {PLANNED_AGENTS.map((agent, i) => (
            <div key={i} className={styles.plannedCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{agent.name}</span>
                <span className="badge badge-info" style={{ fontSize: '10px' }}>
                  {agent.status}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{agent.role}</div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {agent.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
