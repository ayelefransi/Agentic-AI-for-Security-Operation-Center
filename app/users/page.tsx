"use client";

import { Users, UserCheck, Shield, Clock } from 'lucide-react';

export default function UserManagementPage() {
  return (
    <div className="page-container">
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
          User Management
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Access control, role management, and user administration
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
              Total Users
            </span>
            <Users size={18} style={{ color: 'var(--primary-neon)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            23
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Active Now
            </span>
            <UserCheck size={18} style={{ color: 'var(--status-online)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            8
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Admin Roles
            </span>
            <Shield size={18} style={{ color: 'var(--severity-critical)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            5
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Avg Session
            </span>
            <Clock size={18} style={{ color: 'var(--secondary-cyan)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)' }}>
            4.2h
          </div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>User Management Console</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          User administration, role-based access control, and permission management coming soon.
        </p>
      </div>
    </div>
  );
}
