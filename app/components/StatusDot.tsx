import styles from './StatusDot.module.css';

export type StatusDotTone =
  | 'online'
  | 'offline'
  | 'warning'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'neutral';

interface StatusDotProps {
  status: StatusDotTone;
  size?: 'sm' | 'md';
  label?: string;
}

const toneClass: Record<StatusDotTone, string> = {
  online: styles.online,
  offline: styles.offline,
  warning: styles.warning,
  critical: styles.critical,
  high: styles.high,
  medium: styles.medium,
  low: styles.low,
  neutral: styles.neutral,
};

/** Accessible colored indicator dot for agent health and incident status. */
export default function StatusDot({
  status,
  size = 'md',
  label,
}: StatusDotProps) {
  return (
    <span
      className={`${styles.dot} ${size === 'sm' ? styles.sm : styles.md} ${toneClass[status]}`}
      aria-label={label}
      role={label ? 'img' : undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
