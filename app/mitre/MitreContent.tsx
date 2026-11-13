"use client";

import { useState, useEffect } from 'react';
import { Hexagon, Layers, RefreshCw } from 'lucide-react';
import { fetchMitreHeatmap, MitreHeatmapTechnique } from '@/app/lib/api';
import styles from './page.module.css';

interface HeatmapData {
  [tactic: string]: MitreHeatmapTechnique[];
}

export default function MitreContent() {
  const [data, setData] = useState<HeatmapData>({});
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const heatmap = await fetchMitreHeatmap();
      const byTactic: HeatmapData = {};
      for (const tech of heatmap?.techniques || []) {
        const tactic = tech.tactic || 'Unknown';
        (byTactic[tactic] ||= []).push(tech);
      }
      setData(byTactic);
    } catch (error) {
      console.error("Failed to fetch heatmap data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const coreTactics = [
    "Initial Access", "Execution", "Persistence", "Privilege Escalation",
    "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
    "Collection", "Command and Control", "Exfiltration", "Impact"
  ];

  const allTactics = Array.from(new Set([...coreTactics, ...Object.keys(data)]));

  const getHeatColor = (count: number) => {
    if (count === 0) return 'transparent';
    if (count <= 2) return 'rgba(45, 212, 191, 0.15)';
    if (count <= 5) return 'rgba(255, 159, 67, 0.2)';
    return 'rgba(255, 92, 108, 0.25)';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>MITRE ATT&CK matrix</h1>
          <p className={styles.subtitle}>Technique classification across all active incidents</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <div className={styles.legendBox} style={{ background: 'rgba(255,255,255,0.05)' }} /> 0
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendBox} style={{ background: 'rgba(45, 212, 191, 0.25)' }} /> 1–2
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendBox} style={{ background: 'rgba(255, 159, 67, 0.35)' }} /> 3–5
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendBox} style={{ background: 'rgba(255, 92, 108, 0.4)' }} /> 6+
            </div>
          </div>
          <button className={styles.refreshBtn} onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spin : ''} />
          </button>
        </div>
      </header>

      {loading && Object.keys(data).length === 0 ? (
        <div className={styles.matrixWrapper} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={28} className={styles.spin} style={{ color: 'var(--accent)' }} />
        </div>
      ) : Object.keys(data).length === 0 ? (
        <div className={styles.emptyState}>
          <Hexagon size={48} className={styles.emptyIcon} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No matrix data yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '340px' }}>
            Ingest alerts in the investigation studio to populate the matrix.
          </p>
        </div>
      ) : (
        <div className={styles.matrixWrapper}>
          <div className={styles.matrix}>
            {allTactics.map((tactic) => {
              const techniques = data[tactic] || [];
              if (techniques.length === 0 && !coreTactics.includes(tactic)) return null;

              return (
                <div key={tactic} className={styles.tacticColumn}>
                  <div className={styles.tacticHeader}>
                    <Layers size={13} className={styles.tacticIcon} />
                    <span>{tactic}</span>
                  </div>
                  <div className={styles.techniqueList}>
                    {[...techniques]
                      .sort((a, b) => b.count - a.count)
                      .map((tech) => (
                        <div key={tech.technique_id} className={styles.techniqueCell} title={`${tech.technique_id} · max confidence ${Math.round(tech.max_confidence * 100)}%`}>
                          <div className={styles.heatBg} style={{ background: getHeatColor(tech.count) }} />
                          <div className={styles.techContent}>
                            <span className={styles.techName}>{tech.technique_id} {tech.technique_name}</span>
                            <span className={styles.techCount}>{tech.count}</span>
                          </div>
                        </div>
                      ))}
                    {techniques.length === 0 && (
                      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                        No observed techniques
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

