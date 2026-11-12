"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Filter,
  ShieldAlert,
  ChevronRight,
  RefreshCw,
  LayoutList,
  LayoutGrid,
  Plus,
  Shield,
  ArrowRight,
  Clock,
  Terminal,
  AlertTriangle
} from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import IOCChip from '../components/IOCChip';
import { fetchIncidents, type Incident } from '@/app/lib/api';
import styles from './page.module.css';

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const data = await fetchIncidents();
      setIncidents(data.incidents || []);
    } catch (e) {
      console.error('Failed to load incidents', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (severityFilter !== 'ALL') {
        const sev = inc.triage?.severity?.toUpperCase() || 'UNKNOWN';
        if (sev !== severityFilter) return false;
      }

      if (statusFilter !== 'ALL') {
        const st = inc.status?.toLowerCase() || 'open';
        if (st !== statusFilter.toLowerCase()) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        inc.id?.toLowerCase().includes(term) ||
        inc.decision?.toLowerCase().includes(term) ||
        inc.decision_reasoning?.toLowerCase().includes(term) ||
        inc.events?.some((e: any) => e.event_type?.toLowerCase().includes(term)) ||
        inc.events?.some((e: any) => e.src_ip?.toLowerCase().includes(term) || e.dst_ip?.toLowerCase().includes(term))
      );
    });
  }, [incidents, severityFilter, statusFilter, searchTerm]);

  // Statistics
  const closedStates = ['closed', 'closed_false_positive', 'closed_resolved'];
  const totalCount = incidents.length;
  const criticalCount = incidents.filter(i => i.triage?.severity?.toUpperCase() === 'CRITICAL').length;
  const highCount = incidents.filter(i => i.triage?.severity?.toUpperCase() === 'HIGH').length;
  const openCount = incidents.filter(i => !closedStates.includes((i.status || 'open').toLowerCase())).length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Incidents Queue</h1>
          <p className={styles.subtitle}>
            Autonomous multi-agent investigation feed and incident response management
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadIncidents}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => router.push('/analyze')}
          >
            <Plus size={14} />
            <span>Investigate Alert</span>
          </button>
        </div>
      </header>

      {/* Metrics Summary Strip */}
      <div className={styles.metricStrip}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Incidents</span>
          <span className={styles.metricValue}>{totalCount}</span>
          <span className={styles.metricSubtext}>Telemetry events triaged</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Critical Threats</span>
          <span className={styles.metricValue} style={{ color: 'var(--severity-critical)' }}>
            {criticalCount}
          </span>
          <span className={styles.metricSubtext}>Urgent containment needed</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>High Severity</span>
          <span className={styles.metricValue} style={{ color: 'var(--severity-high)' }}>
            {highCount}
          </span>
          <span className={styles.metricSubtext}>Elevated risk alerts</span>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Open Pipeline</span>
          <span className={styles.metricValue} style={{ color: 'var(--primary-accent)' }}>
            {openCount}
          </span>
          <span className={styles.metricSubtext}>Active investigation queue</span>
        </div>
      </div>

      {/* Controls & Search */}
      <div className={styles.controlsCard}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by ID, verdict, host, or IP address..."
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className={styles.filtersGroup}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className={styles.selectInput}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.selectInput}
          >
            <option value="ALL">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="escalated">Escalated</option>
            <option value="closed">Closed</option>
          </select>

          <div className={styles.viewToggle}>
            <button
              onClick={() => setViewMode('table')}
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              title="Table view"
            >
              <LayoutList size={16} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`${styles.viewBtn} ${viewMode === 'cards' ? styles.viewBtnActive : ''}`}
              title="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content: Table or Cards */}
      {loading && incidents.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary-accent)' }} />
          <div>Loading incidents repository...</div>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldAlert size={48} className={styles.emptyIcon} />
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>No Incidents Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '400px' }}>
            {searchTerm || severityFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'No security incidents match your filter criteria. Try resetting search filters.'
              : 'No incidents recorded in the repository. Analyze an alert in the Command Center to populate.'}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => router.push('/analyze')}
            style={{ marginTop: '8px' }}
          >
            Investigate Alert Now
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className={styles.tableContainer}>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Classification / Verdict</th>
                  <th>Severity</th>
                  <th>Risk Score</th>
                  <th>Indicators</th>
                  <th>Status</th>
                  <th>Detected</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredIncidents.map((incident) => {
                  const iocCount = incident.events?.[0]?.extracted_iocs?.length || 0;
                  return (
                    <tr
                      key={incident.id}
                      onClick={() => router.push(`/incidents/${incident.id}`)}
                      className={styles.tableRow}
                    >
                      <td>
                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-accent)', fontWeight: 600 }}>
                          #{incident.id.substring(0, 8)}
                        </code>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                          {incident.decision || 'Investigation Pending'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {incident.decision_reasoning || incident.events?.[0]?.raw_log || 'Multi-agent analysis recorded'}
                        </div>
                      </td>
                      <td>
                        <SeverityBadge severity={incident.triage?.severity || 'Low'} />
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: (incident.triage?.score || 0) > 70 ? 'var(--severity-critical)' : 'var(--text-primary)'
                        }}>
                          {incident.triage?.score ?? '—'}/100
                        </span>
                      </td>
                      <td>
                        {iocCount > 0 ? (
                          <span className="badge badge-info" style={{ fontSize: '10px' }}>
                            {iocCount} IOC{iocCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '11px' }}>
                          {incident.status?.replace(/_/g, ' ') || 'Open'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                        {new Date(incident.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', color: 'var(--primary-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          Report <ChevronRight size={14} />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filteredIncidents.map((incident) => (
            <div
              key={incident.id}
              className={styles.incidentCard}
              onClick={() => router.push(`/incidents/${incident.id}`)}
            >
              <div className={styles.cardHeader}>
                <SeverityBadge severity={incident.triage?.severity || 'Low'} />
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-accent)' }}>
                  #{incident.id.substring(0, 8)}
                </code>
                <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '10px', marginLeft: 'auto' }}>
                  {incident.status?.replace(/_/g, ' ') || 'Open'}
                </span>
              </div>

              <div>
                <h3 className={styles.cardTitle}>{incident.decision || 'Investigation Pending'}</h3>
                <p className={styles.cardDesc}>
                  {incident.decision_reasoning || incident.events?.[0]?.raw_log || 'Multi-agent analysis recorded.'}
                </p>
              </div>

              {incident.events?.[0]?.extracted_iocs && incident.events[0].extracted_iocs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {incident.events[0].extracted_iocs.slice(0, 3).map((ioc: any, idx: number) => {
                    const enr = incident.enrichments?.find((e: any) => e.ioc?.value === ioc.value);
                    return (
                      <IOCChip
                        key={idx}
                        type={ioc.type}
                        value={ioc.value}
                        verdict={enr?.final_verdict || 'unknown'}
                      />
                    );
                  })}
                  {incident.events[0].extracted_iocs.length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      +{incident.events[0].extracted_iocs.length - 3} more
                    </span>
                  )}
                </div>
              )}

              <div className={styles.cardFooter}>
                <span>{new Date(incident.created_at).toLocaleString()}</span>
                <span style={{ color: 'var(--primary-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  Inspect <ArrowRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
