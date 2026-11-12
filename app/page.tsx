"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Eye, Search, Zap, ArrowRight } from 'lucide-react';
import { fetchCurrentUser } from '@/app/lib/api';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Signed-in users go straight to the dashboard
  useEffect(() => {
    fetchCurrentUser()
      .then(() => router.replace('/dashboard'))
      .catch(() => setReady(true));
  }, [router]);

  if (!ready) return null;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <Shield size={22} />
          </div>
          <span className={styles.logoText}>አውራ AI</span>
        </div>

        <h1 className={styles.headline}>Autonomous threat intelligence</h1>
        <p className={styles.description}>
          Multi-agent AI that triages security incidents, maps MITRE ATT&amp;CK
          techniques, and delivers actionable verdicts in seconds.
        </p>

        <Link href="/login" className={styles.signInBtn}>
          Sign in
          <ArrowRight size={16} />
        </Link>

        <div className={styles.capabilities}>
          <div className={styles.capability}>
            <div className={styles.capIcon}><Eye size={16} /></div>
            <div>
              <div className={styles.capTitle}>Detect threats in real time</div>
              <div className={styles.capDesc}>
                Behavioral anomaly detection across endpoints and network traffic
              </div>
            </div>
          </div>

          <div className={styles.capability}>
            <div className={styles.capIcon}><Search size={16} /></div>
            <div>
              <div className={styles.capTitle}>Automated investigation</div>
              <div className={styles.capDesc}>
                Six specialized agents coordinate enrichment, correlation, and triage
              </div>
            </div>
          </div>

          <div className={styles.capability}>
            <div className={styles.capIcon}><Zap size={16} /></div>
            <div>
              <div className={styles.capTitle}>Instant response playbooks</div>
              <div className={styles.capDesc}>
                Risk-scored remediation actions with full reasoning transparency
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
