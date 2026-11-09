"use client";

import { FileText, HardDrive, Search, Shield } from 'lucide-react';

export default function ForensicsPage() {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          Digital Forensics
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Evidence repository and forensic investigation workspace
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
              Evidence Files
            </span>
            <FileText size={18} style={{ color: 'var(--primary-neon)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            342
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Cases
            </span>
            <Search size={18} style={{ color: 'var(--secondary-cyan)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            12
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Storage Used
            </span>
            <HardDrive size={18} style={{ color: 'var(--secondary-blue)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            156 GB
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Chain of Custody
            </span>
            <Shield size={18} style={{ color: 'var(--status-online)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            98%
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>Forensics Workspace</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          Evidence management, chain of custody tracking, and forensic analysis tools coming soon.
        </p>
      </div>
    </div>
  );
}
