"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Search, Bell, Moon, Sun, User, Command, Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import styles from './AppHeader.module.css';

const pageNames: Record<string, string> = {
  '/': 'Command Center',
  '/incidents': 'Incidents',
  '/analyze': 'Investigations',
  '/threat-intel': 'Threat Intelligence',
  '/agents': 'Agent Monitor',
  '/mitre': 'MITRE ATT&CK',
  '/forensics': 'Forensics',
  '/settings': 'Settings',
  '/audit': 'Audit Logs',
  '/users': 'User Management',
};

export default function AppHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [isOnline, setIsOnline] = useState(true);

  const pageTitle = pageNames[pathname] || 'NEXUS Command';
  const currentTime = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <div>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbItem}>NEXUS</span>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbItem}>{pageTitle}</span>
          </div>
        </div>
      </div>

      <div className={styles.headerRight}>
        {/* Global Search */}
        <button className={styles.searchButton}>
          <Search size={16} />
          <span>Search...</span>
          <kbd className={styles.kbd}>
            <Command size={10} /> K
          </kbd>
        </button>

        {/* Environment Badge */}
        <div className={styles.environmentBadge}>
          <span className={styles.envDot} />
          PRODUCTION
        </div>

        {/* Connectivity Status */}
        <button className={styles.iconButton} title="Backend Status">
          {isOnline ? (
            <Wifi size={18} className={styles.statusOnline} />
          ) : (
            <WifiOff size={18} className={styles.statusOffline} />
          )}
        </button>

        {/* Theme Toggle */}
        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button className={styles.iconButton} title="Notifications">
          <Bell size={18} />
          <span className={styles.notificationBadge}>3</span>
        </button>

        {/* Current Time */}
        <div className={styles.timeDisplay}>
          {currentTime}
        </div>

        {/* User Menu */}
        <div className={styles.userMenu}>
          <div className={styles.avatar}>
            <User size={16} />
          </div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>Analyst</div>
            <div className={styles.userRole}>SOC Analyst</div>
          </div>
        </div>
      </div>
    </header>
  );
}
