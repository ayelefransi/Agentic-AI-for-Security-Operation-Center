"use client";

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';
import styles from './ThinkingSteps.module.css';

interface ThinkingStepsProps {
  currentStep: number; // -1 = not started, 0–4 = in progress, 5 = done
}

const steps = [
  'Parsing telemetry',
  'Enriching entities',
  'Cross-referencing MITRE ATT&CK',
  'Scoring risk',
  'Generating verdict',
];

export default function ThinkingSteps({ currentStep }: ThinkingStepsProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Loader2 size={16} className={styles.headerIcon} />
        <span>AI Investigation Pipeline</span>
      </div>
      <div className={styles.stepList}>
        {steps.map((step, i) => {
          let status: 'pending' | 'active' | 'done';
          if (i < currentStep) status = 'done';
          else if (i === currentStep) status = 'active';
          else status = 'pending';

          return (
            <motion.div
              key={step}
              className={`${styles.step} ${styles[status]}`}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={styles.stepIcon}>
                {status === 'done' ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <CheckCircle2 size={16} />
                  </motion.div>
                ) : status === 'active' ? (
                  <Loader2 size={16} className={styles.spinning} />
                ) : (
                  <Circle size={16} />
                )}
              </div>
              <span className={styles.stepLabel}>{step}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
