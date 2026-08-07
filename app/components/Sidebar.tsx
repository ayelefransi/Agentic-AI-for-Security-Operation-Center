"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, Search, List, Hexagon, Settings,
  Activity, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Analyze', path: '/analyze', icon: Search },
    { name: 'Incidents', path: '/incidents', icon: List },
    { name: 'MITRE Map', path: '/mitre', icon: Hexagon },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logoContainer}>
        <Shield className={styles.logoIcon} size={24} />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className={styles.logoText}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
            >
              NEXUS
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              title={collapsed ? item.name : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicator"
                  className={styles.activeIndicator}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={styles.iconWrap}
              >
                <Icon size={20} />
              </motion.div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className={styles.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* System Status */}
      <div className={styles.systemStatus}>
        <div className={styles.statusIndicator}>
          <div className={styles.statusDot} />
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                className={styles.statusInfo}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <span className={styles.statusLabel}>System Status</span>
                <span className={styles.statusText}>Agents Online</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        className={styles.collapseToggle}
        onClick={onToggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
    </aside>
  );
}
