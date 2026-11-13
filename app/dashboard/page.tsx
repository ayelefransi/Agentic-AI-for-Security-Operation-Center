"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle, ArrowRight, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import {
  fetchStats,
  fetchIncidents,
  fetchAgentHealth,
  fetchIncidentVolume,
  fetchCurrentUser,
  updateIncidentStatus,
  type Stats,
  type Incident,
  type AgentHealth,
  type VolumeBucket,
} from '@/app/lib/api';
import {
  resolveShiftStart,
  computeShiftMetrics,
  attentionQueue,
  severityOf,
  formatSeconds,
  formatWindow,
  greeting,
} from '@/app/lib/shiftMetrics';
import { useSearch } from '@/app/components/AppShell';
import GlassPanel from '@/app/components/GlassPanel';
import Drawer from '@/app/components/Drawer';
import StatusDot from '@/app/components/StatusDot';
import { RevealGroup, Reveal, CountUp, useFlashOnChange, useNewKeys } from '@/app/components/motion';
import styles from './page.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────

const QUEUE_LIMIT = 8;
const SEVERITY_TABS = ['all', 'critical', 'high', 'medium', 'low'] as const;
type SeverityTab = (typeof SEVERITY_TABS)[number];

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function updatedAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 30) return 'just now';
  const mins = Math.floor(secs / 60);
  return mins < 1 ? `${secs}s ago` : `${mins} min ago`;
}

function severityClass(sev: string | undefined): string {
  switch (sev?.toLowerCase()) {
    case 'critical': return styles.sevCritical;
    case 'high': return styles.sevHigh;
    case 'medium': return styles.sevMedium;
    default: return styles.sevLow;
  }
}

function severityLabel(sev: string | undefined): string {
  if (!sev) return 'Low';
  return sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
}

/** Never render a raw API error payload or stack trace as an AI verdict. */
function safeVerdict(text: string | undefined): string {
  if (!text) return 'Unavailable';
  const trimmed = text.trim();
  if (
    /^[\[{]/.test(trimmed) ||
    /(traceback|exception|error:\s|http\s+\d{3}|<!doctype|rate limit|groq)/i.test(trimmed)
  ) {
    return 'Verdict unavailable — manual review required';
  }
  return trimmed;
}

/** A short human title for an incident, taken from the alert itself. */
function incidentHeadline(inc: Incident): string {
  const raw = (inc.raw_alert || '').trim();
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const field = ['event', 'title', 'name', 'description', 'alert'].find((k) => typeof parsed[k] === 'string');
      if (field) return String(parsed[field]).slice(0, 90);
    } catch {
      // Not JSON after all; fall through to the line-based title.
    }
  }
  const firstLine = raw.split('\n').find((l) => l.trim())?.trim() || '';
  const title = firstLine.replace(/^(event|alert|title)\s*:\s*/i, '');
  if (title && !title.startsWith('{')) return title.slice(0, 90);
  return inc.events?.[0]?.event_type?.replace(/_/g, ' ') || safeVerdict(inc.decision);
}

