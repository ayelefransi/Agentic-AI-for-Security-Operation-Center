"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, LayoutDashboard, Search, List, Activity, Settings, Hexagon } from 'lucide-react';
import styles from './Sidebar.module.css';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Analyze', path: '/analyze', icon: Search },
    { name: 'Incidents', path: '/incidents', icon: List },
    { name: 'MITRE Map', path: '/mitre', icon: Hexagon },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <Shield className={styles.logoIcon} />
        <span className={styles.logoText}>NEXUS</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link key={item.path} href={item.path} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicator"
                  className={styles.activeIndicator}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              )}
              <Icon className={styles.icon} size={20} />
              <span className={styles.label}>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.systemStatus}>
        <div className={styles.statusHeader}>
          <Activity size={16} /> System Status
        </div>
        <div className={styles.statusIndicator}>
          <div className={styles.statusDot} />
          <span>Agents Online</span>
        </div>
      </div>
    </aside>
  );
}
