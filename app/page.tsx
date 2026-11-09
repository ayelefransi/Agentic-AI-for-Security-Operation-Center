"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Server,
  ChevronRight,
  Wifi,
  RefreshCw,
  WifiOff,
  Loader2,
  Clock
} from 'lucide-react';
import { fetchStats, fetchIncidents, healthCheck, type Stats, type Incident } from '@/app/lib/api';

interface DashboardData {
  stats: Stats | null;
  incidents: Incident[];
  isLoading: boolean;
  error: string | null;
  isBackendConnected: boolean;
}

export default function CommandCenter() {
  const router = useRouter();
  
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    stats: null,
    incidents: [],
    isLoading: true,
    error: null,
    isBackendConnected: false,
  });

  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      await healthCheck();
      
      const [statsData, incidentsData] = await Promise.all([
        fetchStats(),
        fetchIncidents(),
      ]);

      setDashboardData({
        stats: statsData,
        incidents: incidentsData.incidents.slice(0, 10),
        isLoading: false,
        error: null,
        isBackendConnected: true,
      });
    } catch (error: any) {
      console.error('Failed to fetch dashboard data:', error);
      setDashboardData(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to connect to backend',
        isBackendConnected: false,
      }));
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = () => {
    setDashboardData(prev => ({ ...prev, isLoading: true }));
    fetchDashboardData();
  };

  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const { stats, incidents, isLoading, error, isBackendConnected } = dashboardData;
  
  const activeThreats = incidents.filter(i => 
    i.triage?.severity === 'CRITICAL' && i.status === 'open'
  ).length;
  
  const openIncidents = stats?.open_incidents || 0;
  const criticalAlerts = stats?.critical_alerts || 0;
  const avgTriageMinutes = stats ? (stats.avg_triage_seconds / 60).toFixed(1) : '0.0';
  
  const systemHealth = isBackendConnected 
    ? Math.max(95, 100 - (criticalAlerts * 2))
    : 0;

  const getSeverityColor = (severity?: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'critical';
      case 'HIGH': return 'high';
      case 'MEDIUM': return 'medium';
      case 'LOW': return 'low';
      default: return 'info';
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="page-container">
      {/* Connection Status & Controls */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
          {isBackendConnected ? (
            <>
              <Wifi size={14} style={{ color: 'var(--status-online)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Backend Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={14} style={{ color: 'var(--severity-critical)' }} />
              <span style={{ color: 'var(--severity-critical)' }}>Backend Offline</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{currentTime}</span>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={isLoading}
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: 'auto' }}
        >
          {isLoading ? <Loader2 size={14} /> : <RefreshCw size={14} />}
          Refresh
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={autoRefresh} 
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh (30s)
        </label>
      </div>

      {/* Error State */}
      {error && !isBackendConnected && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle size={20} style={{ color: 'var(--severity-critical)' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Backend Connection Failed</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {error}. Start the FastAPI backend with: <code style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px' }}>python -m uvicorn api.index:app --reload</code>
            </div>
          </div>
        </div>
      )}

      {/* Real-time KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Active Threats
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: activeThreats > 0 ? 'var(--severity-critical)' : 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                {isLoading ? '—' : activeThreats}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Critical severity active
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={20} style={{ color: 'var(--severity-high)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Open Incidents
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                {isLoading ? '—' : openIncidents}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {criticalAlerts} critical priority
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Shield size={20} style={{ color: 'var(--severity-high)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(0, 232, 135, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                System Health
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: systemHealth > 90 ? 'var(--primary-green)' : 'var(--severity-high)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                {isLoading ? '—' : systemHealth}<span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>%</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                {isBackendConnected ? 'All systems operational' : 'Backend disconnected'}
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(0, 232, 135, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 232, 135, 0.2)' }}>
              <Server size={20} style={{ color: 'var(--primary-green)' }} />
            </div>
          </div>
        </div>

        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Avg Triage Time
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                {isLoading ? '—' : avgTriageMinutes}<span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>m</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Per incident analysis
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
              <Activity size={20} style={{ color: 'var(--secondary-cyan)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Incidents Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Recent Security Incidents</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/incidents')}>
            View All
            <ChevronRight size={14} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={32} style={{ margin: '0 auto 16px' }} />
            Loading incidents...
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Shield size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <div>No incidents found. Analyze your first alert to get started.</div>
            <button 
              className="btn btn-primary" 
              onClick={() => router.push('/analyze')}
              style={{ marginTop: '16px' }}
            >
              Analyze Alert
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Incident ID</th>
                  <th>Decision</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => (
                  <tr key={incident.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/incidents`)}>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-green)' }}>
                        {incident.id.substring(0, 8)}
                      </code>
                    </td>
                    <td style={{ fontWeight: 500 }}>{incident.decision || 'Pending'}</td>
                    <td>
                      <span className={`badge badge-${getSeverityColor(incident.triage?.severity)}`}>
                        {incident.triage?.severity || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                        {incident.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {getRelativeTime(incident.created_at)}
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

      {/* Backend Status Info */}
      {!isBackendConnected && (
        <div style={{ marginTop: '24px', padding: '14px 18px', background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Real-time Data Unavailable:</strong> Connect to the FastAPI backend to see live security telemetry and incident data.
        </div>
      )}
    </div>
  );
}
