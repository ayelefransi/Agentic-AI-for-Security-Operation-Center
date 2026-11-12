import type { ReactNode } from 'react';
import styles from './GlassPanel.module.css';

interface GlassPanelProps {
  children: ReactNode;
  dense?: boolean;
  className?: string;
}

/** Shared glassmorphism container matching Restrained Glassmorphism tokens. */
export default function GlassPanel({
  children,
  dense = false,
  className = '',
}: GlassPanelProps) {
  return (
    <div
      className={`${styles.panel} ${dense ? styles.dense : ''} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
