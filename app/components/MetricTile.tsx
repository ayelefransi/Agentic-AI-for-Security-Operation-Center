import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import GlassPanel from './GlassPanel';
import styles from './MetricTile.module.css';

export type MetricTrend = 'up' | 'down' | 'flat';
export type MetricTrendTone = 'critical' | 'good' | 'neutral';

interface MetricTileProps {
  label: string;
  value: string | number;
  changeText: string;
  trend: MetricTrend;
  trendTone?: MetricTrendTone;
  loading?: boolean;
}

/** KPI summary tile displaying label, tabular value, and period comparison. */
export default function MetricTile({
  label,
  value,
  changeText,
  trend,
  trendTone = 'neutral',
  loading = false,
}: MetricTileProps) {
  if (loading) {
    return (
      <GlassPanel className={styles.tile}>
        <div className={styles.skeletonLabel} />
        <div className={styles.skeletonValue} />
        <div className={styles.skeletonChange} />
      </GlassPanel>
    );
  }

  const toneClass =
    trendTone === 'critical'
      ? styles.toneCritical
      : trendTone === 'good'
        ? styles.toneGood
        : styles.toneNeutral;

  return (
    <GlassPanel className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      <div className={`${styles.change} ${toneClass}`}>
        {trend === 'up' && <TrendingUp size={12} aria-hidden="true" />}
        {trend === 'down' && <TrendingDown size={12} aria-hidden="true" />}
        {trend === 'flat' && <Minus size={12} aria-hidden="true" />}
        <span>{changeText}</span>
      </div>
    </GlassPanel>
  );
}
