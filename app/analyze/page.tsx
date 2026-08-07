"use client";

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Terminal, Loader2, ShieldAlert } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import SeverityBadge from '../components/SeverityBadge';
import styles from './page.module.css';

export default function AnalyzePage() {
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyzeAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert.trim()) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/analyze-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert })
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      setResult({ error: "Failed to analyze alert. Check console for details." });
    } finally {
      setLoading(false);
    }
  };

  const sampleAlert = `Event: Network Intrusion
Source IP: 198.51.100.22
Destination: 10.0.0.5
Description: Multiple failed SSH login attempts followed by a successful login. Potential brute force attack.`;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Analyze Alert</h1>
        <p className={styles.subtitle}>Paste raw security telemetry, syslogs, or alerts for autonomous AI triage.</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.inputSection}>
          <GlassCard className={styles.inputCard}>
            <form onSubmit={analyzeAlert} className={styles.form}>
              <div className={styles.labelWrapper}>
                <label><Terminal size={16}/> Raw Alert Data</label>
                <button 
                  type="button" 
                  className={styles.mockButton}
                  onClick={() => setAlert(sampleAlert)}
                >
                  Load Sample
                </button>
              </div>
              <textarea
                className={styles.textarea}
                value={alert}
                onChange={(e) => setAlert(e.target.value)}
                placeholder="Paste JSON, Syslog, or raw text here..."
                rows={12}
              />
              <button 
                type="submit" 
                className={styles.submitButton}
                disabled={loading || !alert.trim()}
              >
                {loading ? <Loader2 className={styles.spin} /> : <Send size={18} />}
                {loading ? 'Analyzing...' : 'Analyze Alert'}
              </button>
            </form>
          </GlassCard>
        </div>

        <div className={styles.outputSection}>
          {loading ? (
            <GlassCard className={styles.loadingCard}>
              <div className={styles.scannerLine} />
              <div className={styles.loadingContent}>
                <Loader2 size={40} className={styles.spinIcon} />
                <h3>Agents are investigating...</h3>
                <p>Ingesting, enriching, correlating, and deciding.</p>
              </div>
            </GlassCard>
          ) : result ? (
            <GlassCard className={styles.resultCard}>
              {result.error ? (
                <div className={styles.error}>
                  <ShieldAlert size={32} />
                  <h3>Analysis Failed</h3>
                  <p>{result.error}</p>
                </div>
              ) : (
                <>
                  <div className={styles.resultHeader}>
                    <h2>Investigation Complete</h2>
                    <SeverityBadge severity={result.structured_json?.decision === "True Positive" ? "Critical" : "Low"} />
                  </div>
                  <div className={styles.markdownWrapper}>
                    <ReactMarkdown>{result.report}</ReactMarkdown>
                  </div>
                </>
              )}
            </GlassCard>
          ) : (
            <GlassCard className={styles.placeholderCard}>
              <ShieldAlert size={48} className={styles.placeholderIcon} />
              <h3>Awaiting Input</h3>
              <p>Submit an alert on the left to begin the investigation.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
