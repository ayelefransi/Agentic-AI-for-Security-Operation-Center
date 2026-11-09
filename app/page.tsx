"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, AlertTriangle, Shield, Clock, ChevronRight, Search } from 'lucide-react';
import MetricCard from './components/MetricCard';
import SeverityBadge from './components/SeverityBadge';
import { fetchStats, fetchIncidents, type Stats, type Incident } from './lib/api';
import { useTranslation } from './lib/i18n';
import styles from './page.module.css';

/**
 * Command Center Dashboard - Main entry point for SOC Platform.
 * 
 * Displays:
 * - Real-time SOC metrics (incidents, alerts, triage time)
 * - Recent security incidents table
 * - Quick actions (analyze alert)
 * 
 * Features:
 * - Auto-refresh every 15 seconds
 * - Error handling with retry
 * - Loading states
 * - Cyberpunk UI with Matrix-inspired animations
 * 
 * @returns Dashboard page component
 */
export default function CommandCenter() {
  const router = useRouter();
  const t = useTranslation('dashboard');
  const tc = useTranslation('common');
  const [stats, setStats] = useState<Stats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [statsData, incidentsData] = await Promise.all([
          fetchStats(),
          fetchIncidents()
        ]);

        setStats(statsData);
        setIncidents(incidentsData.incidents || []);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className={styles.container}>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <AlertTriangle size={48} color="var(--color-error)" />
          <h3 style={{ marginTop: '1rem' }}>{t('failedToLoad')}</h3>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
          <button 
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem' }}
          >
            {tc('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('title')}</h1>
          <p className={styles.description}>{t('description')}</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => router.push('/analyze')}
        >
          <Search size={16} />
          {t('analyzeAlert')}
        </button>
      </div>

      {/* Metrics */}
      <div className={styles.metricsGrid}>
        <MetricCard
          title={t('activeIncidents')}
          value={stats?.open_incidents || 0}
          icon={<Activity size={18} />}
          loading={loading}
        />
        <MetricCard
          title={t('criticalAlerts')}
          value={stats?.critical_alerts || 0}
          icon={<AlertTriangle size={18} />}
          loading={loading}
        />
        <MetricCard
          title={t('totalAlerts')}
          value={stats?.total_alerts || 0}
          icon={<Shield size={18} />}
          loading={loading}
        />
        <MetricCard
          title={t('avgTriageTime')}
          value={stats ? `${stats.avg_triage_seconds.toFixed(1)}s` : '0s'}
          icon={<Clock size={18} />}
          loading={loading}
        />
      </div>

      {/* Recent Incidents */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('recentIncidents')}</h2>
          <Link href="/incidents" className={styles.sectionLink}>
            {tc('viewAll')} <ChevronRight size={16} />
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
              <div className="empty-state-title">{t('noIncidents')}</div>
              <div className="empty-state-description">
                {t('noIncidentsDescription')}
              </div>
              <button 
                className="btn btn-primary mt-4"
                onClick={() => router.push('/analyze')}
              >
                {t('analyzeFirstAlert')}
              </button>
            </div>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('tableHeaders.id')}</th>
                  <th>{t('tableHeaders.verdict')}</th>
                  <th>{t('tableHeaders.severity')}</th>
                  <th>{t('tableHeaders.eventType')}</th>
                  <th>{t('tableHeaders.source')}</th>
                  <th>{t('tableHeaders.time')}</th>
                  <th>{t('tableHeaders.status')}</th>
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
                      {incident.decision || t('pending')}
                    </td>
                    <td>
                      {incident.triage?.severity ? (
                        <SeverityBadge severity={incident.triage.severity} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      {incident.events?.[0]?.event_type || t('unknown')}
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
