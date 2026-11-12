import { redirect } from 'next/navigation';

export default function AuditPage() {
  redirect('/settings?tab=audit');
}
