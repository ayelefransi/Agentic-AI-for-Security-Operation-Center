"use client";

import { Database, Globe, FileWarning, Shield } from 'lucide-react';

export default function ThreatIntelPage() {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Threat Intelligence
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          IOC database, malicious indicators, and threat actor profiles
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
              Malicious IPs
            </span>
            <Globe size={18} style={{ color: 'var(--severity-critical)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            1,247
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Suspicious Domains
            </span>
            <Database size={18} style={{ color: 'var(--severity-high)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            834
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              File Hashes
            </span>
            <FileWarning size={18} style={{ color: 'var(--severity-medium)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            3,421
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Threat Actors
            </span>
            <Shield size={18} style={{ color: 'var(--primary-neon)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            89
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <Database size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Threat Intelligence Hub</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Comprehensive IOC database, threat actor tracking, and intelligence feeds coming soon.
        </p>
      </div>
    </div>
  );
}
