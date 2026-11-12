"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, ChevronRight, Terminal, Database, HardDrive, RefreshCw
} from 'lucide-react';
import SeverityBadge from '@/app/components/SeverityBadge';
import { fetchIncidents } from '@/app/lib/api';
import styles from './page.module.css';

export default function ForensicsContent() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchIncidents();
      const list = res.incidents || [];
      setIncidents(list);
      if (list.length > 0) setSelectedIncident(list[0]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Digital forensics</h1>
          <p className={styles.subtitle}>
            Raw telemetry reconstruction and attack timeline analysis
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? styles.spin : ''} /> Refresh
        </button>
      </div>

      {incidents.length === 0 && !loading ? (
        <div className={styles.emptyCard}>
          <Shield size={48} style={{ opacity: 0.3, color: 'var(--accent)' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            No forensic artifacts yet
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '420px' }}>
            Submit an alert in the investigation studio to generate forensic artifacts.
          </p>
          <button
            className={styles.launchBtn}
            onClick={() => router.push('/analyze')}
          >
            Launch investigation
          </button>
        </div>
      ) : (
        <div className={styles.mainGrid}>
          <div className={styles.sessionListCard}>
            <div className={styles.sessionListTitle}>
              <HardDrive size={16} style={{ color: 'var(--accent)' }} />
              <span>Sessions ({incidents.length})</span>
            </div>
            <div className={styles.sessionList}>
              {incidents.map((inc) => {
                const isSelected = selectedIncident?.id === inc.id;
                return (
                  <div
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    className={`${styles.sessionItem} ${isSelected ? styles.sessionItemActive : ''}`}
                  >
                    <div className={styles.sessionItemHeader}>
                      <span className={styles.sessionItemId}>#{inc.id?.substring(0, 8)}</span>
                      <SeverityBadge severity={inc.triage?.severity || 'Low'} />
                    </div>
                    <div className={styles.sessionItemTitle}>
                      {inc.decision || 'Investigation'}
                    </div>
                    <div className={styles.sessionItemDate}>
                      {new Date(inc.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedIncident && (
            <div className={styles.detailContainer}>
              <div className={styles.detailCard}>
                <div className={styles.detailHeader}>
                  <div>
                    <span className={styles.targetSubtitle}>Forensic target</span>
                    <h2 className={styles.targetTitle}>
                      {selectedIncident.decision || 'Security incident'}
                    </h2>
                  </div>
                  <button
                    className={styles.viewDossierBtn}
                    onClick={() => router.push(`/incidents/${selectedIncident.id}`)}
                  >
                    View dossier <ChevronRight size={14} />
                  </button>
                </div>

                <div>
                  <div className={styles.logSectionHeader}>
                    <Terminal size={14} style={{ color: 'var(--accent)' }} />
                    <span>Raw forensic log</span>
                  </div>
                  <pre className={styles.logBox}>
                    {selectedIncident.raw_alert || selectedIncident.events?.[0]?.raw_log || 'No raw log recorded.'}
                  </pre>
                </div>

                {selectedIncident.events && selectedIncident.events.length > 0 && (
                  <div>
                    <div className={styles.logSectionHeader}>
                      <Database size={14} style={{ color: 'var(--accent)' }} />
                      <span>Normalized event attributes</span>
                    </div>
                    <div className={styles.attrGrid}>
                      {selectedIncident.events[0].src_ip && (
                        <div className={styles.attrCard}>
                          <div className={styles.attrLabel}>Source IP</div>
                          <div className={styles.attrValue}>{selectedIncident.events[0].src_ip}</div>
                        </div>
                      )}
                      {selectedIncident.events[0].dst_ip && (
                        <div className={styles.attrCard}>
                          <div className={styles.attrLabel}>Destination IP</div>
                          <div className={styles.attrValue}>{selectedIncident.events[0].dst_ip}</div>
                        </div>
                      )}
                      {selectedIncident.events[0].hostname && (
                        <div className={styles.attrCard}>
                          <div className={styles.attrLabel}>Hostname</div>
                          <div className={styles.attrValue}>{selectedIncident.events[0].hostname}</div>
                        </div>
                      )}
                      {selectedIncident.events[0].user && (
                        <div className={styles.attrCard}>
                          <div className={styles.attrLabel}>Account</div>
                          <div className={styles.attrValue}>{String(selectedIncident.events[0].user)}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

