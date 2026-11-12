import { redirect } from 'next/navigation';

export default function MitrePage() {
  redirect('/analyze?tab=mitre');
}
