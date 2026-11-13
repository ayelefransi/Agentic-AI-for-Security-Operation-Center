"use client";

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Search, Bell, User, Command, X, Shield,
  ArrowRight, Menu, LogOut, Settings,
} from 'lucide-react';
import { fetchIncidents, logout, fetchCurrentUser, type Incident, type AuthUser } from '@/app/lib/api';
import { useSearch } from './AppShell';
import styles from './AppHeader.module.css';

const pageNames: Record<string, string> = {
  '/dashboard': 'Overview',
  '/incidents': 'Incidents',
  '/analyze': 'Investigations',
  '/threat-intel': 'Threat intel',
  '/agents': 'Agents',
  '/settings': 'Settings',
};

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  severity: 'critical' | 'high' | 'info';
  time: string;
  url: string;
  read: boolean;
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function incidentsToNotifications(incidents: Incident[]): NotificationItem[] {
  return incidents.slice(0, 5).map(inc => {
    const sev = inc.triage?.severity?.toLowerCase();
    return {
      id: inc.id,
      title: inc.decision || 'Security incident',
      desc: inc.id.substring(0, 12),
      severity: sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : 'info',
      time: timeAgoShort(inc.created_at),
      url: `/incidents/${inc.id}`,
      read: false,
    };
  });
}

interface AppHeaderProps {
  onOpenMobileNav?: () => void;
}

