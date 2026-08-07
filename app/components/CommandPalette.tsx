"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, Search as AnalyzeIcon, List, Hexagon, Settings, ShieldAlert } from 'lucide-react';
import styles from './CommandPalette.module.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
    }
  }, [open]);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, keywords: ['home', 'start', 'overview'] },
    { name: 'Analyze New Alert', path: '/analyze', icon: AnalyzeIcon, keywords: ['triage', 'new', 'scan'] },
    { name: 'View Incidents', path: '/incidents', icon: List, keywords: ['history', 'list', 'all'] },
    { name: 'MITRE ATT&CK Map', path: '/mitre', icon: Hexagon, keywords: ['tactics', 'techniques', 'heatmap'] },
    { name: 'Settings', path: '/settings', icon: Settings, keywords: ['config', 'api', 'keys', 'theme', 'dark mode'] },
  ];

  // Quick incident lookup simulation
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  
  useEffect(() => {
    if (open && recentIncidents.length === 0) {
      fetch('/api/incidents').then(r => r.json()).then(data => {
        if (data.incidents) setRecentIncidents(data.incidents.slice(0, 3));
      }).catch(e => console.error(e));
    }
  }, [open]);

  const filteredNav = navItems.filter(item => {
    const q = query.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.keywords.some(k => k.includes(q));
  });

  const filteredIncidents = recentIncidents.filter(inc => {
    const q = query.toLowerCase();
    return inc.id.toLowerCase().includes(q) || (inc.decision || '').toLowerCase().includes(q);
  });

  const handleSelect = (path: string) => {
    router.push(path);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className={styles.overlay} onClick={onClose}>
          <motion.div 
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.searchHeader}>
              <Search size={20} className={styles.searchIcon} />
              <input
                ref={inputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search pages, incidents, or commands..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <span className={styles.escHint}>ESC</span>
            </div>

            <div className={styles.results}>
              {filteredNav.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Navigation</div>
                  {filteredNav.map(item => (
                    <button 
                      key={item.path} 
                      className={styles.resultItem}
                      onClick={() => handleSelect(item.path)}
                    >
                      <item.icon size={16} className={styles.itemIcon} />
                      {item.name}
                    </button>
                  ))}
                </div>
              )}

              {filteredIncidents.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionTitle}>Recent Incidents</div>
                  {filteredIncidents.map(inc => (
                    <button 
                      key={inc.id} 
                      className={styles.resultItem}
                      onClick={() => handleSelect(`/incidents/${inc.id}`)}
                    >
                      <ShieldAlert size={16} className={styles.itemIcon} style={{ color: 'var(--color-critical)' }} />
                      <div className={styles.incidentInfo}>
                        <span className={styles.incidentVerdict}>{inc.decision || 'Pending'}</span>
                        <span className={styles.incidentId}>#{inc.id.substring(0,8)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {filteredNav.length === 0 && filteredIncidents.length === 0 && (
                <div className={styles.noResults}>
                  No results found for "{query}"
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
