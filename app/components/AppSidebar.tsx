"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Shield,
  Activity,
  Search,
  Database,
  Network,
  FileText,
  Settings,
  ChevronRight
} from 'lucide-react';
import styles from './AppSidebar.module.css';

const navGroups = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Command Center', path: '/', icon: LayoutDashboard },
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { name: 'Incidents', path: '/incidents', icon: Shield },
      { name: 'Investigations', path: '/analyze', icon: Search },
      { name: 'Threat Intel', path: '/threat-intel', icon: Database },
    ]
  },
  {
    title: 'ANALYSIS',
    items: [
      { name: 'Agent Monitor', path: '/agents', icon: Activity },
      { name: 'MITRE ATT&CK', path: '/mitre', icon: Network },
      { name: 'Forensics', path: '/forensics', icon: FileText },
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { name: 'Settings', path: '/settings', icon: Settings },
    ]
  }
];

export default function AppSidebar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoSection}>
        <Shield className={styles.logoIcon} size={20} strokeWidth={2} />
        <div className={styles.logoText}>
          <span className={styles.logoTitle}>NEXUS</span>
          <span className={styles.logoSubtitle}>COMMAND</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navGroups.map((group, idx) => (
          <div key={idx} className={styles.navGroup}>
            <div className={styles.navGroupTitle}>{group.title}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`${styles.navItem} ${active ? styles.active : ''}`}
                >
                  <Icon size={18} className={styles.navIcon} />
                  <span className={styles.navLabel}>{item.name}</span>
                  {active && <ChevronRight size={16} className={styles.navChevron} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* System Status */}
      <div className={styles.statusSection}>
        <div className={styles.statusIndicator}>
          <span className={styles.statusDot} />
          <span className={styles.statusText}>Agents Online</span>
        </div>
      </div>
    </aside>
  );
}
