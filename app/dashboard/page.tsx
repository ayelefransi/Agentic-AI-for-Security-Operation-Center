"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, AlertCircle } from 'lucide-react';
import {
  fetchStats,
  fetchIncidents,
  fetchAgentHealth,
  fetchIncidentVolume,
  updateIncidentStatus,
  type Stats,
  type Incident,
  type AgentHealth,
  type VolumeBucket,
} from '@/app/lib/api';
import { useSearch } from '@/app/components/AppShell';
import GlassPanel from '@/app/components/GlassPanel';
import MetricTile from '@/app/components/MetricTile';
import DataTable, { type DataTableColumn } from '@/app/components/DataTable';
import Drawer from '@/app/components/Drawer';
import StatusDot, { type StatusDotTone } from '@/app/components/StatusDot';
import styles from './page.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function severityClass(sev: string | undefined): string {
  switch (sev?.toLowerCase()) {
    case 'critical': return styles.sevCritical;
    case 'high': return styles.sevHigh;
    case 'medium': return styles.sevMedium;
    case 'low': return styles.sevLow;
    default: return styles.sevLow;
  }
}

function severityLabel(sev: string | undefined): string {
  if (!sev) return 'Low';
  return sev.charAt(0).toUpperCase() + sev.slice(1).toLowerCase();
}

