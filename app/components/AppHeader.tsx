"use client";

import { usePathname } from 'next/navigation';
import { Search, Bell, Moon, Sun, User } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import styles from './AppHeader.module.css';

const pageNames: Record<string, string> = {
  '/': 'Command Center',
  '/incidents': 'Incidents',
  '/analyze': 'Investigations',
  '/agents': 'Agent Monitor',
  '/mitre': 'MITRE ATT&CK',
  '/forensics': 'Forensics',
  '/threat-intel': 'Threat Intelligence',
  '/settings': 'Settings',
};

export default function AppHeader() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const pageTitle = pageNames[pathname] || 'NEXUS Command';

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>

      <div className={styles.headerRight}>
        {/* Global Search */}
        <div className={styles.searchBox} role="button" tabIndex={0}>
          <Search size={16} className={styles.searchIcon} />
          <span className={styles.searchText}>Search...</span>
          <kbd className={styles.searchKbd}>⌘K</kbd>
        </div>

        {/* Theme Toggle */}
        <button
          className={styles.iconButton}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button className={styles.iconButton} aria-label="Notifications">
          <Bell size={18} />
          <span className={styles.notificationBadge}>3</span>
        </button>

        {/* User Menu */}
        <div className={styles.userMenu}>
          <div className={styles.avatar}>A</div>
          <span className={styles.userName}>Analyst</span>
        </div>
      </div>
    </header>
  );
}