/** "AI · <verdict>, <first clause of the reasoning>" for the queue subline. */
function aiSummary(inc: Incident): string {
  const verdict = safeVerdict(inc.decision);
  const reason = (inc.decision_reasoning || '').split(/(?<=[.!?])\s/)[0]?.trim();
  if (!reason || /^[\[{]/.test(reason)) return verdict;
  const clipped = reason.length > 110 ? `${reason.slice(0, 107)}…` : reason;
  return `${verdict} · ${clipped}`;
}

function buildFallbackVolume(incidents: Incident[], range: '24h' | '7d'): VolumeBucket[] {
  const count = range === '24h' ? 24 : 7;
  const interval = range === '24h' ? 3600000 : 86400000;
  const now = Date.now();
  const buckets: VolumeBucket[] = Array.from({ length: count }, (_, idx) => ({
    label: range === '24h' ? `${count - 1 - idx}h` : `${count - 1 - idx}d`,
    count: 0,
  }));
  incidents.forEach((inc) => {
    const diffIdx = Math.floor((now - new Date(inc.created_at).getTime()) / interval);
    if (diffIdx >= 0 && diffIdx < count) buckets[count - 1 - diffIdx].count += 1;
  });
  return buckets;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

// ── Pieces ────────────────────────────────────────────────────────────────

interface TileProps {
  label: string;
  loading: boolean;
  hero?: boolean;
  value: number | null;
  decimals?: number;
  suffix?: string;
  display?: string;
  sub: React.ReactNode;
}

function Tile({ label, loading, hero, value, decimals = 0, suffix = '', display, sub }: TileProps) {
  const flash = useFlashOnChange(display ?? value);
  return (
    <div className={`${styles.tile} ${hero ? styles.tileHero : ''} card-lift`}>
      <div className={styles.tileLabel}>{label}</div>
      {loading ? (
        <div className={`${styles.tileValueSkeleton} skeleton`} />
      ) : (
        <div className={`${styles.tileValue} ${flash}`}>
          {display ?? (value === null ? '—' : <CountUp value={value} decimals={decimals} suffix={suffix} />)}
        </div>
      )}
      <div className={styles.tileSub}>{loading ? ' ' : sub}</div>
    </div>
  );
}

function NewThisShift({ count }: { count: number }) {
  if (count === 0) return <span className={styles.subMuted}>No new this shift</span>;
  return (
    <span className={styles.deltaUp}>
      <ArrowUpRight size={12} aria-hidden /> {count} new this shift
    </span>
  );
}

function VolumeChart({ buckets, range }: { buckets: VolumeBucket[]; range: '24h' | '7d' }) {
  const W = 600;
  const H = 150;
  const PAD = 10;
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const step = buckets.length > 1 ? W / (buckets.length - 1) : W;
  const points = buckets.map((b, i) => ({
    x: i * step,
    y: H - PAD - (b.count / max) * (H - PAD * 3),
    b,
  }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const peak = points.reduce((a, p) => (p.b.count > a.b.count ? p : a), points[0]);
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className={styles.chartWrap} onMouseLeave={() => setHover(null)}>
      <svg
        className={styles.chartSvg}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Incident volume over the last ${range}; peak ${peak?.b.count ?? 0}`}
      >
        <defs>
          <linearGradient id="volFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.42" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className={styles.gridLine} />
        ))}
        <path key={`a-${range}`} d={area} fill="url(#volFill)" className={styles.chartArea} />
        <path key={`l-${range}`} d={line} className={styles.chartLine} pathLength={1} vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={points[hover].x} x2={points[hover].x} y1={0} y2={H} className={styles.hoverLine} />
        )}
        {/* Invisible hit areas for hover */}
        {points.map((p, i) => (
          <rect
            key={i}
            x={p.x - step / 2}
            y={0}
            width={step}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {peak && peak.b.count > 0 && (
        <span
          className={styles.peakDot}
          style={{ left: `${(peak.x / W) * 100}%`, top: `${(peak.y / H) * 100}%` }}
          aria-hidden
        />
      )}
      {hover !== null && (
        <div className={styles.chartTip} style={{ left: `${(points[hover].x / W) * 100}%` }}>
          <b>{points[hover].b.count}</b> incident{points[hover].b.count === 1 ? '' : 's'}
          <span>{points[hover].b.label === '0h' || points[hover].b.label === '0d' ? 'now' : `${points[hover].b.label} ago`}</span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch();

  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [agents, setAgents] = useState<AgentHealth[]>([]);
  const [volumeBuckets, setVolumeBuckets] = useState<VolumeBucket[]>([]);
  const [userName, setUserName] = useState('');
  const [windowStart, setWindowStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatedText, setUpdatedText] = useState('Loading…');
  const [liveTick, setLiveTick] = useState(0);
  const [chartRange, setChartRange] = useState<'24h' | '7d'>('24h');
  const [sevFilter, setSevFilter] = useState<SeverityTab>('all');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [cursor, setCursor] = useState(0);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoadRef = useRef(0);
  const rowRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      lastLoadRef.current = Date.now();
      try {
        const [statsRes, incidentsRes, agentsRes, volumeRes] = await Promise.all([
          fetchStats(),
          fetchIncidents(),
          fetchAgentHealth(),
          fetchIncidentVolume(chartRange).catch(() => null),
        ]);
        const list = incidentsRes.incidents || [];
        setStats(statsRes);
        setIncidents(list);
        setAgents(agentsRes.agents || []);
        setVolumeBuckets(volumeRes?.buckets ?? buildFallbackVolume(list, chartRange));
        setWindowStart(resolveShiftStart());
        setLastUpdated(new Date());
        setLiveTick((n) => n + 1);
        setError('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unable to load SOC telemetry');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [chartRange]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setUserName(u.name?.trim() || ''))
      .catch(() => setUserName(''));
  }, []);

  // Auto-refresh every 30s, paused while the tab is hidden
  useEffect(() => {
    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => loadData(), 30000);
    };
    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      // Rapid tab switching must not hammer the API (and trip its rate limit):
      // only refetch on return when the data is actually stale.
      if (Date.now() - lastLoadRef.current > 10_000) loadData();
      start();
    };
    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => setUpdatedText(`Updated ${updatedAgo(lastUpdated)}`);
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const handleRangeChange = async (range: '24h' | '7d') => {
    setChartRange(range);
    try {
      const res = await fetchIncidentVolume(range);
      setVolumeBuckets(res.buckets || []);
    } catch {
      setVolumeBuckets(buildFallbackVolume(incidents, range));
    }
  };

  // ── Derived data ──
  const metrics = useMemo(
    () => (windowStart === null ? null : computeShiftMetrics(incidents, windowStart)),
    [incidents, windowStart]
  );
  const queueAll = useMemo(() => attentionQueue(incidents), [incidents]);

  const sevCounts = useMemo(() => {
    const counts: Record<SeverityTab, number> = { all: queueAll.length, critical: 0, high: 0, medium: 0, low: 0 };
    queueAll.forEach((i) => {
      const s = severityOf(i) as SeverityTab;
      if (s in counts) counts[s] += 1;
    });
    return counts;
  }, [queueAll]);

  const queue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return queueAll
      .filter((i) => sevFilter === 'all' || severityOf(i) === sevFilter)
      .filter((i) => {
        if (!q) return true;
        const source = i.events?.[0]?.src_ip || i.events?.[0]?.hostname || '';
        return `${i.id} ${i.decision || ''} ${i.raw_alert || ''} ${source}`.toLowerCase().includes(q);
      })
      .slice(0, QUEUE_LIMIT);
  }, [queueAll, sevFilter, searchQuery]);

  const newRows = useNewKeys(queue.map((i) => i.id));

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => Number(a.status === 'online') - Number(b.status === 'online')).slice(0, 6),
    [agents]
  );
  const healthyAgents = agents.filter((a) => a.status === 'online').length;

  // Keep the keyboard cursor inside the visible rows
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(queue.length - 1, 0)));
  }, [queue.length]);

  const openIncident = useCallback((inc: Incident) => {
    setActionError('');
    setSelectedIncident(inc);
  }, []);

  // J / K to move through the queue, Enter to open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selectedIncident || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!queue.length) return;
      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        e.preventDefault();
        setCursor((c) => {
          const next = key === 'j' ? Math.min(c + 1, queue.length - 1) : Math.max(c - 1, 0);
          rowRefs.current[next]?.focus();
          return next;
        });
      } else if (key === 'enter' && document.activeElement === document.body) {
        openIncident(queue[cursor]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, cursor, selectedIncident, openIncident]);

  const handleAction = async (status: string) => {
    if (!selectedIncident) return;
    setActionLoading(status);
    setActionError('');
    try {
      await updateIncidentStatus(selectedIncident.id, status);
      await loadData();
      setSelectedIncident(null);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Unable to update incident status');
    } finally {
      setActionLoading('');
    }
  };

  if (error && !stats) {
    return (
      <div className={styles.page}>
        <GlassPanel className={styles.errorState}>
          <AlertCircle size={24} className={styles.errorIcon} />
          <div className={styles.errorText}>{error}</div>
          <button type="button" className={styles.retryBtn} onClick={() => loadData(true)}>
            Retry
          </button>
        </GlassPanel>
      </div>
    );
  }

  // ── Tile values ──
  const triageValue = metrics?.triageWindow ?? stats?.avg_triage_seconds ?? null;
  const triageIsAllTime = metrics?.triageWindow == null;
  const triageDelta =
    metrics?.triageWindow != null && metrics.triagePrevious != null
      ? metrics.triageWindow - metrics.triagePrevious
      : null;
  const autoPct = metrics && metrics.createdInWindow > 0
    ? Math.round((metrics.autoClosed / metrics.createdInWindow) * 100)
    : 0;

  return (
    <div className={styles.page}>
      <RevealGroup className={styles.stack}>
        {/* Greeting */}
        <Reveal className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {greeting()}
              {userName ? `, ${userName}` : ''}
            </h1>
            <p className={styles.subtitle}>
              {windowStart
                ? `Since your last shift · ${formatWindow(windowStart)}`
                : 'Since your last shift'}
            </p>
          </div>
          <div className={styles.liveRow}>
            <span key={liveTick} className={styles.liveDot} aria-hidden />
            <span className={styles.liveText}>Live · {updatedText}</span>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={() => loadData(true)}
              aria-label="Refresh dashboard data"
              title="Refresh now"
              disabled={refreshing}
            >
              <RefreshCw size={14} className={refreshing ? styles.spinning : ''} />
            </button>
          </div>
        </Reveal>

        {/* Headline numbers */}
        <Reveal className={styles.tiles}>
          <Tile
            hero
            loading={loading}
            label="Open incidents"
            value={metrics?.openCount ?? null}
            sub={<NewThisShift count={metrics?.openNew ?? 0} />}
          />
          <Tile
            loading={loading}
            label="Critical / high"
            value={metrics?.critHighOpen ?? null}
            sub={<NewThisShift count={metrics?.critHighNew ?? 0} />}
          />
          <Tile
            loading={loading}
            label="Avg triage time"
            value={triageValue === null ? null : triageValue > 120 ? triageValue / 60 : triageValue}
            decimals={1}
            suffix={triageValue !== null && triageValue > 120 ? 'm' : 's'}
            sub={
              triageIsAllTime ? (
                <span className={styles.subMuted}>All time · no triage this shift</span>
              ) : triageDelta === null || Math.abs(triageDelta) < 0.05 ? (
                <span className={styles.subMuted}>This shift</span>
              ) : triageDelta < 0 ? (
                <span className={styles.deltaDown}>
                  <ArrowDownRight size={12} aria-hidden /> {formatSeconds(Math.abs(triageDelta))} faster
                </span>
              ) : (
                <span className={styles.deltaUp}>
                  <ArrowUpRight size={12} aria-hidden /> {formatSeconds(triageDelta)} slower
                </span>
              )
            }
          />
          <Tile
            loading={loading}
            label="AI auto-closed"
            value={metrics?.createdInWindow ? metrics.autoClosed : null}
            display={metrics && metrics.createdInWindow === 0 ? '0' : undefined}
            sub={
              metrics && metrics.createdInWindow > 0 ? (
                <span className={styles.subMuted}>
                  of {metrics.createdInWindow} new · {autoPct}%
                </span>
              ) : (
                <span className={styles.subMuted}>No new alerts this shift</span>
              )
            }
          />
        </Reveal>

        {/* Volume + agents */}
        <Reveal className={styles.middleRow}>
          <GlassPanel className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Incident volume</h2>
              <div className={styles.toggleGroup} role="group" aria-label="Chart range">
                {(['24h', '7d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={chartRange === r}
                    className={`${styles.toggleBtn} ${chartRange === r ? styles.toggleActive : ''}`}
                    onClick={() => handleRangeChange(r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className={`${styles.chartSkeleton} skeleton`} />
            ) : volumeBuckets.every((b) => b.count === 0) ? (
              <div className={styles.chartEmpty}>
                <p>No incidents recorded in the last {chartRange}.</p>
                <button type="button" className={styles.secondaryActionBtn} onClick={() => router.push('/analyze')}>
                  Investigate an alert
                </button>
              </div>
            ) : (
              <>
                <VolumeChart buckets={volumeBuckets} range={chartRange} />
                <div className={styles.chartLabels}>
                  <span>{chartRange === '24h' ? '24h ago' : '7 days ago'}</span>
                  <span>Now</span>
                </div>
              </>
            )}
          </GlassPanel>

          <GlassPanel className={styles.agentPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Agents</h2>
              {!loading && agents.length > 0 && (
                <span className={healthyAgents === agents.length ? styles.agentsOk : styles.agentsWarn}>
                  {healthyAgents} / {agents.length} healthy
                </span>
              )}
            </div>
            <div className={styles.agentList}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${styles.skeletonRow} skeleton`} />)
              ) : sortedAgents.length === 0 ? (
                <div className={styles.agentEmpty}>No agent telemetry available.</div>
              ) : (
                sortedAgents.map((agent) => {
                  const isExpanded = expandedAgent === agent.name;
                  return (
                    <div key={agent.name}>
                      <button
                        type="button"
                        className={styles.agentRow}
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedAgent(isExpanded ? null : agent.name)}
                      >
                        <StatusDot
                          status={agent.status === 'online' ? 'online' : agent.status === 'warning' ? 'warning' : 'offline'}
                          label={agent.status}
                        />
                        <span className={styles.agentName}>{agent.name}</span>
                        <span className={styles.agentLatency}>
                          {agent.latency_ms >= 1000 ? `${(agent.latency_ms / 1000).toFixed(1)}s` : `${agent.latency_ms}ms`}
                        </span>
                      </button>
                      {isExpanded && <div className={styles.agentExpanded}>Last run: {agent.last_run}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </GlassPanel>
        </Reveal>

        {/* Needs attention */}
        <Reveal>
          <GlassPanel className={styles.queuePanel}>
            <div className={styles.queueHeader}>
              <div className={styles.queueTitleRow}>
                <h2 className={styles.panelTitle}>Needs attention</h2>
                <span className={styles.queueCount}>{queueAll.length} open</span>
                <span className={styles.kbdHint} aria-hidden>
                  <kbd>J</kbd>
                  <kbd>K</kbd> to move · <kbd>Enter</kbd> to open
                </span>
              </div>
              <div className={styles.severityTabs} role="tablist" aria-label="Filter by severity">
                {SEVERITY_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={sevFilter === tab}
                    className={`${styles.sevTab} ${sevFilter === tab ? styles.sevTabActive : ''}`}
                    onClick={() => {
                      setSevFilter(tab);
                      setCursor(0);
                    }}
                  >
                    {tab === 'all' ? 'All' : severityLabel(tab)} <span className={styles.tabCount}>{sevCounts[tab]}</span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className={styles.queueList}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`${styles.queueSkeleton} skeleton`} />
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div className={styles.queueEmpty}>
                {searchQuery.trim() || sevFilter !== 'all' ? (
                  <>
                    <p>
                      {searchQuery.trim()
                        ? `No open incidents match "${searchQuery.trim()}".`
                        : `No open ${sevFilter} incidents.`}
                    </p>
                    <button
                      type="button"
                      className={styles.secondaryActionBtn}
                      onClick={() => {
                        setSearchQuery('');
                        setSevFilter('all');
                      }}
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={28} className={styles.queueEmptyIcon} aria-hidden />
                    <p className={styles.queueEmptyTitle}>Queue is clear</p>
                    <p>Every incident has been handled. New alerts will appear here.</p>
                  </>
                )}
              </div>
            ) : (
              <div className={styles.queueList} role="list">
                {queue.map((inc, idx) => {
                  const sev = severityOf(inc);
                  const fresh = newRows.has(inc.id);
                  const enterClass = fresh
                    ? sev === 'critical'
                      ? 'row-new-critical'
                      : sev === 'high'
                        ? 'row-new-high'
                        : 'row-new'
                    : '';
                  return (
                    <button
                      key={inc.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      type="button"
                      role="listitem"
                      className={`${styles.queueRow} ${idx === cursor ? styles.queueRowCursor : ''} ${enterClass}`}
                      onClick={() => {
                        setCursor(idx);
                        openIncident(inc);
                      }}
                      onFocus={() => setCursor(idx)}
                    >
                      <span className={`${styles.sevBar} ${styles[`bar_${sev}`] || styles.bar_low}`} aria-hidden />
                      <span className={styles.queueText}>
                        <span className={styles.queueTitle}>{incidentHeadline(inc)}</span>
                        <span className={styles.queueAi}>AI · {aiSummary(inc)}</span>
                      </span>
                      <span className={`${styles.sevBadge} ${severityClass(sev)}`}>{severityLabel(sev)}</span>
                      <span className={styles.queueAge} title={new Date(inc.created_at).toLocaleString()}>
                        {timeAgo(inc.created_at)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={styles.queueFooter}>
              <Link href="/incidents" className={styles.viewAll}>
                View all incidents <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </GlassPanel>
        </Reveal>
      </RevealGroup>

      {/* Slide-over triage drawer */}
      <Drawer
        open={Boolean(selectedIncident)}
        title="Incident details"
        onClose={() => setSelectedIncident(null)}
        footer={
          selectedIncident ? (
            <div className={styles.drawerFooterWrap}>
              {actionError && <div className={styles.actionError}>{actionError}</div>}
              <div className={styles.drawerActions}>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => handleAction('acknowledged')}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === 'acknowledged' ? 'Saving…' : 'Acknowledge'}
                </button>
                <button
                  type="button"
                  className={styles.actionBtnPrimary}
                  onClick={() => handleAction('escalated')}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === 'escalated' ? 'Saving…' : 'Escalate'}
                </button>
                <button
                  type="button"
                  className={styles.actionBtnDanger}
                  onClick={() => handleAction('closed')}
                  disabled={Boolean(actionLoading)}
                >
                  {actionLoading === 'closed' ? 'Saving…' : 'Close'}
                </button>
              </div>
              <Link href={`/incidents/${selectedIncident.id}`} className={styles.drawerLink}>
                Open full investigation <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          ) : undefined
        }
      >
        {selectedIncident && (
          <div className={styles.drawerFields}>
            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>Summary</div>
              <div className={styles.drawerValue}>
                {selectedIncident.raw_alert || safeVerdict(selectedIncident.decision)}
              </div>
            </div>

            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>Verdict</div>
              <div className={styles.drawerValue}>{safeVerdict(selectedIncident.decision)}</div>
            </div>

            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>Severity</div>
              <div>
                <span className={`${styles.sevBadge} ${severityClass(selectedIncident.triage?.severity)}`}>
                  {severityLabel(selectedIncident.triage?.severity)}
                </span>
              </div>
            </div>

            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>MITRE technique</div>
              {selectedIncident.mitre_mappings && selectedIncident.mitre_mappings.length > 0 ? (
                <div className={styles.mitreList}>
                  {selectedIncident.mitre_mappings.map((m, i) => (
                    <span key={i} className={styles.mitreBadge}>
                      {m.technique_id}
                      {m.technique_name ? ` · ${m.technique_name}` : ''}
                    </span>
                  ))}
                </div>
              ) : (
                <div className={styles.mutedValue}>No techniques mapped</div>
              )}
            </div>

            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>Indicators</div>
              {selectedIncident.events?.some((e) => e.extracted_iocs && e.extracted_iocs.length > 0) ? (
                <div className={styles.iocList}>
                  {selectedIncident.events
                    .flatMap((ev) =>
                      (ev.extracted_iocs || []).map((ioc, i) => (
                        <div key={`${ioc.value}-${i}`} className={styles.iocItem}>
                          <span className={styles.iocType}>{ioc.type}</span>
                          <span>{ioc.value}</span>
                        </div>
                      ))
                    )
                    .slice(0, 8)}
                </div>
              ) : (
                <div className={styles.mutedValue}>No indicators extracted</div>
              )}
            </div>

            <div className={styles.drawerField}>
              <div className={styles.drawerLabel}>Timeline</div>
              {selectedIncident.agent_trace && selectedIncident.agent_trace.length > 0 ? (
                <div className={styles.timeline}>
                  {selectedIncident.agent_trace.map((step, i) => (
                    <div key={i} className={styles.timelineItem}>
                      <div className={styles.timelineAgent}>{step.agent_name}</div>
                      <div className={styles.timelineDuration}>
                        {step.duration_ms ? `${Math.round(step.duration_ms)}ms` : step.status}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.mutedValue}>Detected {timeAgo(selectedIncident.created_at)} ago</div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