function formatStatus(status: string | undefined): string {
  if (!status || status === 'open') return 'Open';
  const clean = status.replace(/_/g, ' ');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function statusDotTone(status: string | undefined): StatusDotTone {
  switch (status?.toLowerCase()) {
    case 'open': return 'high';
    case 'escalated': return 'critical';
    case 'acknowledged':
    case 'investigating': return 'medium';
    case 'closed':
    case 'closed_resolved':
    case 'closed_false_positive': return 'neutral';
    default: return 'low';
  }
}

function isClosedStatus(status: string | undefined): boolean {
  const s = status?.toLowerCase();
  return s === 'closed' || s === 'closed_false_positive' || s === 'closed_resolved';
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

function buildFallbackVolume(incidents: Incident[], range: '24h' | '7d'): VolumeBucket[] {
  const count = range === '24h' ? 24 : 7;
  const interval = range === '24h' ? 3600000 : 86400000;
  const now = Date.now();
  const buckets: VolumeBucket[] = Array.from({ length: count }, (_, idx) => ({
    label: range === '24h' ? `${count - 1 - idx}h` : `${count - 1 - idx}d`,
    count: 0,
  }));

  incidents.forEach((inc) => {
    const created = new Date(inc.created_at).getTime();
    const diffIdx = Math.floor((now - created) / interval);
    if (diffIdx >= 0 && diffIdx < count) {
      buckets[count - 1 - diffIdx].count += 1;
    }
  });
  return buckets;
}

function computePeriodComparison(incidents: Incident[], filterFn: (i: Incident) => boolean) {
  const now = Date.now();
  const dayMs = 86400000;
  const current = incidents.filter((i) => {
    const t = new Date(i.created_at).getTime();
    return filterFn(i) && now - t <= dayMs;
  }).length;
  const previous = incidents.filter((i) => {
    const t = new Date(i.created_at).getTime();
    return filterFn(i) && now - t > dayMs && now - t <= dayMs * 2;
  }).length;

  const delta = current - previous;
  return { delta };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch();

  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [agents, setAgents] = useState<AgentHealth[]>([]);
  const [volumeBuckets, setVolumeBuckets] = useState<VolumeBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updatedText, setUpdatedText] = useState('Loading…');
  const [chartRange, setChartRange] = useState<'24h' | '7d'>('24h');
  const [sevFilter, setSevFilter] = useState<string>('all');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadVolume = useCallback(
    async (range: '24h' | '7d', currentIncidents?: Incident[]) => {
      try {
        const res = await fetchIncidentVolume(range);
        setVolumeBuckets(res.buckets || []);
      } catch {
        setVolumeBuckets(buildFallbackVolume(currentIncidents ?? incidents, range));
      }
    },
    [incidents]
  );

  const loadData = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
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
        setLastUpdated(new Date());
        setError('');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unable to load SOC telemetry';
        setError(msg);
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

  // Auto-refresh every 30s, paused while tab is hidden
  useEffect(() => {
    const start = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        loadData();
      }, 30000);
    };
    const stop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    const handleVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        loadData();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  // Update "Updated X ago" caption periodically
  useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => setUpdatedText(`Updated ${timeAgo(lastUpdated.toISOString())}`);
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  // Handle 24h / 7d toggle with API refetch
  const handleRangeChange = async (range: '24h' | '7d') => {
    setChartRange(range);
    await loadVolume(range);
  };

  // Unified counts derived from the same incidents array as the table
  const openCount = incidents.filter((i) => !isClosedStatus(i.status)).length;
  const critHighCount = incidents.filter((i) => {
    const sev = i.triage?.severity?.toLowerCase();
    return sev === 'critical' || sev === 'high';
  }).length;

  const avgTriageDisplay = stats
    ? stats.avg_triage_seconds < 60
      ? `${Math.round(stats.avg_triage_seconds)}s`
      : `${(stats.avg_triage_seconds / 60).toFixed(1)}m`
    : '—';

  // Period-over-period comparisons (last 24h vs previous 24h)
  const openDelta = computePeriodComparison(incidents, (i) => !isClosedStatus(i.status)).delta;
  const critHighDelta = computePeriodComparison(incidents, (i) => {
    const s = i.triage?.severity?.toLowerCase();
    return s === 'critical' || s === 'high';
  }).delta;

  const filteredIncidents = incidents.filter((i) => {
    if (sevFilter !== 'all' && i.triage?.severity?.toLowerCase() !== sevFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const source = i.events?.[0]?.src_ip || i.events?.[0]?.hostname || '';
      const haystack = `${i.id} ${i.decision || ''} ${i.raw_alert || ''} ${source}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sevCounts = {
    all: incidents.length,
    critical: incidents.filter((i) => i.triage?.severity?.toLowerCase() === 'critical').length,
    high: incidents.filter((i) => i.triage?.severity?.toLowerCase() === 'high').length,
    medium: incidents.filter((i) => i.triage?.severity?.toLowerCase() === 'medium').length,
    low: incidents.filter((i) => i.triage?.severity?.toLowerCase() === 'low').length,
  };

  const maxBar = Math.max(...volumeBuckets.map((b) => b.count), 1);

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

  const columns: DataTableColumn<Incident>[] = [
    {
      key: 'incident',
      header: 'Incident',
      render: (inc) => (
        <div>
          <div className={styles.incidentTitle}>{safeVerdict(inc.decision)}</div>
          <div className={styles.incidentId}>{inc.id.substring(0, 12)}</div>
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Severity',
      render: (inc) => (
        <span className={`${styles.sevBadge} ${severityClass(inc.triage?.severity)}`}>
          {severityLabel(inc.triage?.severity)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (inc) => (
        <span className={styles.statusCell}>
          <StatusDot status={statusDotTone(inc.status)} size="sm" />
          <span>{formatStatus(inc.status)}</span>
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      className: styles.mutedCell,
      render: (inc) => inc.events?.[0]?.src_ip || inc.events?.[0]?.hostname || '—',
    },
    {
      key: 'detected',
      header: 'Detected',
      className: styles.mutedCell,
      render: (inc) => timeAgo(inc.created_at),
    },
  ];

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

  return (
    <div className={styles.page}>
      {/* Page title & refresh status */}
      <div className={styles.header}>
        <h1 className={styles.title}>Overview</h1>
        <div className={styles.updatedRow}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => loadData(true)}
            aria-label="Refresh dashboard data"
            title="Refresh now"
            disabled={refreshing}
          >
            <RefreshCw size={12} className={refreshing ? styles.spinning : ''} />
          </button>
          <span>{updatedText}</span>
        </div>
      </div>

      {/* Row 1: Three Metric Tiles */}
      <div className={styles.tiles}>
        <MetricTile
          loading={loading}
          label="Open incidents"
          value={openCount}
          trend={openDelta > 0 ? 'up' : openDelta < 0 ? 'down' : 'flat'}
          trendTone={openDelta > 0 ? 'critical' : openDelta < 0 ? 'good' : 'neutral'}
          changeText={
            openDelta === 0
              ? 'No change vs prev 24h'
              : `${openDelta > 0 ? '+' : ''}${openDelta} vs prev 24h`
          }
        />
        <MetricTile
          loading={loading}
          label="Critical and high"
          value={critHighCount}
          trend={critHighDelta > 0 ? 'up' : critHighDelta < 0 ? 'down' : 'flat'}
          trendTone={critHighDelta > 0 ? 'critical' : critHighDelta < 0 ? 'good' : 'neutral'}
          changeText={
            critHighDelta === 0
              ? 'No change vs prev 24h'
              : `${critHighDelta > 0 ? '+' : ''}${critHighDelta} vs prev 24h`
          }
        />
        <MetricTile
          loading={loading}
          label="Average triage time"
          value={avgTriageDisplay}
          trend="flat"
          trendTone="neutral"
          changeText={incidents.length > 0 ? `Across ${incidents.length} triaged` : 'No triaged alerts yet'}
        />
      </div>

      {/* Row 2: Incident Volume Chart (2/3) + Agent Status (1/3) */}
      <div className={styles.middleRow}>
        <GlassPanel className={styles.chartPanel}>
          <div className={styles.chartHeader}>
            <h2 className={styles.panelTitle}>Incident volume</h2>
            <div className={styles.toggleGroup} role="group" aria-label="Chart range">
              <button
                type="button"
                className={`${styles.toggleBtn} ${chartRange === '24h' ? styles.toggleActive : ''}`}
                onClick={() => handleRangeChange('24h')}
              >
                24h
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${chartRange === '7d' ? styles.toggleActive : ''}`}
                onClick={() => handleRangeChange('7d')}
              >
                7d
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.chartSkeleton} />
          ) : volumeBuckets.every((b) => b.count === 0) ? (
            <div className={styles.chartEmpty}>
              <p>No incident volume recorded in this window.</p>
              <button
                type="button"
                className={styles.secondaryActionBtn}
                onClick={() => router.push('/analyze')}
              >
                Investigate alert
              </button>
            </div>
          ) : (
            <>
              <div className={styles.chartSvgWrap}>
                <svg
                  className={styles.chartSvg}
                  viewBox={`0 0 ${volumeBuckets.length * 20} 140`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`Incident volume over ${chartRange}`}
                >
                  {volumeBuckets.map((bucket, idx) => {
                    const barHeight = bucket.count > 0 ? Math.max((bucket.count / maxBar) * 124, 6) : 2;
                    return (
                      <rect
                        key={bucket.label + idx}
                        x={idx * 20 + 3}
                        y={136 - barHeight}
                        width={14}
                        height={barHeight}
                        rx={3}
                        className={bucket.count > 0 ? styles.svgBar : styles.svgBarEmpty}
                      >
                        <title>{`${bucket.label}: ${bucket.count} incident${bucket.count === 1 ? '' : 's'}`}</title>
                      </rect>
                    );
                  })}
                </svg>
              </div>
              <div className={styles.chartLabels}>
                <span>{chartRange === '24h' ? '24h ago' : '7d ago'}</span>
                <span>Now</span>
              </div>
            </>
          )}
        </GlassPanel>

        <GlassPanel className={styles.agentPanel}>
          <h2 className={styles.panelTitle}>Agent status</h2>
          <div className={styles.agentList}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow} />
              ))
            ) : agents.length === 0 ? (
              <div className={styles.agentEmpty}>No agent telemetry available.</div>
            ) : (
              agents.slice(0, 6).map((agent) => {
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
                        status={
                          agent.status === 'online'
                            ? 'online'
                            : agent.status === 'warning'
                              ? 'warning'
                              : 'offline'
                        }
                        label={agent.status}
                      />
                      <span className={styles.agentName}>{agent.name}</span>
                      <span className={styles.agentLatency}>{agent.latency_ms}ms</span>
                    </button>
                    {isExpanded && (
                      <div className={styles.agentExpanded}>
                        Last run: {agent.last_run}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Row 3: Recent Incidents Table */}
      <GlassPanel className={styles.tablePanel}>
        <div className={styles.tableHeader}>
          <h2 className={styles.panelTitle}>Recent incidents</h2>
          <div className={styles.severityTabs} role="tablist" aria-label="Filter by severity">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={sevFilter === tab}
                className={`${styles.sevTab} ${sevFilter === tab ? styles.sevTabActive : ''}`}
                onClick={() => setSevFilter(tab)}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({sevCounts[tab]})
              </button>
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={filteredIncidents.slice(0, 8)}
          getRowKey={(inc) => inc.id}
          onRowClick={(inc) => {
            setActionError('');
            setSelectedIncident(inc);
          }}
          loading={loading}
          emptyMessage={
            searchQuery.trim()
              ? `No incidents match "${searchQuery.trim()}".`
              : sevFilter === 'all'
                ? 'No incidents detected yet.'
                : `No ${sevFilter} severity incidents.`
          }
          emptyActionLabel={
            searchQuery.trim() || sevFilter !== 'all'
              ? 'Clear filters'
              : 'Investigate alert'
          }
          onEmptyAction={() => {
            if (searchQuery.trim() || sevFilter !== 'all') {
              setSearchQuery('');
              setSevFilter('all');
            } else {
              router.push('/analyze');
            }
          }}
        />
      </GlassPanel>

      {/* Slide-over Triage Drawer */}
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
              <div className={styles.drawerValue}>
                {safeVerdict(selectedIncident.decision)}
              </div>
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
                <div className={styles.mutedValue}>Detected {timeAgo(selectedIncident.created_at)}</div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
