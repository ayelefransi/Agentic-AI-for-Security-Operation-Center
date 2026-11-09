"use client";

import { useRouter } from 'next/navigation';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  Clock, 
  ChevronRight, 
  Search,
  Zap,
  Database,
  Wifi,
  CheckCircle
} from 'lucide-react';
import styles from './page.module.css';

export default function CommandCenter() {
  const router = useRouter();

  const currentTime = new Date().toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const demoIncidents = [
    { id: 'INC-2024-1247', threat: 'Suspicious PowerShell Execution', severity: 'critical', sourceIp: '192.168.1.142', asset: 'WKS-FINANCE-07', time: '2 min ago', status: 'investigating' },
    { id: 'INC-2024-1246', threat: 'Brute Force Authentication Attempt', severity: 'high', sourceIp: '203.0.113.87', asset: 'VPN-Gateway', time: '15 min ago', status: 'contained' },
    { id: 'INC-2024-1245', threat: 'Malware Detection - Trojan.GenericKD', severity: 'critical', sourceIp: '192.168.5.203', asset: 'WKS-SALES-12', time: '1 hour ago', status: 'resolved' },
    { id: 'INC-2024-1244', threat: 'Unauthorized Access Attempt', severity: 'medium', sourceIp: '198.51.100.42', asset: 'APP-SERVER-03', time: '2 hours ago', status: 'new' },
  ];

  return (
    <div className="page-container">
      {/* Header Section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
              Security Operations Overview
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Real-time visibility into your security infrastructure
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => router.push('/analyze')}>
            <Search size={16} />
            Analyze Alert
          </button>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
            <Wifi size={14} style={{ color: 'var(--status-online)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>System Online</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '12px' }}>
            <Clock size={14} style={{ color: 'var(--text-muted)' }} />
            <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{currentTime}</span>
          </div>
          <div style={{ padding: '6px 12px', background: 'rgba(0, 240, 120, 0.1)', border: '1px solid var(--primary-dim)', borderRadius: 'var(--radius-md)', fontSize: '11px', fontWeight: 600, color: 'var(--primary-neon)', fontFamily: 'var(--font-mono)' }}>
            DEMO MODE
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Active Threats
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--severity-critical)', fontFamily: 'var(--font-mono)' }}>
                8
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(255, 69, 69, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <AlertTriangle size={24} style={{ color: 'var(--severity-critical)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--severity-critical)' }}>+3</span> in last hour
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Open Incidents
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--severity-high)', fontFamily: 'var(--font-mono)' }}>
                23
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(255, 138, 61, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <Shield size={24} style={{ color: 'var(--severity-high)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            12 critical priority
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Agents Online
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--status-online)', fontFamily: 'var(--font-mono)' }}>
                152
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0, 240, 120, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <Activity size={24} style={{ color: 'var(--status-online)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            of 156 total endpoints
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Avg Triage Time
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--secondary-cyan)', fontFamily: 'var(--font-mono)' }}>
                4.2<span style={{ fontSize: '18px' }}>m</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <Zap size={24} style={{ color: 'var(--secondary-cyan)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--status-online)' }}>-15%</span> from yesterday
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Investigations
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--secondary-purple)', fontFamily: 'var(--font-mono)' }}>
                17
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(168, 85, 247, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <Search size={24} style={{ color: 'var(--secondary-purple)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            9 active, 8 completed
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                System Health
              </div>
              <div style={{ fontSize: '36px', fontWeight: 700, color: 'var(--status-online)', fontFamily: 'var(--font-mono)' }}>
                98<span style={{ fontSize: '18px' }}>%</span>
              </div>
            </div>
            <div style={{ padding: '12px', background: 'rgba(0, 240, 120, 0.1)', borderRadius: 'var(--radius-md)' }}>
              <Database size={24} style={{ color: 'var(--status-online)' }} />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            All systems operational
          </div>
        </div>
      </div>

      {/* Recent Incidents */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Recent Security Incidents</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/incidents')}>
            View All
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Threat</th>
                <th>Severity</th>
                <th>Source IP</th>
                <th>Asset</th>
                <th>Time</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {demoIncidents.map((incident) => (
                <tr key={incident.id}>
                  <td>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-neon)' }}>
                      {incident.id}
                    </code>
                  </td>
                  <td style={{ fontWeight: 500 }}>{incident.threat}</td>
                  <td>
                    <span className={`badge badge-${incident.severity}`}>
                      {incident.severity}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {incident.sourceIp}
                    </code>
                  </td>
                  <td>{incident.asset}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {incident.time}
                  </td>
                  <td>
                    <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                      {incident.status}
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
      </div>

      {/* Info Banner */}
      <div style={{ padding: '16px 20px', background: 'rgba(34, 211, 238, 0.1)', border: '1px solid rgba(34, 211, 238, 0.3)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Database size={20} style={{ color: 'var(--secondary-cyan)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Backend API Not Connected</div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            This dashboard displays demonstration data. Configure <code style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>NEXT_PUBLIC_API_URL</code> to connect to your FastAPI backend for live telemetry.
          </div>
        </div>
      </div>
    </div>
  );
}
