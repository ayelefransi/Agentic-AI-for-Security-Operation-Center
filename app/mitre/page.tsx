"use client";

import { useState, useEffect } from 'react';
import { Hexagon, Layers } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import styles from './page.module.css';

interface HeatmapData {
  [tactic: string]: {
    [technique: string]: number; // count
  }
}

export default function MitreHeatmap() {
  const [data, setData] = useState<HeatmapData>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await fetch('/api/mitre-heatmap');
        if (res.ok) {
          setData(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch heatmap data", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHeatmap();
    const interval = setInterval(fetchHeatmap, 10000);
    return () => clearInterval(interval);
  }, []);

  // Use a fixed set of tactics for consistent ordering
  const coreTactics = [
    "Initial Access",
    "Execution",
    "Persistence",
    "Privilege Escalation",
    "Defense Evasion",
    "Credential Access",
    "Discovery",
    "Lateral Movement",
    "Collection",
    "Command and Control",
    "Exfiltration",
    "Impact"
  ];

  // Merge dynamic tactics that might not be in our core list
  const allTactics = Array.from(new Set([...coreTactics, ...Object.keys(data)]));

  const getHeatColor = (count: number) => {
    if (count === 0) return 'transparent';
    if (count <= 2) return 'var(--color-medium-bg)';
    if (count <= 5) return 'var(--color-high-bg)';
    return 'var(--color-critical-bg)';
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>MITRE ATT&CK Map</h1>
          <p className={styles.subtitle}>Autonomous technique classification across all active incidents</p>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <div className={styles.legendBox} style={{ background: 'var(--glass-bg-hover)' }} /> 0
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendBox} style={{ background: 'var(--color-medium-bg)' }} /> 1-2
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendBox} style={{ background: 'var(--color-high-bg)' }} /> 3-5
          </div>
          <div className={styles.legendItem}>
            <div className={styles.legendBox} style={{ background: 'var(--color-critical-bg)' }} /> 6+
          </div>
        </div>
      </header>

      {loading ? (
        <div className={styles.matrixWrapper}>
          <div className={styles.matrix}>
            {coreTactics.slice(0, 6).map((tactic, i) => (
              <div key={tactic} className={styles.tacticColumn}>
                <div className={styles.tacticHeader}>
                  <Layers size={14} className={styles.tacticIcon} />
                  {tactic}
                </div>
                <div className={styles.techniqueList}>
                  {[1, 2, 3].map(j => (
                    <GlassCard key={j} className={styles.skeletonCell} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : Object.keys(data).length === 0 ? (
        <GlassCard className={styles.emptyState}>
          <div className={styles.emptyIconWrap}>
            <Hexagon size={48} className={styles.emptyIcon} />
          </div>
          <h3>No Data Available</h3>
          <p>The system has not mapped any techniques yet. Ingest alerts to populate this matrix.</p>
        </GlassCard>
      ) : (
        <div className={styles.matrixWrapper}>
          <div className={styles.matrix}>
            {allTactics.map((tactic, idx) => {
              const techniques = data[tactic] || {};
              // Only render columns that have data, or are core tactics
              if (Object.keys(techniques).length === 0 && !coreTactics.includes(tactic)) return null;
              
              return (
                <div key={tactic} className={styles.tacticColumn}>
                  <div className={styles.tacticHeader}>
                    <Layers size={14} className={styles.tacticIcon} />
                    {tactic}
                  </div>
                  <div className={styles.techniqueList}>
                    {Object.entries(techniques)
                      .sort((a, b) => b[1] - a[1]) // sort by count descending
                      .map(([techName, count], idx2) => (
                        <GlassCard 
                          key={techName} 
                          delay={idx * 0.05 + idx2 * 0.05}
                          className={styles.techniqueCell}
                          hoverEffect
                        >
                          <div 
                            className={styles.heatBg} 
                            style={{ background: getHeatColor(count) }} 
                          />
                          <div className={styles.techContent}>
                            <span className={styles.techName}>{techName}</span>
                            <span className={styles.techCount}>{count}</span>
                          </div>
                        </GlassCard>
                      ))}
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
