import { ShieldAlert, ShieldCheck, Shield, AlertTriangle } from 'lucide-react';
import styles from './SeverityBadge.module.css';

type Severity = 'Low' | 'Medium' | 'High' | 'Critical';

export default function SeverityBadge({ severity }: { severity: Severity | string }) {
  const getSeverityConfig = () => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return { icon: ShieldAlert, className: styles.critical };
      case 'high':
        return { icon: AlertTriangle, className: styles.high };
      case 'medium':
        return { icon: Shield, className: styles.medium };
      case 'low':
      default:
        return { icon: ShieldCheck, className: styles.low };
    }
  };

  const { icon: Icon, className } = getSeverityConfig();

  return (
    <span className={`${styles.badge} ${className}`}>
      <Icon size={14} className={styles.icon} />
      {severity}
    </span>
  );
}
