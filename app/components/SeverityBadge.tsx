interface SeverityBadgeProps {
  severity: string;
}

const severityStyles: Record<string, string> = {
  Critical: 'badge-critical',
  High: 'badge-high',
  Medium: 'badge-medium',
  Low: 'badge-low',
};

export default function SeverityBadge({ severity }: SeverityBadgeProps) {
  const normalizedSeverity = severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
  const className = severityStyles[normalizedSeverity] || 'badge-info';

  return <span className={`badge ${className}`}>{normalizedSeverity}</span>;
}
