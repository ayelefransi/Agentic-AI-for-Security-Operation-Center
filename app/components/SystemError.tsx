"use client";

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertOctagon, RefreshCcw, Settings } from 'lucide-react';
import styles from './SystemError.module.css';

interface SystemErrorProps {
  message: string;
  detail?: string;
  onRetry?: () => void;
}

export default function SystemError({ message, detail, onRetry }: SystemErrorProps) {
  const router = useRouter();

  // Try to generate a human-readable message from common errors
  const getHumanMessage = (msg: string) => {
    if (msg.includes('401') || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('invalid')) {
      return 'AI analysis engine unavailable — check your API key in Settings.';
    }
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      return 'Could not connect to the analysis engine. The backend may be down.';
    }
    if (msg.includes('500')) {
      return 'The analysis engine encountered an internal error. Please try again.';
    }
    return msg;
  };

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.iconWrap}>
        <AlertOctagon size={32} />
      </div>
      <h3 className={styles.title}>System Error</h3>
      <p className={styles.message}>{getHumanMessage(message)}</p>
      {detail && (
        <pre className={styles.detail}>{detail}</pre>
      )}
      <div className={styles.actions}>
        {onRetry && (
          <button className={styles.retryButton} onClick={onRetry}>
            <RefreshCcw size={16} />
            Retry Analysis
          </button>
        )}
        <button className={styles.settingsButton} onClick={() => router.push('/settings')}>
          <Settings size={16} />
          Check Settings
        </button>
      </div>
    </motion.div>
  );
}
