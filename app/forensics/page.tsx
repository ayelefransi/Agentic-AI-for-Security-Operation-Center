import { redirect } from 'next/navigation';

export default function ForensicsPage() {
  redirect('/analyze?tab=forensics');
}
