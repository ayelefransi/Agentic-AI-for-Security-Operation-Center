"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
  Send, Terminal, Loader2, ShieldAlert, Upload, CheckCircle2,
  XCircle, Copy, AlertTriangle, ExternalLink, ChevronDown
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import VerdictBadge from '../components/VerdictBadge';
import ScoreRing from '../components/ScoreRing';
import ThinkingSteps from '../components/ThinkingSteps';
import SystemError from '../components/SystemError';
import SeverityBadge from '../components/SeverityBadge';
import IOCChip from '../components/IOCChip';
import styles from './page.module.css';

// Dynamic import Monaco to avoid SSR
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const sampleAlerts: Record<string, string> = {
  'Brute Force': `Event: Network Intrusion
Source IP: 198.51.100.22
Destination: 10.0.0.5
Description: Multiple failed SSH login attempts followed by a successful login. Potential brute force attack.`,
  'Email Threat': `Event: Phishing Email Detected
From: hr-notification@evil-corp.xyz
To: john.doe@company.com
Subject: Urgent: Update Your Credentials Now
Attachment: credentials_form.html
Description: Suspicious email with credential harvesting link. SPF fail, DKIM mismatch.`,
  'Malware': `Event: Endpoint Alert
Hostname: WKS-FINANCE-042
Process: powershell.exe
Hash: d41d8cd98f00b204e9800998ecf8427e
Description: Encoded PowerShell command downloading payload from http://malware-c2.example.com/beacon.exe`,
  'Insider Risk': `Event: Data Exfiltration Attempt
User: jsmith@corp.internal
Action: USB mass storage connected, 2.4GB copied
Files: customer_database_export.csv, financial_q4_report.xlsx
Source: FINANCE-SERVER-01
Description: After-hours data copy to removable media by user with pending termination.`,
};

