"use client";

import { useEffect, useState } from 'react';
import { Bell, User, Clock, ShieldAlert, Cpu } from 'lucide-react';
import styles from './TopBar.module.css';

interface Stats {
  total_alerts: number;
  open_incidents: number;
  critical_alerts: number;
  avg_triage_seconds: number;
}

export default function TopBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.statsContainer}>
        <div className={styles.statItem}>
          <Cpu className={styles.statIcon} size={16} />
          <span className={styles.statLabel}>Total Alerts</span>
          <span className={styles.statValue}>{stats?.total_alerts || 0}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.statItem}>
          <ShieldAlert className={styles.statIcon} size={16} style={{ color: 'var(--warning)' }} />
          <span className={styles.statLabel}>Open Incidents</span>
          <span className={styles.statValue}>{stats?.open_incidents || 0}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.statItem}>
          <ShieldAlert className={styles.statIcon} size={16} style={{ color: 'var(--danger)' }} />
          <span className={styles.statLabel}>Critical</span>
          <span className={styles.statValue}>{stats?.critical_alerts || 0}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.statItem}>
          <Clock className={styles.statIcon} size={16} />
          <span className={styles.statLabel}>Avg Triage</span>
          <span className={styles.statValue}>{stats?.avg_triage_seconds || 0}s</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconButton}>
          <Bell size={20} />
          <span className={styles.badge}>3</span>
        </button>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            <User size={18} />
          </div>
          <span className={styles.userName}>Analyst</span>
        </div>
      </div>
    </header>
  );
}
