"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard, Shield, Search, Database,
  Activity, Settings, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import styles from './AppSidebar.module.css';

interface AppSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const navItems = [
  { name: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Incidents', path: '/incidents', icon: Shield },
  { name: 'Investigations', path: '/analyze', icon: Search },
  { name: 'Threat intel', path: '/threat-intel', icon: Database },
  { name: 'Agents', path: '/agents', icon: Activity },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export default function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  return (
    <>
      {mobileOpen && (
        <div className={styles.mobileBackdrop} onClick={onCloseMobile} />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${
          mobileOpen ? styles.mobileOpen : ''
        }`}
      >
        {/* Logo */}
        <div className={styles.logoSection}>
          <Link href="/dashboard" className={styles.logoBrand}>
            <div className={styles.logoIcon}>
              <Shield size={18} strokeWidth={2.5} />
            </div>
            {!collapsed && <span className={styles.logoText}>አውራ AI</span>}
          </Link>

          {mobileOpen && (
            <button onClick={onCloseMobile} className={styles.collapseBtn} aria-label="Close navigation">
              <X size={18} />
            </button>
          )}

          {onToggleCollapse && !mobileOpen && (
            <button
              onClick={onToggleCollapse}
              className={styles.collapseBtn}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          )}
        </div>

        {/* Navigation — 6 items, no group titles */}
        <nav className={styles.nav}>
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={onCloseMobile}
                className={`${styles.navItem} ${active ? styles.active : ''}`}
                aria-current={active ? 'page' : undefined}
                aria-label={collapsed ? item.name : undefined}
                title={collapsed ? item.name : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className={styles.activeIndicator}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
                <Icon size={18} className={styles.navIcon} strokeWidth={1.8} />
                {!collapsed && <span className={styles.navLabel}>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
