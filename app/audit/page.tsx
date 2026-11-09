"use client";

import { FileCheck, Activity, Clock, User } from 'lucide-react';

export default function AuditLogsPage() {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Audit Logs
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          System activity tracking and compliance audit trail
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
              Total Events
            </span>
            <FileCheck size={18} style={{ color: 'var(--primary-neon)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            45,287
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Today
            </span>
            <Activity size={18} style={{ color: 'var(--secondary-cyan)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            1,234
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Retention
            </span>
            <Clock size={18} style={{ color: 'var(--secondary-blue)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            90d
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Users
            </span>
            <User size={18} style={{ color: 'var(--status-online)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            23
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <FileCheck size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Audit Log Viewer</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Comprehensive audit trail, compliance reporting, and activity monitoring coming soon.
        </p>
      </div>
    </div>
  );
}
