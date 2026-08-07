"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ShieldAlert, TrendingUp, AlertOctagon, Activity, ChevronRight } from 'lucide-react';
import GlassCard from './components/GlassCard';
import SeverityBadge from './components/SeverityBadge';
import IOCChip from './components/IOCChip';
import styles from './page.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [incRes, statRes] = await Promise.all([
          fetch('/api/incidents'),
          fetch('/api/stats')
        ]);
        
        if (incRes.ok) {
          const data = await incRes.json();
          setIncidents(data.incidents || []);
        }
        if (statRes.ok) {
          setStats(await statRes.json());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const mockChartData = [
    { time: "Day -7", volume: 10, severity: 20 },
    { time: "Day -6", volume: 20, severity: 25 },
    { time: "Day -5", volume: 15, severity: 40 },
    { time: "Day -4", volume: 30, severity: 30 },
    { time: "Day -3", volume: 45, severity: 55 },
    { time: "Day -2", volume: 60, severity: 80 },
    { time: "Today", volume: 95, severity: 95 },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>System Overview & Active Incidents</p>
        </div>
        <button className={styles.primaryAction} onClick={() => router.push('/analyze')}>
          <ShieldAlert size={18} />
          Analyze New Alert
        </button>
      </header>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <GlassCard delay={0.1} className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Total Alerts</span>
            <Activity className={styles.cardIcon} />
          </div>
          <div className={styles.cardValue}>{stats?.total_alerts || 0}</div>
        </GlassCard>
        
        <GlassCard delay={0.2} className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Open Incidents</span>
            <AlertOctagon className={styles.cardIcon} style={{ color: 'var(--warning)' }} />
          </div>
          <div className={styles.cardValue}>{stats?.open_incidents || 0}</div>
        </GlassCard>

        <GlassCard delay={0.3} className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Critical Severity</span>
            <AlertOctagon className={styles.cardIcon} style={{ color: 'var(--danger)' }} />
          </div>
          <div className={styles.cardValue}>{stats?.critical_alerts || 0}</div>
        </GlassCard>
      </div>

      <div className={styles.mainGrid}>
        {/* Incident Feed */}
        <div className={styles.incidentFeed}>
          <h2 className={styles.sectionTitle}>Recent Incidents</h2>
          
          {loading ? (
            <div className={styles.loadingState}>Loading incidents...</div>
          ) : incidents.length === 0 ? (
            <GlassCard className={styles.emptyState}>
              <ShieldAlert size={48} className={styles.emptyIcon} />
              <h3>No Incidents Found</h3>
              <p>The system has not ingested any alerts yet.</p>
              <button onClick={() => router.push('/analyze')} className={styles.textButton}>
                Analyze an alert to get started
              </button>
            </GlassCard>
          ) : (
            <div className={styles.feedList}>
              {incidents.slice(0, 5).map((incident, i) => (
                <GlassCard 
                  key={incident.id} 
                  delay={0.4 + (i * 0.1)} 
                  hoverEffect 
                  className={styles.feedItem}
                >
                  <div className={styles.feedItemHeader}>
                    <SeverityBadge severity={incident.triage?.severity || 'Low'} />
                    <span className={styles.timeAgo}>
                      {new Date(incident.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <h3 className={styles.feedItemTitle}>
                    {incident.decision || "Investigation Pending"}
                  </h3>
                  
                  <p className={styles.feedItemDesc}>
                    {incident.decision_reasoning?.substring(0, 100)}...
                  </p>

                  {incident.events && incident.events[0]?.extracted_iocs && (
                    <div className={styles.iocList}>
                      {incident.events[0].extracted_iocs.slice(0, 3).map((ioc: any, idx: number) => {
                         // find enrichment verdict if available
                         const enr = incident.enrichments?.find((e: any) => e.ioc.value === ioc.value);
                         return (
                           <IOCChip 
                             key={idx} 
                             type={ioc.type} 
                             value={ioc.value} 
                             verdict={enr?.final_verdict || 'unknown'} 
                           />
                         );
                      })}
                      {incident.events[0].extracted_iocs.length > 3 && (
                        <span className={styles.moreIocs}>+{incident.events[0].extracted_iocs.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className={styles.feedItemFooter}>
                    <button className={styles.viewButton} onClick={() => router.push(`/incidents/${incident.id}`)}>
                      View Details <ChevronRight size={16} />
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* Telemetry Chart */}
        <div className={styles.chartSection}>
          <h2 className={styles.sectionTitle}>Threat Telemetry</h2>
          <GlassCard delay={0.6} className={styles.chartCard}>
             <div className={styles.chartHeader}>
               <TrendingUp size={20} color="var(--accent-green)" />
               <h3>7-Day Volume vs Severity</h3>
             </div>
             <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSeverity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "rgba(255, 255, 255, 0.9)", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "8px" }}
                      itemStyle={{ fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="volume" name="Signal Activity" stroke="var(--accent-green)" strokeWidth={3} fillOpacity={1} fill="url(#colorVolume)" />
                    <Area type="monotone" dataKey="severity" name="Threat Gravity" stroke="var(--danger)" strokeWidth={3} fillOpacity={1} fill="url(#colorSeverity)" />
                  </AreaChart>
                </ResponsiveContainer>
             </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
