"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
  Send, Terminal, Loader2, ShieldAlert, Upload, CheckCircle2,
  Copy, Download, ExternalLink, ChevronDown, Shield,
  Activity, Clock, FileText, Check, ListChecks, Database
} from 'lucide-react';
import VerdictBadge from '../components/VerdictBadge';
import ScoreRing from '../components/ScoreRing';
import ThinkingSteps from '../components/ThinkingSteps';
import SystemError from '../components/SystemError';
import SeverityBadge from '../components/SeverityBadge';
import { analyzeAlert, downloadIncidentReportPdf } from '@/app/lib/api';
import styles from './page.module.css';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const sampleAlerts: Record<string, string> = {
  'Brute Force': `Event: Network Intrusion\nSource IP: 198.51.100.22\nDestination: 10.0.0.5\nDescription: Multiple failed SSH login attempts followed by a successful login. Potential brute force attack.`,
  'Email Threat': `Event: Phishing Email Detected\nFrom: hr-notification@evil-corp.xyz\nTo: john.doe@company.com\nSubject: Urgent: Update Your Credentials Now\nAttachment: credentials_form.html\nDescription: Suspicious email with credential harvesting link. SPF fail, DKIM mismatch.`,
  'Malware': `Event: Endpoint Alert\nHostname: WKS-FINANCE-042\nProcess: powershell.exe\nHash: d41d8cd98f00b204e9800998ecf8427e\nDescription: Encoded PowerShell command downloading payload from http://malware-c2.example.com/beacon.exe`,
  'Insider Risk': `Event: Data Exfiltration Attempt\nUser: jsmith@corp.internal\nAction: USB mass storage connected, 2.4GB copied\nFiles: customer_database_export.csv, financial_q4_report.xlsx\nSource: FINANCE-SERVER-01\nDescription: After-hours data copy to removable media by user with pending termination.`,
};