export default function AppHeader({ onOpenMobileNav }: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('awra-read-notifs') || '[]'));
    } catch { return new Set(); }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  const searchCtx = useSearch();

  useEffect(() => {
    fetchCurrentUser()
      .then(setCurrentUser)
      .catch(() => { });
  }, []);

  // Load real notifications from last 5 incidents
  useEffect(() => {
    fetchIncidents()
      .then(res => {
        const notifs = incidentsToNotifications(res.incidents || []);
        setNotifications(notifs.map(n => ({ ...n, read: readIds.has(n.id) })));
      })
      .catch(() => { });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load incidents for search
  useEffect(() => {
    if (searchOpen) {
      setSelectedIndex(0);
      setTimeout(() => searchInputRef.current?.focus(), 50);
      fetchIncidents()
        .then(res => setLiveIncidents(res.incidents || []))
        .catch(() => { });
    }
  }, [searchOpen]);

  const closeAll = () => {
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(allIds);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try { localStorage.setItem('awra-read-notifs', JSON.stringify([...allIds])); } catch { }
  };

  const pageTitle =
    pageNames[pathname] ||
    (pathname.startsWith('/incidents/') ? 'Incidents' : 'አውራ AI');

  // Search results
  const navItems = [
    { label: 'Overview', path: '/dashboard', category: 'Pages' },
    { label: 'Incidents', path: '/incidents', category: 'Pages' },
    { label: 'Investigations', path: '/analyze', category: 'Pages' },
    { label: 'Threat intel', path: '/threat-intel', category: 'Pages' },
    { label: 'Agents', path: '/agents', category: 'Pages' },
    { label: 'Settings', path: '/settings', category: 'Pages' },
  ];

  const filteredNav = navItems.filter(i =>
    i.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIncidents = liveIncidents.filter(i =>
    (i.id + ' ' + (i.decision || '') + ' ' + (i.raw_alert || ''))
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const allResults = [
    ...filteredNav.map(n => ({
      type: 'nav' as const,
      label: n.label,
      path: n.path,
      sub: n.category,
    })),
    ...filteredIncidents.slice(0, 5).map(inc => ({
      type: 'incident' as const,
      label: inc.decision || 'Security incident',
      path: `/incidents/${inc.id}`,
      sub: `${inc.id.substring(0, 8)} · ${inc.triage?.severity || 'Unknown'}`,
    })),
  ];

  const navigateTo = (path: string) => {
    router.push(path);
    setSearchOpen(false);
    closeAll();
  };

  const handleSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allResults.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (allResults.length || 1)) % (allResults.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) navigateTo(allResults[selectedIndex].path);
    }
  };

  const handleLogout = async () => {
    try { await logout(); } catch { /* ignore */ }
    router.replace('/login');
  };

  return (
    <>
      <header className={styles.header} ref={headerRef}>
        <div className={styles.left}>
          <button
            className={styles.menuBtn}
            onClick={onOpenMobileNav}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className={styles.pageTitle}>{pageTitle}</span>
        </div>

        <div className={styles.right}>
          {/* Live search filter + Cmd K command palette trigger */}
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              value={searchCtx.query}
              onChange={(e) => searchCtx.setQuery(e.target.value)}
              placeholder="Search incidents…"
              aria-label="Filter incidents live"
              className={styles.searchInlineInput}
            />
            {searchCtx.query && (
              <button
                type="button"
                className={styles.searchClear}
                onClick={() => searchCtx.setQuery('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              className={styles.kbdBtn}
              onClick={() => { closeAll(); setSearchOpen(true); }}
              title="Command palette (⌘K)"
              aria-label="Open command palette"
            >
              <kbd className={styles.kbd}><Command size={10} /> K</kbd>
            </button>
          </div>

          {/* Bell */}
          <div className={styles.relative}>
            <button
              className={styles.iconBtn}
              onClick={() => {
                const next = !notificationsOpen;
                closeAll();
                setNotificationsOpen(next);
              }}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span key={unreadCount} className={styles.badge}>{unreadCount}</span>
              )}
            </button>

            {notificationsOpen && (
              <div className={`${styles.dropdown} ${styles.notifDropdown}`}>
                <div className={styles.dropdownHeader}>
                  <span className={styles.dropdownTitle}>Notifications</span>
                  {unreadCount > 0 && (
                    <button className={styles.markRead} onClick={markAllRead}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div className={styles.dropdownBody}>
                  {notifications.length === 0 ? (
                    <div className={styles.emptyState}>No notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`${styles.notifItem} ${!n.read ? styles.notifUnread : ''}`}
                        onClick={() => {
                          const newReadIds = new Set([...readIds, n.id]);
                          setReadIds(newReadIds);
                          try { localStorage.setItem('awra-read-notifs', JSON.stringify([...newReadIds])); } catch { }
                          setNotifications(prev =>
                            prev.map(item => item.id === n.id ? { ...item, read: true } : item)
                          );
                          navigateTo(n.url);
                        }}
                      >
                        <span className={styles.notifDot} data-severity={n.severity} />
                        <div className={styles.notifContent}>
                          <div className={styles.notifTitle}>{n.title}</div>
                          <div className={styles.notifDesc}>{n.desc}</div>
                          <div className={styles.notifTime}>{n.time}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className={styles.relative}>
            <button
              className={styles.userBtn}
              onClick={() => {
                const next = !userMenuOpen;
                closeAll();
                setUserMenuOpen(next);
              }}
              aria-label="User menu"
            >
              <div className={styles.avatar}>
                <User size={15} />
              </div>
            </button>

            {userMenuOpen && (
              <div className={`${styles.dropdown} ${styles.userDropdown}`}>
                <div className={styles.dropdownBody}>
                  {currentUser && (
                    <div className={styles.userInfo}>
                      <div className={styles.userName}>{currentUser.name}</div>
                      <div className={styles.userEmail}>{currentUser.email}</div>
                      <div className={styles.userRole}>{currentUser.role}</div>
                    </div>
                  )}
                  <div className={styles.menuDivider} />
                  <button className={styles.menuItem} onClick={() => navigateTo('/settings')}>
                    <Settings size={14} />
                    Settings
                  </button>
                  <button className={styles.menuItemDanger} onClick={handleLogout}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Command palette */}
      {searchOpen && (
        <div className={styles.paletteOverlay} onClick={() => setSearchOpen(false)}>
          <div className={styles.palette} onClick={e => e.stopPropagation()}>
            <div className={styles.paletteInput}>
              <Search size={18} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages and incidents…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleSearchKey}
                className={styles.paletteField}
              />
              <button className={styles.paletteClose} onClick={() => setSearchOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className={styles.paletteResults}>
              {allResults.length === 0 ? (
                <div className={styles.emptyState}>
                  No results for &quot;{searchQuery}&quot;
                </div>
              ) : (
                allResults.map((item, idx) => (
                  <div
                    key={idx}
                    className={`${styles.resultItem} ${idx === selectedIndex ? styles.resultActive : ''}`}
                    onClick={() => navigateTo(item.path)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {item.type === 'nav' ? (
                      <Search size={14} className={styles.resultIcon} />
                    ) : (
                      <Shield size={14} className={styles.resultIconAlert} />
                    )}
                    <div className={styles.resultText}>
                      <span className={styles.resultLabel}>{item.label}</span>
                      <span className={styles.resultSub}>{item.sub}</span>
                    </div>
                    <ArrowRight size={13} className={styles.resultArrow} />
                  </div>
                ))
              )}
            </div>
            <div className={styles.paletteFooter}>
              <span>↑↓ navigate · Enter open · Esc close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
