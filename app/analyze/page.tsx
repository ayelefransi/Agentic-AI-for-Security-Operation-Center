"use client";

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Send, Hexagon, FileText } from 'lucide-react';
import { Suspense } from 'react';
import styles from './investigations.module.css';

const AnalyzeContent = dynamic(() => import('./AnalyzeContent'), {
  loading: () => <div className={styles.loadingFallback}>Loading…</div>,
});
const MitreContent = dynamic(() => import('../mitre/MitreContent'), {
  loading: () => <div className={styles.loadingFallback}>Loading…</div>,
});
const ForensicsContent = dynamic(() => import('../forensics/ForensicsContent'), {
  loading: () => <div className={styles.loadingFallback}>Loading…</div>,
});

type InvestigationsTab = 'analyze' | 'mitre' | 'forensics';

function InvestigationsInner() {
  const searchParams = useSearchParams();
  const initialTab = (['mitre', 'forensics'].includes(searchParams.get('tab') || '')
    ? searchParams.get('tab') as InvestigationsTab
    : 'analyze');
  const [activeTab, setActiveTab] = useState<InvestigationsTab>(initialTab);

  return (
    <>
      <div className={styles.tabBar}>
        <button
          className={activeTab === 'analyze' ? styles.tabBtnActive : styles.tabBtn}
          onClick={() => setActiveTab('analyze')}
        >
          <Send size={14} />
          Investigations
        </button>
        <button
          className={activeTab === 'mitre' ? styles.tabBtnActive : styles.tabBtn}
          onClick={() => setActiveTab('mitre')}
        >
          <Hexagon size={14} />
          MITRE ATT&CK
        </button>
        <button
          className={activeTab === 'forensics' ? styles.tabBtnActive : styles.tabBtn}
          onClick={() => setActiveTab('forensics')}
        >
          <FileText size={14} />
          Forensics
        </button>
      </div>

      {activeTab === 'analyze' && <AnalyzeContent />}
      {activeTab === 'mitre' && <MitreContent />}
      {activeTab === 'forensics' && <ForensicsContent />}
    </>
  );
}

export default function InvestigationsPage() {
  return (
    <Suspense fallback={<div className={styles.loadingFallback}>Loading…</div>}>
      <InvestigationsInner />
    </Suspense>
  );
}
