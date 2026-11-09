"use client";

import { Activity, HardDrive, Cpu, Wifi } from 'lucide-react';

export default function AgentMonitorPage() {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Agent Monitor
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Real-time endpoint monitoring and agent health
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Agents
            </span>
            <Activity size={18} style={{ color: 'var(--primary-neon)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            156
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Online
            </span>
            <Wifi size={18} style={{ color: 'var(--status-online)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--status-online)' }}>
            152
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Avg CPU
            </span>
            <Cpu size={18} style={{ color: 'var(--secondary-cyan)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            23%
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Avg Memory
            </span>
            <HardDrive size={18} style={{ color: 'var(--secondary-blue)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            4.2 GB
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <Activity size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Agent Monitoring Dashboard</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Detailed endpoint monitoring, agent health metrics, and real-time system telemetry coming soon.
        </p>
      </div>
    </div>
  );
}
