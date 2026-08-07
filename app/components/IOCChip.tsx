import { Globe, Hash, Link as LinkIcon, Mail, MonitorSmartphone } from 'lucide-react';
import styles from './IOCChip.module.css';

interface IOCChipProps {
  type: string;
  value: string;
  verdict?: string; // 'malicious' | 'suspicious' | 'benign' | 'unknown'
}

export default function IOCChip({ type, value, verdict = 'unknown' }: IOCChipProps) {
  const getIcon = () => {
    switch (type.toLowerCase()) {
      case 'ip': return MonitorSmartphone;
      case 'domain': return Globe;
      case 'hash': return Hash;
      case 'url': return LinkIcon;
      case 'email': return Mail;
      default: return Hash;
    }
  };

  const Icon = getIcon();

  const getVerdictClass = () => {
    switch (verdict.toLowerCase()) {
      case 'malicious': return styles.malicious;
      case 'suspicious': return styles.suspicious;
      case 'benign': return styles.benign;
      default: return styles.unknown;
    }
  };

  return (
    <div className={`${styles.chip} ${getVerdictClass()}`} title={value}>
      <Icon size={12} className={styles.icon} />
      <span className={styles.value}>{value}</span>
    </div>
  );
}