export default function AnalyzePage() {
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [thinkingStep, setThinkingStep] = useState(-1);
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // JSON validation
  useEffect(() => {
    if (!alert.trim()) {
      setJsonValid(null);
      return;
    }
    try {
      JSON.parse(alert);
      setJsonValid(true);
    } catch {
      setJsonValid(false); // Not JSON — that's ok, we accept raw text too
    }
  }, [alert]);

  // Simulated thinking steps during analysis
  const runThinkingSteps = useCallback(() => {
    setThinkingStep(0);
    const steps = [0, 1, 2, 3, 4];
    steps.forEach((step, i) => {
      setTimeout(() => setThinkingStep(step + 1), (i + 1) * 800);
    });
  }, []);

  const analyzeAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert.trim()) return;

    setLoading(true);
    setResult(null);
    runThinkingSteps();

    try {
      const res = await fetch('/api/analyze-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ error: data.detail || `Server error (${res.status})` });
      } else {
        setResult(data);
      }
    } catch (error: any) {
      setResult({ error: error.message || 'Failed to analyze alert.' });
    } finally {
      setThinkingStep(5);
      setTimeout(() => setLoading(false), 600);
    }
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setAlert(text);
      };
      reader.readAsText(file);
    }
  };

  const handleCopyReport = () => {
    if (result?.report) {
      navigator.clipboard.writeText(result.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const charCount = alert.length;
  const lineCount = alert ? alert.split('\n').length : 0;

  // Determine severity from result
  const getSeverity = () => {
    if (!result?.structured_json) return 'Low';
    const decision = result.structured_json.decision || '';
    if (decision.includes('True Positive') || decision.includes('Critical')) return 'Critical';
    if (decision.includes('High')) return 'High';
    if (decision.includes('Suspicious')) return 'Medium';
    return 'Low';
  };

  const getScore = () => {
    if (!result?.structured_json) return 0;
    return result.structured_json.score || result.structured_json.triage_score || 50;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analyze Alert</h1>
          <p className={styles.subtitle}>
            Paste raw security telemetry, syslogs, or alerts for autonomous AI triage.
          </p>
        </div>
      </header>

      <div className={styles.panelWrapper}>
        <PanelGroup orientation="horizontal" className={styles.panelGroup}>
          {/* ── Left Panel: Raw Alert Data ──────────────────────────────── */}
          <Panel defaultSize={40} minSize={25} className={styles.panel}>
            <GlassCard className={styles.inputCard}>
              <form onSubmit={analyzeAlert} className={styles.form}>
                <div className={styles.labelWrapper}>
                  <label className={styles.fieldLabel}>
                    <Terminal size={14} /> Raw Alert Data
                  </label>
                  <div className={styles.labelActions}>
                    {/* JSON validation indicator */}
                    {jsonValid !== null && (
                      <span className={`${styles.validIndicator} ${jsonValid ? styles.valid : styles.textOnly}`}>
                        {jsonValid ? <CheckCircle2 size={13} /> : null}
                        {jsonValid ? 'Valid JSON' : 'Raw text'}
                      </span>
                    )}
                    {/* Sample dropdown */}
                    <div className={styles.sampleDropdown}>
                      <button
                        type="button"
                        className={styles.sampleButton}
                        onClick={() => setSampleDropdownOpen(!sampleDropdownOpen)}
                      >
                        Load Sample <ChevronDown size={14} />
                      </button>
                      <AnimatePresence>
                        {sampleDropdownOpen && (
                          <motion.div
                            className={styles.dropdownMenu}
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                          >
                            {Object.entries(sampleAlerts).map(([name, value]) => (
                              <button
                                key={name}
                                type="button"
                                className={styles.dropdownItem}
                                onClick={() => {
                                  setAlert(value);
                                  setSampleDropdownOpen(false);
                                }}
                              >
                                {name}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                {/* Monaco Editor / Drag zone */}
                <div
                  ref={dropRef}
                  className={`${styles.editorContainer} ${isDragging ? styles.dragOver : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  {isDragging && (
                    <div className={styles.dragOverlay}>
                      <Upload size={32} />
                      <span>Drop .json, .log, or .csv file</span>
                    </div>
                  )}
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="json"
                    value={alert}
                    onChange={(v) => setAlert(v || '')}
                    theme="vs-light"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'var(--font-mono), JetBrains Mono, Consolas, monospace',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      renderLineHighlight: 'none',
                      padding: { top: 12, bottom: 12 },
                      overviewRulerLanes: 0,
                      hideCursorInOverviewRuler: true,
                      overviewRulerBorder: false,
                      scrollbar: {
                        verticalScrollbarSize: 6,
                        horizontalScrollbarSize: 6,
                      },
                      roundedSelection: true,
                      contextmenu: false,
                      tabSize: 2,
                    }}
                  />
                </div>

                {/* Footer: char count + submit */}
                <div className={styles.editorFooter}>
                  <span className={styles.charCount}>
                    {lineCount} lines · {charCount.toLocaleString()} chars
                  </span>
                  <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loading || !alert.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className={styles.spin} />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Analyze Alert
                      </>
                    )}
                    {/* Sheen sweep */}
                    {!loading && <span className={styles.buttonSheen} />}
                  </button>
                </div>
              </form>
            </GlassCard>
          </Panel>

          {/* ── Resize Handle ──────────────────────────────────────────── */}
          <PanelResizeHandle className={styles.resizeHandle}>
            <div className={styles.resizeGrip} />
          </PanelResizeHandle>

          {/* ── Right Panel: Investigation Report ──────────────────────── */}
          <Panel defaultSize={60} minSize={30} className={styles.panel}>
            {loading ? (
              <GlassCard className={styles.loadingCard}>
                <div className={styles.scannerLine} />
                <div className={styles.loadingContent}>
                  <ThinkingSteps currentStep={thinkingStep} />
                </div>
              </GlassCard>
            ) : result ? (
              result.error ? (
                <GlassCard className={styles.resultCard}>
                  <SystemError
                    message={result.error}
                    onRetry={() => {
                      setResult(null);
                      if (alert.trim()) {
                        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                        analyzeAlert(fakeEvent);
                      }
                    }}
                  />
                </GlassCard>
              ) : (
                <GlassCard className={styles.resultCard}>
                  {/* Report Header */}
                  <div className={styles.resultHeader}>
                    <div className={styles.resultHeaderLeft}>
                      <h2 className={styles.resultTitle}>Investigation Complete</h2>
                      <VerdictBadge
                        verdict={result.structured_json?.decision || 'Analyzed'}
                        severity={getSeverity()}
                      />
                    </div>
                    <ScoreRing
                      score={getScore()}
                      severity={getSeverity()}
                      size={72}
                      strokeWidth={5}
                    />
                  </div>

                  {/* Extracted IOCs */}
                  {result.structured_json?.iocs && result.structured_json.iocs.length > 0 && (
                    <div className={styles.iocSection}>
                      <h4 className={styles.sectionLabel}>Extracted Entities</h4>
                      <div className={styles.iocGrid}>
                        {result.structured_json.iocs.map((ioc: any, idx: number) => (
                          <IOCChip
                            key={idx}
                            type={ioc.type || 'hash'}
                            value={ioc.value}
                            verdict={ioc.verdict || 'unknown'}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MITRE Mappings */}
                  {result.structured_json?.mitre_techniques && result.structured_json.mitre_techniques.length > 0 && (
                    <div className={styles.mitreSection}>
                      <h4 className={styles.sectionLabel}>MITRE ATT&CK</h4>
                      <div className={styles.mitreTags}>
                        {result.structured_json.mitre_techniques.map((t: any, idx: number) => (
                          <span key={idx} className={styles.mitreTag} title={t.technique_name || t}>
                            {typeof t === 'string' ? t : `${t.technique_id}: ${t.technique_name}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Markdown Report */}
                  <div className={styles.markdownWrapper}>
                    <div className={styles.markdownHeader}>
                      <h4 className={styles.sectionLabel}>Full Report</h4>
                      <button
                        className={styles.copyButton}
                        onClick={handleCopyReport}
                      >
                        {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <ReactMarkdown>{result.report}</ReactMarkdown>
                  </div>

                  {/* Action Bar */}
                  <div className={styles.actionBar}>
                    <button className={styles.actionPrimary}>
                      <AlertTriangle size={15} /> Escalate to Incident
                    </button>
                    <button className={styles.actionSecondary}>
                      Mark Benign
                    </button>
                    <button className={styles.actionSecondary}>
                      <ExternalLink size={14} /> Export Report
                    </button>
                  </div>
                </GlassCard>
              )
            ) : (
              <GlassCard className={styles.placeholderCard}>
                <motion.div
                  className={styles.placeholderContent}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <ShieldAlert size={48} className={styles.placeholderIcon} />
                  <h3>Awaiting Input</h3>
                  <p>Submit an alert on the left to begin the autonomous investigation.</p>
                </motion.div>
              </GlassCard>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