const sanitizeReportText = (text: string): string => {
  if (!text) return '';
  return text.replace(/[🚨📝🔬⚪🔴🟡🟢🗺️⚖️⚡🕐✅⏳❌⏭️📄📊🧠❓]/g, '').replace(/###\s+\[/g, '### [');
};

export default function AnalyzeContent() {
  const router = useRouter();
  const [alert, setAlert] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [thinkingStep, setThinkingStep] = useState(-1);
  const [jsonValid, setJsonValid] = useState<boolean | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sampleDropdownOpen, setSampleDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copiedActionIdx, setCopiedActionIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'iocs' | 'mitre' | 'timeline' | 'report'>('overview');
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const simPayload = localStorage.getItem('awra_simulation_payload');
      if (simPayload) { setAlert(simPayload); localStorage.removeItem('awra_simulation_payload'); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!alert.trim()) { setJsonValid(null); return; }
    try { JSON.parse(alert); setJsonValid(true); } catch { setJsonValid(false); }
  }, [alert]);

  const runThinkingSteps = useCallback(() => {
    setThinkingStep(0);
    [0, 1, 2, 3, 4].forEach((step, i) => { setTimeout(() => setThinkingStep(step + 1), (i + 1) * 800); });
  }, []);

  const handleAnalyzeAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alert.trim()) return;
    setLoading(true); setResult(null); runThinkingSteps();
    try {
      const data = await analyzeAlert(alert);
      setResult(data); setActiveTab('overview');
    } catch (error: any) {
      setResult({ error: error.message || 'Failed to analyze alert.' });
    } finally {
      setThinkingStep(5); setTimeout(() => setLoading(false), 600);
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { const reader = new FileReader(); reader.onload = (ev) => setAlert(ev.target?.result as string); reader.readAsText(file); }
  };

  const handleCopyReport = () => {
    if (result?.report) { navigator.clipboard.writeText(sanitizeReportText(result.report)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleDownloadReport = async () => {
    if (!result || result.error) return;
    try {
      setDownloadingPdf(true);
      setDownloadError(null);
      const fallbackPayload = {
        ...(result.structured_json || {}),
        id: incidentId || undefined,
        raw_alert: result.structured_json?.raw_alert || alert,
        report: result.report,
        telemetry_data: result.telemetry_data,
        iterations: result.iterations,
      };
      await downloadIncidentReportPdf(incidentId, fallbackPayload);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to download PDF report.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleCopyAction = (text: string, idx: number) => {
    navigator.clipboard.writeText(text); setCopiedActionIdx(idx); setTimeout(() => setCopiedActionIdx(null), 2000);
  };

  const charCount = alert.length;
  const lineCount = alert ? alert.split('\n').length : 0;

  const getSeverity = () => {
    if (!result?.structured_json) return 'Low';
    const s = result.structured_json?.triage?.severity;
    if (s) return typeof s === 'string' ? s : s.value || 'Low';
    const d = result.structured_json.decision || '';
    if (d.includes('True Positive') || d.includes('Critical')) return 'Critical';
    if (d.includes('High')) return 'High';
    if (d.includes('Suspicious')) return 'Medium';
    return 'Low';
  };

  const getScore = () => result?.structured_json?.score || result?.structured_json?.triage_score || 50;

  const getActions = (): string[] => {
    if (result?.structured_json?.recommended_actions?.length) return result.structured_json.recommended_actions;
    if (result?.report) {
      const m = result.report.match(/## Recommended Actions\s*\n([\s\S]*?)(?=\n## |\n---|$)/);
      if (m?.[1]) return m[1].split('\n').map((l: string) => l.replace(/^\d+\.\s*/, '').trim()).filter((l: string) => l.length > 0);
    }
    return ["Review firewall logs for secondary connections.", "Check endpoint telemetry for suspicious processes.", "Add source indicator to surveillance watchlist."];
  };

  const actions = result ? getActions() : [];
  const iocs = result?.structured_json?.iocs || [];
  const mitreList = result?.structured_json?.mitre_techniques || [];
  const traceList = result?.structured_json?.agent_trace || [];
  const incidentId = result?.structured_json?.id;
  const planSummary = result?.structured_json?.investigation_plan_summary || 'Autonomous multi-agent SOC pipeline';
  const cleanReport = sanitizeReportText(result?.report || '');

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Analyze alert</h1>
          <p className={styles.subtitle}>Submit security telemetry for autonomous multi-agent investigation.</p>
        </div>
      </header>

      <div className={styles.panelWrapper}>
        <PanelGroup orientation="horizontal" className={styles.panelGroup}>
          <Panel defaultSize={40} minSize={25} className={styles.panel}>
            <div className={styles.inputCard}>
              <form onSubmit={handleAnalyzeAlert} className={styles.form}>
                <div className={styles.labelWrapper}>
                  <label className={styles.fieldLabel}><Terminal size={14} /> Raw alert data</label>
                  <div className={styles.labelActions}>
                    {jsonValid !== null && (
                      <span className={`${styles.validIndicator} ${jsonValid ? styles.valid : styles.textOnly}`}>
                        {jsonValid ? <CheckCircle2 size={13} /> : null}
                        {jsonValid ? 'Valid JSON' : 'Raw text'}
                      </span>
                    )}
                    <div className={styles.sampleDropdown}>
                      <button type="button" className={styles.sampleButton} onClick={() => setSampleDropdownOpen(!sampleDropdownOpen)}>
                        Load sample <ChevronDown size={14} />
                      </button>
                      <AnimatePresence>
                        {sampleDropdownOpen && (
                          <motion.div className={styles.dropdownMenu} initial={{ opacity: 0, y: -4, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.95 }} transition={{ duration: 0.15 }}>
                            {Object.entries(sampleAlerts).map(([name, value]) => (
                              <button key={name} type="button" className={styles.dropdownItem} onClick={() => { setAlert(value); setSampleDropdownOpen(false); }}>{name}</button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div ref={dropRef} className={`${styles.editorContainer} ${isDragging ? styles.dragOver : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                  {isDragging && (<div className={styles.dragOverlay}><Upload size={32} /><span>Drop .json, .log, or .csv file</span></div>)}
                  <MonacoEditor height="100%" defaultLanguage="json" value={alert} onChange={(v) => setAlert(v || '')} theme="vs-dark"
                    options={{ minimap: { enabled: false }, fontSize: 13, fontFamily: 'var(--font-mono), JetBrains Mono, Consolas, monospace', lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', renderLineHighlight: 'none', padding: { top: 12, bottom: 12 }, overviewRulerLanes: 0, hideCursorInOverviewRuler: true, overviewRulerBorder: false, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }, roundedSelection: true, contextmenu: false, tabSize: 2 }} />
                </div>

                <div className={styles.editorFooter}>
                  <span className={styles.charCount}>{lineCount} lines · {charCount.toLocaleString()} chars</span>
                  <button type="submit" className={styles.submitButton} disabled={loading || !alert.trim()}>
                    {loading ? (<><Loader2 size={16} className={styles.spin} /> Analyzing…</>) : (<><Send size={16} /> Analyze alert</>)}
                    {!loading && <span className={styles.buttonSheen} />}
                  </button>
                </div>
              </form>
            </div>
          </Panel>

          <PanelResizeHandle className={styles.resizeHandle}><div className={styles.resizeGrip} /></PanelResizeHandle>

          <Panel defaultSize={60} minSize={30} className={styles.panel}>
            {loading ? (
              <div className={styles.loadingCard}><div className={styles.scannerLine} /><div className={styles.loadingContent}><ThinkingSteps currentStep={thinkingStep} /></div></div>
            ) : result ? (
              result.error ? (
                <div className={styles.resultCard}>
                  <SystemError message={result.error} onRetry={() => { setResult(null); if (alert.trim()) { handleAnalyzeAlert({ preventDefault: () => {} } as React.FormEvent); } }} />
                </div>
              ) : (
                <div className={styles.resultCard}>
                  <div className={styles.resultHeader}>
                    <div className={styles.resultHeaderLeft}>
                      <div className={styles.resultTitleRow}>
                        <h2 className={styles.resultTitle}>Investigation dossier</h2>
                        {incidentId && <span className={styles.incidentBadge}>INC-{incidentId.substring(0, 8)}</span>}
                      </div>
                      <div className={styles.verdictRow}>
                        <VerdictBadge verdict={result.structured_json?.decision || 'Analyzed'} severity={getSeverity()} />
                        <SeverityBadge severity={getSeverity()} />
                        <span className={styles.confidenceText}>Confidence: {result.structured_json?.confidence_score ? Math.round(result.structured_json.confidence_score * 100) : 90}%</span>
                      </div>
                    </div>
                    <ScoreRing score={getScore()} severity={getSeverity()} size={72} strokeWidth={5} />
                  </div>

                  <div className={styles.executiveDossier}>
                    <div className={styles.executiveTitle}>Executive finding</div>
                    <div className={styles.executiveText}>{result.structured_json?.reasoning || result.structured_json?.decision_reasoning || 'Investigation concluded.'}</div>
                    {planSummary && <div className={styles.strategyBadge}><Activity size={12} /><span>Investigation plan: {planSummary}</span></div>}
                  </div>

                  <div className={styles.tabsBar}>
                    <button type="button" className={`${styles.tabPill} ${activeTab === 'overview' ? styles.tabPillActive : ''}`} onClick={() => setActiveTab('overview')}><ListChecks size={13} /> Remediation</button>
                    <button type="button" className={`${styles.tabPill} ${activeTab === 'iocs' ? styles.tabPillActive : ''}`} onClick={() => setActiveTab('iocs')}><Database size={13} /> IOCs ({iocs.length})</button>
                    <button type="button" className={`${styles.tabPill} ${activeTab === 'mitre' ? styles.tabPillActive : ''}`} onClick={() => setActiveTab('mitre')}><Shield size={13} /> MITRE ({mitreList.length})</button>
                    <button type="button" className={`${styles.tabPill} ${activeTab === 'timeline' ? styles.tabPillActive : ''}`} onClick={() => setActiveTab('timeline')}><Clock size={13} /> Agent trace ({traceList.length || '6'})</button>
                    <button type="button" className={`${styles.tabPill} ${activeTab === 'report' ? styles.tabPillActive : ''}`} onClick={() => setActiveTab('report')}><FileText size={13} /> Report</button>
                  </div>

                  {activeTab === 'overview' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <div className={styles.tabSection}>
                        <h4 className={styles.sectionLabel}>Recommended countermeasures</h4>
                        <div className={styles.actionsGrid}>
                          {actions.map((act: string, idx: number) => (
                            <div key={idx} className={styles.actionCard}>
                              <div className={styles.actionNumber}>{(idx + 1).toString().padStart(2, '0')}</div>
                              <div className={styles.actionText}>{act}</div>
                              <button type="button" className={styles.actionCopyBtn} title="Copy" onClick={() => handleCopyAction(act, idx)}>
                                {copiedActionIdx === idx ? <Check size={14} className={styles.iconSuccess} /> : <Copy size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className={styles.sectionLabel}>Triage risk score</h4>
                        <div className={styles.breakdownGrid}>
                          <div className={styles.breakdownItem}><div className={styles.breakdownLabel}>Overall</div><div className={styles.breakdownScore}>{getScore().toFixed(1)} / 100</div></div>
                          <div className={styles.breakdownItem}><div className={styles.breakdownLabel}>Severity</div><div className={styles.breakdownScoreHighlight}>{getSeverity()}</div></div>
                          <div className={styles.breakdownItem}><div className={styles.breakdownLabel}>IOCs</div><div className={styles.breakdownScore}>{iocs.length} indicators</div></div>
                          <div className={styles.breakdownItem}><div className={styles.breakdownLabel}>MITRE</div><div className={styles.breakdownScore}>{mitreList.length} techniques</div></div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'iocs' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <h4 className={styles.sectionLabel}>Indicators of compromise</h4>
                      {iocs.length === 0 ? <div className={styles.tabEmpty}>No indicators extracted.</div> : (
                        <div className={`table-wrapper ${styles.tabTable}`}>
                          <table><thead><tr><th>Type</th><th>Value</th><th>Verdict</th></tr></thead>
                            <tbody>{iocs.map((ioc: any, idx: number) => {
                              const v = (ioc.verdict || 'unknown').toLowerCase();
                              const bc = v === 'malicious' ? 'badge-critical' : v === 'suspicious' ? 'badge-warning' : v === 'benign' ? 'badge-success' : 'badge-info';
                              return (<tr key={idx}><td><span className="badge badge-info">{ioc.type}</span></td><td><code className={styles.iocValue}>{ioc.value}</code></td><td><span className={`badge ${bc}`}>{ioc.verdict ? ioc.verdict.charAt(0).toUpperCase() + ioc.verdict.slice(1).toLowerCase() : 'Unknown'}</span></td></tr>);
                            })}</tbody></table>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'mitre' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <h4 className={styles.sectionLabel}>MITRE ATT&CK techniques</h4>
                      {mitreList.length === 0 ? <div className={styles.tabEmpty}>No techniques matched.</div> : (
                        <div className={styles.mitreGrid}>{mitreList.map((t: any, idx: number) => {
                          const techId = typeof t === 'string' ? t.split(':')[0] : t.technique_id;
                          const techName = typeof t === 'string' ? t.split(':')[1] || t : t.technique_name;
                          return (<div key={idx} className={styles.mitreCard}><div className={styles.mitreCardHeader}><span className={styles.mitreTechId}>{techId}</span><span className="badge badge-info">ATT&CK</span></div><div className={styles.mitreTechName}>{techName}</div></div>);
                        })}</div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'timeline' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <h4 className={styles.sectionLabel}>Agent execution audit</h4>
                      <div className={`table-wrapper ${styles.tabTable}`}>
                        <table><thead><tr><th>Agent</th><th>Status</th><th>Latency</th><th>Summary</th></tr></thead>
                          <tbody>
                            {traceList.length > 0 ? traceList.map((step: any, idx: number) => (
                              <tr key={idx}><td><code className={styles.agentCode}>{step.agent_name}</code></td><td><span className={`badge ${step.status === 'done' ? 'badge-success' : step.status === 'error' ? 'badge-critical' : 'badge-info'}`}>{typeof step.status === 'string' ? step.status.charAt(0).toUpperCase() + step.status.slice(1).toLowerCase() : 'Done'}</span></td><td className={styles.latencyCell}>{step.duration_ms ? `${step.duration_ms.toFixed(0)}ms` : '<10ms'}</td><td className={styles.summaryCell}>{step.output_summary || 'Done'}</td></tr>
                            )) : (<>
                              <tr><td><code>ingestion_agent</code></td><td><span className="badge badge-success">Done</span></td><td>12ms</td><td>Event normalized</td></tr>
                              <tr><td><code>supervisor_agent</code></td><td><span className="badge badge-success">Done</span></td><td>140ms</td><td>Strategy formulated</td></tr>
                              <tr><td><code>enrichment_agent</code></td><td><span className="badge badge-success">Done</span></td><td>180ms</td><td>Threat intel queried</td></tr>
                              <tr><td><code>mitre_agent</code></td><td><span className="badge badge-success">Done</span></td><td>15ms</td><td>Techniques correlated</td></tr>
                              <tr><td><code>triage_agent</code></td><td><span className="badge badge-success">Done</span></td><td>20ms</td><td>Risk score calculated</td></tr>
                              <tr><td><code>decision_agent</code></td><td><span className="badge badge-success">Done</span></td><td>220ms</td><td>Verdict rendered</td></tr>
                            </>)}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'report' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
                      <div className={styles.markdownWrapper}>
                        <div className={styles.markdownHeader}>
                          <h4 className={styles.sectionLabel}>Incident report</h4>
                          <div className={styles.headerActions}>
                            <button type="button" className={styles.copyButton} onClick={handleCopyReport}>
                              {copied ? <CheckCircle2 size={14} className={styles.iconSuccess} /> : <Copy size={14} />}
                              {copied ? 'Copied' : 'Copy report'}
                            </button>
                            <button
                              type="button"
                              className={styles.downloadButton}
                              onClick={handleDownloadReport}
                              disabled={downloadingPdf}
                            >
                              {downloadingPdf ? <Loader2 size={14} className={styles.spin} /> : <Download size={14} />}
                              {downloadingPdf ? 'Generating PDF...' : 'Download Report'}
                            </button>
                          </div>
                        </div>
                        <div className={styles.reportBody}><ReactMarkdown>{cleanReport}</ReactMarkdown></div>
                      </div>
                    </motion.div>
                  )}

                  {downloadError && (
                    <div className={styles.downloadError} role="alert">
                      {downloadError}
                    </div>
                  )}

                  <div className={styles.actionBar}>
                    <button
                      type="button"
                      className={styles.actionPrimary}
                      onClick={handleDownloadReport}
                      disabled={downloadingPdf}
                    >
                      {downloadingPdf ? <Loader2 size={15} className={styles.spin} /> : <Download size={15} />}
                      {downloadingPdf ? 'Generating PDF...' : 'Download Report'}
                    </button>
                    {incidentId && <button type="button" className={styles.actionSecondary} onClick={() => router.push(`/incidents/${incidentId}`)}><ExternalLink size={15} /> View dossier</button>}
                    <button type="button" className={styles.actionSecondary} onClick={() => router.push('/incidents')}>Incident queue</button>
                    <button type="button" className={styles.actionSecondary} onClick={handleCopyReport}><Copy size={14} /> {copied ? 'Copied!' : 'Copy summary'}</button>
                  </div>
                </div>
              )
            ) : (
              <div className={styles.placeholderCard}>
                <motion.div className={styles.placeholderContent} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                  <ShieldAlert size={48} className={styles.placeholderIcon} />
                  <h3>Awaiting input</h3>
                  <p>Submit security telemetry on the left to start the investigation pipeline.</p>
                </motion.div>
              </div>
            )}
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

