"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertTriangle, Shield, Clock, ChevronRight, Search } from 'lucide-react';
import MetricCard from './components/MetricCard';
import SeverityBadge from './components/SeverityBadge';
import styles from './page.module.css';

interface Stats {
  total_alerts: number;
  open_incidents: number;
  critical_alerts: number;
  avg_triage_seconds: number;
}

interface Incident {
  id: string;
  created_at: string;
  decision: string;
  decision_reasoning: string;
  triage?: {
    severity: string;
    score: number;
  };
  events?: Array<{
    event_type: string;
    src_ip?: string;
    dst_ip?: string;
  }>;
  status: string;
}

export default function CommandCenter() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, incidentsRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/incidents')
        ]);

        if (statsRes.ok) {
          setStats(await statsRes.json());
        }

        if (incidentsRes.ok) {
          const data = await incidentsRes.json();
          setIncidents(data.incidents || []);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Command Center</h1>
          <p className={styles.description}>Security operations overview and active incidents</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => router.push('/analyze')}
        >
          <Search size={16} />
          Analyze Alert
        </button>
      </div>

      {/* Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title="Active Incidents"
          value={stats?.open_incidents || 0}
          icon={<Activity size={18} />}
          loading={loading}
        />
        <MetricCard
          title="Critical Alerts"
          value={stats?.critical_alerts || 0}
          icon={<AlertTriangle size={18} />}
          loading={loading}
        />
        <MetricCard
          title="Total Alerts"
          value={stats?.total_alerts || 0}
          icon={<Shield size={18} />}
          loading={loading}
        />
        <MetricCard
          title="Avg Triage Time"
          value={stats ? `${stats.avg_triage_seconds.toFixed(1)}s` : '0s'}
          icon={<Clock size={18} />}
          loading={loading}
        />
      </div>

      {/* Recent Incidents */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Incidents</h2>
          <Link href="/incidents" className={styles.sectionLink}>
            View All <ChevronRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="card">
            <div className="skeleton" style={{ height: '200px' }}></div>
          </div>
        ) : incidents.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">
                <Shield size={48} />
              </div>
              <div className="empty-state-title">No Incidents</div>
              <div className="empty-state-description">
                No security incidents have been recorded yet.
              </div>
              <button 
                className="btn btn-primary mt-4"
                onClick={() => router.push('/analyze')}
              >
                Analyze Your First Alert
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Verdict</th>
                  <th>Severity</th>
                  <th>Event Type</th>
                  <th>Source</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incidents.slice(0, 10).map((incident) => (
                  <tr key={incident.id} onClick={() => router.push(`/incidents/${incident.id}`)} style={{ cursor: 'pointer' }}>
                    <td>
                      <code style={{ fontSize: '12px' }}>
                        {incident.id.substring(0, 8)}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {incident.decision || 'Pending'}
                    </td>
                    <td>
                      {incident.triage?.severity ? (
                        <SeverityBadge severity={incident.triage.severity} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {incident.events?.[0]?.event_type || 'Unknown'}
                    </td>
                    <td>
                      {incident.events?.[0]?.src_ip ? (
                        <code style={{ fontSize: '12px' }}>
                          {incident.events[0].src_ip}
                        </code>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-muted" style={{ fontSize: '12px' }}>
                      {new Date(incident.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {incident.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
