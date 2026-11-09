"use client";

import { useRouter } from 'next/navigation';
import { 
  Activity, 
  AlertTriangle, 
  Shield, 
  TrendingUp,
  Server,
  Network,
  ChevronRight,
  Search,
  Wifi,
  RefreshCw,
  Zap,
  Lock,
  Eye,
  Cloud,
  HardDrive,
  Monitor,
  Info
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

  // Demo data for connected nodes
  const connectedNodes = [
    { 
      environment: 'EDGE', 
      icon: 'globe',
      node: 'edge-gateway-v2', 
      integrity: 88, 
      threat: 'critical', 
      patchStatus: '2 Pending',
      patchColor: 'warning',
      lastActivity: '2 min ago' 
    },
    { 
      environment: 'CLOUD', 
      icon: 'cloud',
      node: 'cloud-cluster-01', 
      integrity: 96, 
      threat: 'low', 
      patchStatus: 'Up to Date',
      patchColor: 'success',
      lastActivity: '5 min ago' 
    },
    { 
      environment: 'DATACENTER', 
      icon: 'server',
      node: 'database-primary', 
      integrity: 92, 
      threat: 'medium', 
      patchStatus: '1 Pending',
      patchColor: 'warning',
      lastActivity: '12 min ago' 
    },
    { 
      environment: 'ENDPOINT', 
      icon: 'monitor',
      node: 'workstation-042', 
      integrity: 99, 
      threat: 'low', 
      patchStatus: 'Up to Date',
      patchColor: 'success',
      lastActivity: '1 min ago' 
    },
    { 
      environment: 'EDGE', 
      icon: 'globe',
      node: 'edge-proxy-west', 
      integrity: 85, 
      threat: 'high', 
      patchStatus: '3 Pending',
      patchColor: 'critical',
      lastActivity: '4 min ago' 
    },
  ];

  const securityControls = [
    { label: 'WAF', status: 'Active', icon: Shield },
    { label: 'EDR', status: 'Connected', icon: Eye },
    { label: 'IPS', status: 'Enabled', icon: Lock },
    { label: 'SSL', status: 'Valid', icon: Lock },
    { label: 'MFA', status: 'Required', icon: Shield },
    { label: 'VPN', status: 'Secure', icon: Network },
  ];

  // Predictive threat data (last 7 days)
  const threatData = [
    { day: 'Mon', actual: 42, predicted: 38 },
    { day: 'Tue', actual: 55, predicted: 48 },
    { day: 'Wed', actual: 38, predicted: 42 },
    { day: 'Thu', actual: 65, predicted: 52 },
    { day: 'Fri', actual: 72, predicted: 58 },
    { day: 'Sat', actual: 48, predicted: 45 },
    { day: 'Sun', actual: 85, predicted: 60 },
  ];

  const maxThreat = Math.max(...threatData.map(d => Math.max(d.actual, d.predicted)));

  return (
    <div className="page-container">
      {/* Top KPI Cards - 4 cards matching SentinelX design */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>
        
        {/* KPI 1: Global Threat Level */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Global Threat Level
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--severity-high)', marginBottom: '4px' }}>
                ELEVATED
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={12} />
                DEFCON 3 Equivalent
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <AlertTriangle size={20} style={{ color: 'var(--severity-high)' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <TrendingUp size={12} style={{ color: 'var(--severity-high)' }} />
            <span>+8% increase today</span>
          </div>
        </div>

        {/* KPI 2: Active Incidents */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Active Incidents
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                24
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--severity-high)' }}>+12%</span> from last week
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <Shield size={20} style={{ color: 'var(--severity-high)' }} />
            </div>
          </div>
        </div>

        {/* KPI 3: Systems Online */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(0, 232, 135, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Systems Online
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                1,402
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Uptime: <span style={{ color: 'var(--primary-green)' }}>99.98%</span>
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(0, 232, 135, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 232, 135, 0.2)' }}>
              <Server size={20} style={{ color: 'var(--primary-green)' }} />
            </div>
          </div>
        </div>

        {/* KPI 4: Network Traffic */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Network Traffic
              </div>
              <div style={{ fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>
                4.2<span style={{ fontSize: '20px', color: 'var(--text-secondary)' }}>TB/s</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Standard baseline
              </div>
            </div>
            <div style={{ padding: '10px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
              <Activity size={20} style={{ color: 'var(--secondary-cyan)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Three Advanced Dashboard Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
        
        {/* Panel 1: System Integrity */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>System Integrity</h3>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '11px' }}>
              <Activity size={12} />
              Diagnostics
            </button>
          </div>

          {/* Resource Utilization */}
          <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Memory</div>
              <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>72%</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>CPU</div>
              <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>41%</div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Storage</div>
              <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>68%</div>
            </div>
          </div>

          {/* Integrity Gauge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px', padding: '20px 0' }}>
            <div style={{ position: 'relative', width: '180px', height: '90px' }}>
              {/* Background arc */}
              <svg width="180" height="90" viewBox="0 0 180 90" style={{ overflow: 'visible' }}>
                <path
                  d="M 10 85 A 80 80 0 0 1 170 85"
                  fill="none"
                  stroke="var(--bg-elevated)"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Gradient arc - 94% = ~169 degrees */}
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="var(--primary-green)" />
                    <stop offset="100%" stopColor="var(--secondary-purple)" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 85 A 80 80 0 0 1 170 85"
                  fill="none"
                  stroke="url(#gaugeGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="251"
                  strokeDashoffset="15"
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -20%)', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', fontWeight: 700, lineHeight: 1, fontFamily: 'var(--font-mono)', color: 'var(--primary-green)' }}>94%</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase' }}>Overall Score</div>
              </div>
            </div>
          </div>

          {/* Security Controls Status */}
          <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase' }}>
              Security Controls
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {securityControls.map((control, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', background: 'var(--bg-elevated)', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <control.icon size={12} style={{ color: 'var(--primary-green)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 500 }}>{control.label}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--primary-green)' }}>{control.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel 2: Predictive Threat Modeling */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Predictive Threat Modeling</h3>
            <button className="btn btn-secondary btn-sm" style={{ padding: '6px 12px', fontSize: '11px' }}>
              <RefreshCw size={12} />
              Sync
            </button>
          </div>

          {/* Chart */}
          <div style={{ height: '180px', marginBottom: '20px', position: 'relative' }}>
            <svg width="100%" height="180" style={{ overflow: 'visible' }}>
              {/* Grid lines */}
              {[0, 1, 2, 3, 4].map(i => (
                <line
                  key={i}
                  x1="0"
                  y1={i * 45}
                  x2="100%"
                  y2={i * 45}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                />
              ))}
              
              {/* Actual threat line (cyan) */}
              <polyline
                points={threatData.map((d, i) => `${(i / (threatData.length - 1)) * 100}%,${180 - (d.actual / maxThreat) * 160}`).join(' ')}
                fill="none"
                stroke="var(--secondary-cyan)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Predicted threat line (purple dashed) */}
              <polyline
                points={threatData.map((d, i) => `${(i / (threatData.length - 1)) * 100}%,${180 - (d.predicted / maxThreat) * 160}`).join(' ')}
                fill="none"
                stroke="var(--secondary-purple)"
                strokeWidth="2"
                strokeDasharray="4 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {threatData.map((d, i) => (
                <circle
                  key={`actual-${i}`}
                  cx={`${(i / (threatData.length - 1)) * 100}%`}
                  cy={180 - (d.actual / maxThreat) * 160}
                  r="3"
                  fill="var(--secondary-cyan)"
                />
              ))}
            </svg>
            
            {/* X-axis labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              {threatData.map((d, i) => (
                <span key={i} style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{d.day}</span>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '2px', background: 'var(--secondary-cyan)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Actual</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '2px', background: 'var(--secondary-purple)', backgroundImage: 'linear-gradient(90deg, var(--secondary-purple) 50%, transparent 50%)', backgroundSize: '4px 2px' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Predicted</span>
              </div>
            </div>
          </div>

          {/* AI Analyst Insight */}
          <div style={{ background: 'rgba(137, 87, 229, 0.1)', border: '1px solid rgba(137, 87, 229, 0.3)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ padding: '6px', background: 'rgba(137, 87, 229, 0.2)', borderRadius: '6px', flexShrink: 0 }}>
                <Zap size={14} style={{ color: 'var(--secondary-purple)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--secondary-purple)', marginBottom: '6px', textTransform: 'uppercase' }}>
                  AI Analyst
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: 1.5 }}>
                  Elevated risk detected from external edge nodes.
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Deviation: <span style={{ color: 'var(--severity-high)', fontWeight: 600 }}>+41%</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Recommendation:</strong> Enable strict IP filtering and isolate affected clusters.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panel 3: Live Topography */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Live Topography</h3>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['ALL', '1H', '24H', '7D'].map((filter, idx) => (
                <button
                  key={filter}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '4px 10px',
                    fontSize: '10px',
                    background: idx === 2 ? 'var(--primary-ghost)' : 'transparent',
                    border: idx === 2 ? '1px solid var(--primary-green)' : '1px solid var(--border-default)',
                    color: idx === 2 ? 'var(--primary-green)' : 'var(--text-secondary)'
                  }}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Network Topology Visualization */}
          <div style={{ position: 'relative', height: '340px', background: 'linear-gradient(180deg, rgba(0, 232, 135, 0.02) 0%, transparent 100%)', borderRadius: '8px', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
            {/* Background grid pattern */}
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, opacity: 0.1 }}>
              <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--primary-green)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>

            {/* Central Security Hub */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <div style={{ position: 'relative' }}>
                {/* Pulsing rings */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100px', height: '100px', border: '2px solid var(--primary-green)', borderRadius: '50%', opacity: 0.3, animation: 'pulse 2s infinite' }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70px', height: '70px', border: '2px solid var(--primary-green)', borderRadius: '50%', opacity: 0.5, animation: 'pulse 2s infinite 0.5s' }} />
                
                {/* Center node */}
                <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, var(--primary-green), var(--secondary-cyan))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0, 232, 135, 0.5)', border: '2px solid var(--bg-card)' }}>
                  <Shield size={24} style={{ color: 'var(--bg-primary)' }} />
                </div>
              </div>
            </div>

            {/* Connected Nodes */}
            {/* Top Left - Cloud */}
            <div style={{ position: 'absolute', top: '15%', left: '15%' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', top: '20px', left: '20px', width: '80px', height: '150px', zIndex: 1 }}>
                  <line x1="0" y1="0" x2="80" y2="150" stroke="var(--secondary-cyan)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                </svg>
                <div style={{ width: '40px', height: '40px', background: 'var(--bg-card)', border: '2px solid var(--secondary-cyan)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                  <Cloud size={20} style={{ color: 'var(--secondary-cyan)' }} />
                </div>
                <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', background: 'var(--primary-green)', borderRadius: '50%', border: '2px solid var(--bg-card)', zIndex: 3 }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>Cloud</div>
            </div>

            {/* Top Right - Edge */}
            <div style={{ position: 'absolute', top: '15%', right: '15%' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', top: '20px', right: '20px', width: '80px', height: '150px', zIndex: 1 }}>
                  <line x1="80" y1="0" x2="0" y2="150" stroke="var(--severity-high)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                </svg>
                <div style={{ width: '40px', height: '40px', background: 'var(--bg-card)', border: '2px solid var(--severity-high)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                  <Network size={20} style={{ color: 'var(--severity-high)' }} />
                </div>
                <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', background: 'var(--severity-critical)', borderRadius: '50%', border: '2px solid var(--bg-card)', zIndex: 3, animation: 'pulse 1.5s infinite' }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>Edge</div>
            </div>

            {/* Bottom Left - Database */}
            <div style={{ position: 'absolute', bottom: '15%', left: '20%' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', bottom: '20px', left: '20px', width: '70px', height: '100px', zIndex: 1 }}>
                  <line x1="0" y1="100" x2="70" y2="0" stroke="var(--secondary-purple)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                </svg>
                <div style={{ width: '40px', height: '40px', background: 'var(--bg-card)', border: '2px solid var(--secondary-purple)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                  <HardDrive size={20} style={{ color: 'var(--secondary-purple)' }} />
                </div>
                <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', background: 'var(--primary-green)', borderRadius: '50%', border: '2px solid var(--bg-card)', zIndex: 3 }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>Database</div>
            </div>

            {/* Bottom Right - Endpoint */}
            <div style={{ position: 'absolute', bottom: '15%', right: '20%' }}>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', bottom: '20px', right: '20px', width: '70px', height: '100px', zIndex: 1 }}>
                  <line x1="70" y1="100" x2="0" y2="0" stroke="var(--primary-green)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                </svg>
                <div style={{ width: '40px', height: '40px', background: 'var(--bg-card)', border: '2px solid var(--primary-green)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 2 }}>
                  <Monitor size={20} style={{ color: 'var(--primary-green)' }} />
                </div>
                <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '12px', height: '12px', background: 'var(--primary-green)', borderRadius: '50%', border: '2px solid var(--bg-card)', zIndex: 3 }} />
              </div>
              <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>Endpoint</div>
            </div>

            {/* Floating Alert Notification */}
            <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(239, 68, 68, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid var(--severity-critical)', borderRadius: '8px', padding: '8px 12px', maxWidth: '160px', animation: 'slideIn 0.5s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <AlertTriangle size={12} style={{ color: 'white' }} />
                <span style={{ fontSize: '10px', fontWeight: 600, color: 'white' }}>SUSPICIOUS ACTIVITY</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.3 }}>
                Edge node detected unusual traffic pattern
              </div>
            </div>

            {/* Network Stats */}
            <div style={{ position: 'absolute', bottom: '16px', left: '16px', display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', background: 'var(--primary-green)', borderRadius: '50%' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>152 Online</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', background: 'var(--severity-critical)', borderRadius: '50%' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>4 Offline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connected Nodes & Assets Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Connected Nodes & Assets</h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select style={{ 
              padding: '6px 12px', 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-default)', 
              borderRadius: '6px', 
              color: 'var(--text-primary)', 
              fontSize: '12px',
              cursor: 'pointer'
            }}>
              <option>Filter by: All Environments</option>
              <option>Edge Only</option>
              <option>Cloud Only</option>
              <option>Datacenter Only</option>
              <option>Endpoint Only</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/agents')}>
              View All
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Environment</th>
                <th>Node / Workload</th>
                <th>Integrity Score</th>
                <th>Threat Level</th>
                <th>Patch Status</th>
                <th>Last Activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {connectedNodes.map((node, idx) => {
                const getEnvironmentIcon = () => {
                  switch (node.icon) {
                    case 'cloud': return <Cloud size={16} />;
                    case 'server': return <HardDrive size={16} />;
                    case 'monitor': return <Monitor size={16} />;
                    default: return <Network size={16} />;
                  }
                };

                const getThreatColor = () => {
                  switch (node.threat) {
                    case 'critical': return 'var(--severity-critical)';
                    case 'high': return 'var(--severity-high)';
                    case 'medium': return 'var(--severity-medium)';
                    default: return 'var(--severity-low)';
                  }
                };

                const getPatchColor = () => {
                  switch (node.patchColor) {
                    case 'critical': return 'var(--severity-critical)';
                    case 'warning': return 'var(--severity-high)';
                    default: return 'var(--primary-green)';
                  }
                };

                return (
                  <tr key={idx} style={{ cursor: 'pointer' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ padding: '6px', background: 'var(--bg-elevated)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                          {getEnvironmentIcon()}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                          {node.environment}
                        </span>
                      </div>
                    </td>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                        {node.node}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, maxWidth: '100px', height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${node.integrity}%`, 
                            height: '100%', 
                            background: node.integrity >= 90 ? 'var(--primary-green)' : node.integrity >= 80 ? 'var(--severity-high)' : 'var(--severity-critical)',
                            borderRadius: '3px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)', minWidth: '35px' }}>
                          {node.integrity}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${node.threat}`} style={{ textTransform: 'capitalize' }}>
                        {node.threat}
                      </span>
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 500,
                        color: getPatchColor()
                      }}>
                        {node.patchStatus}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {node.lastActivity}
                    </td>
                    <td>
                      <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ padding: '14px 18px', background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Info size={18} style={{ color: 'var(--secondary-cyan)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Demo Mode Active</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            This dashboard displays demonstration data. Configure <code style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px', border: '1px solid var(--border-subtle)' }}>NEXT_PUBLIC_API_URL</code> environment variable to connect to your FastAPI backend for live security telemetry.
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.1; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
