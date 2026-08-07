"use client";

import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';
import styles from './VerdictBadge.module.css';

interface VerdictBadgeProps {
  verdict: string;  // 'True Positive', 'False Positive', 'Needs Investigation', etc.
  severity?: string;
}

export default function VerdictBadge({ verdict, severity = 'Low' }: VerdictBadgeProps) {
  const getSeverityConfig = () => {
    const s = severity?.toLowerCase();
    if (s === 'critical') return { icon: ShieldAlert, cls: styles.critical };
    if (s === 'high') return { icon: AlertTriangle, cls: styles.high };
    if (s === 'medium') return { icon: Shield, cls: styles.medium };
    return { icon: ShieldCheck, cls: styles.low };
  };

  const { icon: Icon, cls } = getSeverityConfig();
  const isCritical = severity?.toLowerCase() === 'critical';

  return (
    <motion.div
      className={`${styles.badge} ${cls}`}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
    >
      {isCritical && <span className={styles.pulseRing} />}
      <Icon size={16} className={styles.icon} />
      <span className={styles.label}>{verdict}</span>
    </motion.div>
  );
}
