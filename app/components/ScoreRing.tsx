"use client";

import { motion } from 'framer-motion';
import styles from './ScoreRing.module.css';

interface ScoreRingProps {
  score: number;     // 0–100
  size?: number;     // px, default 80
  strokeWidth?: number;
  severity?: 'Low' | 'Medium' | 'High' | 'Critical' | string;
}

export default function ScoreRing({ score, size = 80, strokeWidth = 6, severity = 'Low' }: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'var(--color-critical)';
      case 'high': return 'var(--color-high)';
      case 'medium': return 'var(--color-medium)';
      default: return 'var(--accent-primary)';
    }
  };

  const color = getColor();

  return (
    <div className={styles.container} style={{ width: size, height: size }}>
      <svg width={size} height={size} className={styles.svg}>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--glass-border)"
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>
      <div className={styles.label}>
        <span className={styles.score} style={{ color }}>{score}</span>
        <span className={styles.total}>/100</span>
      </div>
    </div>
  );
}
