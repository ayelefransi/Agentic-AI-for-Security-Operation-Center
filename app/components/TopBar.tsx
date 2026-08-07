"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, User, Clock, ShieldAlert, Cpu, Moon, Sun, Command } from 'lucide-react';
import CountUp from 'react-countup';
import { useTheme } from '../contexts/ThemeContext';
import styles from './TopBar.module.css';

interface Stats {
  total_alerts: number;
  open_incidents: number;
  critical_alerts: number;
  avg_triage_seconds: number;
}

interface KpiChipProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color?: string;
  delay?: number;
}

function KpiChip({ icon, label, value, suffix = '', color, delay = 0 }: KpiChipProps) {
  const prevValue = useRef(0);

  useEffect(() => {
    prevValue.current = value;
  }, [value]);

  return (
    <motion.div
      className={styles.kpiChip}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(16,24,40,0.10)' }}
    >
      <div className={styles.kpiIcon} style={color ? { color } : undefined}>
        {icon}
      </div>
      <div className={styles.kpiInfo}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiValue}>
          <CountUp
            start={prevValue.current}
            end={value}
            duration={1.2}
            separator=","
            useEasing
          />
          {suffix}
        </span>
      </div>
    </motion.div>
  );
}

interface TopBarProps {
  onCommandPalette?: () => void;
}

export default function TopBar({ onCommandPalette }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [badgePulse, setBadgePulse] = useState(false);
  const prevCritical = useRef(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          const data = await res.json();
          // Trigger pulse if critical count increased
          if (data.critical_alerts > prevCritical.current) {
            setBadgePulse(true);
            setTimeout(() => setBadgePulse(false), 2000);
          }
          prevCritical.current = data.critical_alerts;
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className={styles.topbar}>
      <div className={styles.kpiRow}>
        <KpiChip
          icon={<Cpu size={15} />}
          label="Total Alerts"
          value={stats?.total_alerts || 0}
          delay={0}
        />
        <KpiChip
          icon={<ShieldAlert size={15} />}
          label="Open Incidents"
          value={stats?.open_incidents || 0}
          color="var(--color-medium)"
          delay={0.05}
        />
        <KpiChip
          icon={<ShieldAlert size={15} />}
          label="Critical"
          value={stats?.critical_alerts || 0}
          color="var(--color-critical)"
          delay={0.1}
        />
        <KpiChip
          icon={<Clock size={15} />}
          label="Avg Triage"
          value={stats?.avg_triage_seconds || 0}
          suffix="s"
          delay={0.15}
        />
      </div>

      <div className={styles.actions}>
        {/* Command Palette Trigger */}
        <button
          className={styles.cmdKButton}
          onClick={onCommandPalette}
          aria-label="Open command palette"
        >
          <Command size={14} />
          <span className={styles.cmdKLabel}>Search</span>
          <kbd className={styles.kbd}>⌘K</kbd>
        </button>

        {/* Theme Toggle */}
        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <AnimatePresence mode="wait">
            {theme === 'light' ? (
              <motion.div
                key="moon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Moon size={18} />
              </motion.div>
            ) : (
              <motion.div
                key="sun"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sun size={18} />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* Notification Bell */}
        <button className={styles.iconButton} aria-label="Notifications">
          <Bell size={18} />
          <span className={`${styles.badge} ${badgePulse ? styles.badgePulse : ''}`}>
            {stats?.critical_alerts || 0}
          </span>
        </button>

        {/* User Profile */}
        <div className={styles.userProfile}>
          <div className={styles.avatar}>
            <User size={16} />
          </div>
          <span className={styles.userName}>Analyst</span>
        </div>
      </div>
    </header>
  );
}
