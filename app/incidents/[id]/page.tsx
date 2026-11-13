"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Clock,
  Terminal,
  Copy,
  CheckCircle2,
  Activity,
  RefreshCw,
  FileText,
  Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import VerdictBadge from '@/app/components/VerdictBadge';
import ScoreRing from '@/app/components/ScoreRing';
import SeverityBadge from '@/app/components/SeverityBadge';
import IOCChip from '@/app/components/IOCChip';
import { downloadIncidentReportPdf, fetchIncident, submitFeedback } from '@/app/lib/api';
import styles from './page.module.css';

// Strips residual emojis from reports to ensure clean enterprise typography
const sanitizeReportText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/[🚨📝🔬⚪🔴🟡🟢🗺️⚖️⚡🕐✅⏳❌⏭️📄📊🧠❓]/g, '')
    .replace(/###\s+\[/g, '### [');
};

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [incident, setIncident] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Feedback form state
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [overrideVerdict, setOverrideVerdict] = useState('');
  const [overrideSeverity, setOverrideSeverity] = useState('');
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchIncident(id);
      setIncident(data);
      if (data.feedback) {
        setOverrideVerdict(data.feedback.override_verdict || '');
        setOverrideSeverity(data.feedback.override_severity || '');
        setFeedbackNotes(data.feedback.notes || '');
      }
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load incident details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleCopyReport = () => {
    if (incident?.report) {
      navigator.clipboard.writeText(sanitizeReportText(incident.report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadReport = async () => {
    if (!incident) return;
    try {
      setDownloadingPdf(true);
      setDownloadError(null);
      await downloadIncidentReportPdf(incident.id || id, incident);
    } catch (err: any) {
      setDownloadError(err?.message || 'Failed to generate PDF report');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      setSubmittingFeedback(true);
      const res = await submitFeedback(id, {
        override_verdict: overrideVerdict || undefined,
        override_severity: overrideSeverity || undefined,
        notes: feedbackNotes,
      });
      setIncident(res.incident);
      setFeedbackSuccess(true);
      setTimeout(() => {
        setFeedbackSuccess(false);
        setFeedbackOpen(false);
      }, 1500);
    } catch (err: any) {
      alert(`Failed to save feedback: ${err.message}`);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container} style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--primary-accent)', marginBottom: '16px' }} />
        <div style={{ color: 'var(--text-secondary)' }}>Loading investigation record #{id?.substring(0, 8)}...</div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className={styles.container}>
        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/incidents')}>
          <ArrowLeft size={14} /> Back to Incidents
        </button>
        <div className="card" style={{ padding: '32px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <AlertTriangle size={48} style={{ color: 'var(--severity-critical)', margin: '0 auto 16px' }} />
          <h3>Incident Not Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>{error || `No incident found matching identifier ${id}`}</p>
        </div>
      </div>
    );
  }

  const severity = incident.triage?.severity || 'Low';
  const score = incident.triage?.score || 50;

  return (
    <div className={styles.container}>
      {/* Top Navigation & Status Bar */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push('/incidents')}>
            <ArrowLeft size={14} /> Back to Incidents
          </button>
          <span className={styles.incidentIdBadge}>
            #{incident.id.substring(0, 8)}
          </span>
          <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
            {incident.status?.replace(/_/g, ' ') || 'Open'}
          </span>
          {incident.feedback?.override_verdict && (
            <span className="badge badge-warning">
              Analyst Overridden
            </span>
          )}
        </div>

        <div className={styles.topBarRight}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFeedbackOpen(!feedbackOpen)}
          >
            <Shield size={14} /> {feedbackOpen ? 'Close Feedback' : 'Analyst Feedback'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleCopyReport}>
            {copied ? <CheckCircle2 size={14} style={{ color: 'var(--primary-accent)' }} /> : <Copy size={14} />}
            {copied ? 'Copied Report' : 'Copy Report'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadReport}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {downloadingPdf ? 'Generating PDF...' : 'Download Report'}
          </button>
        </div>
      </div>

      {downloadError && (
        <div className={styles.downloadError} role="alert">
          {downloadError}
        </div>
      )}

      {/* Analyst Feedback Form Panel */}
      {feedbackOpen && (
        <div className={styles.feedbackPanel}>
          <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={16} style={{ color: 'var(--primary-accent)' }} /> Analyst Review & Verdict Feedback
          </h4>
          <form onSubmit={handleFeedbackSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className={styles.feedbackGrid}>
              <div>
                <label className={styles.fieldLabel}>
                  Override Verdict (Optional)
                </label>
                <select
                  value={overrideVerdict}
                  onChange={(e) => setOverrideVerdict(e.target.value)}
                  className="input"
                >
                  <option value="">Keep Agent Verdict ({incident.decision || 'N/A'})</option>
                  <option value="True Positive">True Positive - Confirm Attack</option>
                  <option value="False Positive">False Positive - Close Incident</option>
                  <option value="Suspicious Activity">Suspicious Activity - Monitor</option>
                  <option value="Needs Investigation">Needs Deep Forensics</option>
                </select>
              </div>

              <div>
                <label className={styles.fieldLabel}>
                  Override Severity (Optional)
                </label>
                <select
                  value={overrideSeverity}
                  onChange={(e) => setOverrideSeverity(e.target.value)}
                  className="input"
                >
                  <option value="">Keep Agent Severity ({severity})</option>
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label className={styles.fieldLabel}>
                Analyst Notes / Rationale
              </label>
              <textarea
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
                rows={3}
                className="input"
                placeholder="Add investigation notes or evidence justifications..."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center' }}>
              {feedbackSuccess && (
                <span style={{ fontSize: '12px', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={14} /> Feedback recorded!
                </span>
              )}
              <button
                type="submit"
                disabled={submittingFeedback}
                className="btn btn-primary btn-sm"
              >
                {submittingFeedback ? 'Saving...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hero Overview Card */}
      <div className={styles.heroCard}>
        <div className={styles.heroContent}>
          <div className={styles.verdictRow}>
            <VerdictBadge
              verdict={incident.feedback?.override_verdict || incident.decision || 'Investigated'}
              severity={incident.feedback?.override_severity || severity}
            />
            <SeverityBadge severity={incident.feedback?.override_severity || severity} />
          </div>
          <h2 className={styles.incidentTitle}>
            {incident.decision || 'Security Incident'}
          </h2>
          <p className={styles.incidentReasoning}>
            {incident.decision_reasoning || 'Autonomous multi-agent investigation completed.'}
          </p>

          {/* Investigation Plan metadata */}
          {incident.investigation_plan_summary && (
            <div className={styles.planBox}>
              <span className={styles.planLabel}>
                Supervisor Investigation Plan
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                {incident.investigation_plan_summary}
              </span>
              {incident.supervisor_iteration && (
                <span style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>
                  ({incident.supervisor_iteration} iteration loop completed)
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.scoreWrapper}>
          <ScoreRing
            score={score}
            severity={severity}
            size={84}
            strokeWidth={6}
          />
          <span className={styles.scoreLabel}>
            Risk Assessment
          </span>
        </div>
      </div>

      {/* Grid: Indicators & MITRE */}
      <div className={styles.infoGrid}>
        {/* Indicators of Compromise */}
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>
            <Terminal size={16} style={{ color: 'var(--primary-accent)' }} /> Extracted Indicators (IOCs)
          </h3>
          {incident.events?.[0]?.extracted_iocs && incident.events[0].extracted_iocs.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {incident.events[0].extracted_iocs.map((ioc: any, idx: number) => {
                const enr = incident.enrichments?.find((e: any) => e.ioc?.value === ioc.value);
                return (
                  <IOCChip
                    key={idx}
                    type={ioc.type}
                    value={ioc.value}
                    verdict={enr?.final_verdict || 'unknown'}
                  />
                );
              })}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No specific IOCs extracted for this alert.</div>
          )}
        </div>

        {/* MITRE ATT&CK */}
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>
            <Activity size={16} style={{ color: 'var(--primary-accent)' }} /> MITRE ATT&CK Mapping
          </h3>
          {incident.mitre_mappings && incident.mitre_mappings.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {incident.mitre_mappings.map((m: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(45, 212, 191, 0.08)',
                    border: '1px solid var(--border-default)',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-accent)', marginRight: '6px' }}>
                    {m.technique_id}
                  </span>
                  <span>{m.technique_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No MITRE techniques mapped for this incident.</div>
          )}
        </div>
      </div>

      {/* Investigation Audit Trail */}
      {incident.agent_trace && incident.agent_trace.length > 0 && (
        <div className={styles.sectionCard}>
          <h3 className={styles.sectionTitle}>
            <Clock size={16} style={{ color: 'var(--primary-accent)' }} /> Multi-Agent Execution Timeline
          </h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {incident.agent_trace.map((step: any, idx: number) => (
                  <tr key={idx}>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-accent)' }}>
                        {step.agent_name}
                      </code>
                    </td>
                    <td>
                      <span className={`badge badge-${step.status === 'done' ? 'success' : step.status === 'error' ? 'critical' : 'info'}`}>
                        {step.status}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {step.duration_ms ? `${step.duration_ms.toFixed(0)}ms` : '—'}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {step.output_summary || (step.error ? `Error: ${step.error}` : 'Completed')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full Investigation Report */}
      {incident.report && (
        <div className={styles.reportCard}>
          <div className={styles.reportHeader}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} style={{ color: 'var(--primary-accent)' }} /> Investigation Final Report
            </h3>
            <div className={styles.reportActions}>
              <button className="btn btn-secondary btn-sm" onClick={handleCopyReport}>
                {copied ? <CheckCircle2 size={14} style={{ color: 'var(--primary-accent)' }} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Report'}
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleDownloadReport}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                {downloadingPdf ? 'Generating PDF...' : 'Download Report'}
              </button>
            </div>
          </div>
          <div className={styles.reportContent}>
            <ReactMarkdown>{sanitizeReportText(incident.report)}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
