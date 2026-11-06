import React from 'react';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  loading?: boolean;
}

export default function MetricCard({ title, value, icon, trend, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className={styles.card}>
        <div className={styles.skeleton}></div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {icon && <div className={styles.icon}>{icon}</div>}
      </div>
      <div className={styles.value}>{value}</div>
      {trend && (
        <div className={`${styles.trend} ${styles[trend.direction]}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}
