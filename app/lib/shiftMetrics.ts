/**
 * Shift-window metrics for the dashboard.
 *
 * The backend records only when an incident was created (no status history),
 * so every "since last shift" figure is derived from created_at within a
 * window that starts when the analyst's previous shift ended.
 */
import type { Incident } from './api';

const LAST_ACTIVE_KEY = 'awra-last-active';
const SHIFT_START_KEY = 'awra-shift-start';

const HOUR = 3600_000;
const NEW_SHIFT_GAP = 4 * HOUR;
const DEFAULT_WINDOW = 8 * HOUR;
const MAX_WINDOW = 7 * 24 * HOUR;

export const CLOSED_STATUSES = new Set(['closed', 'closed_false_positive', 'closed_resolved']);

export function isOpen(incident: Incident): boolean {
  return !CLOSED_STATUSES.has((incident.status || '').toLowerCase());
}

export function severityOf(incident: Incident): string {
  return (incident.triage?.severity || 'low').toLowerCase();
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function createdMs(incident: Incident): number {
  const t = new Date(incident.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function readNumber(key: string): number | null {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Storage unavailable (private mode, blocked); the default window still works.
  }
}

/**
 * Resolve the start of the current shift window and record activity.
 * Call once per successful dashboard load or refresh.
 */
export function resolveShiftStart(now: number = Date.now()): number {
  const lastActive = readNumber(LAST_ACTIVE_KEY);
  let shiftStart = readNumber(SHIFT_START_KEY);

  if (lastActive !== null && now - lastActive >= NEW_SHIFT_GAP) {
    // Returning after a break: show everything that happened while away.
    shiftStart = lastActive;
    writeNumber(SHIFT_START_KEY, shiftStart);
  }
  if (shiftStart === null) {
    shiftStart = now - DEFAULT_WINDOW;
    writeNumber(SHIFT_START_KEY, shiftStart);
  }
  writeNumber(LAST_ACTIVE_KEY, now);
  return Math.max(shiftStart, now - MAX_WINDOW);
}

/** Seconds from the first agent start to the last agent completion, or null. */
export function triageSeconds(incident: Incident): number | null {
  const trace = incident.agent_trace;
  if (!trace || trace.length === 0) return null;
  const start = new Date(trace[0].started_at || '').getTime();
  const last = trace[trace.length - 1];
  const end = new Date(last.completed_at || last.started_at || '').getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

export interface ShiftMetrics {
  windowStart: number;
  openCount: number;
  openNew: number;
  critHighOpen: number;
  critHighNew: number;
  /** Mean triage seconds for incidents created in the window, or null. */
  triageWindow: number | null;
  /** Mean triage seconds for the same-length window before it, or null. */
  triagePrevious: number | null;
  createdInWindow: number;
  autoClosed: number;
}

export function computeShiftMetrics(incidents: Incident[], windowStart: number, now: number = Date.now()): ShiftMetrics {
  const length = now - windowStart;
  const inWindow = incidents.filter((i) => createdMs(i) >= windowStart);
  const inPrevious = incidents.filter((i) => {
    const t = createdMs(i);
    return t >= windowStart - length && t < windowStart;
  });
  const isCritHigh = (i: Incident) => ['critical', 'high'].includes(severityOf(i));

  const triageOf = (list: Incident[]) =>
    mean(list.map(triageSeconds).filter((v): v is number => v !== null));

  return {
    windowStart,
    openCount: incidents.filter(isOpen).length,
    openNew: inWindow.filter(isOpen).length,
    critHighOpen: incidents.filter((i) => isOpen(i) && isCritHigh(i)).length,
    critHighNew: inWindow.filter((i) => isOpen(i) && isCritHigh(i)).length,
    triageWindow: triageOf(inWindow),
    triagePrevious: triageOf(inPrevious),
    createdInWindow: inWindow.length,
    autoClosed: inWindow.filter(
      (i) => i.status?.toLowerCase() === 'closed_false_positive' && !i.feedback?.override_verdict
    ).length,
  };
}

/** Open incidents, most severe first, then newest first. */
export function attentionQueue(incidents: Incident[]): Incident[] {
  return incidents
    .filter(isOpen)
    .sort((a, b) => {
      const bySeverity = (SEVERITY_RANK[severityOf(a)] ?? 4) - (SEVERITY_RANK[severityOf(b)] ?? 4);
      return bySeverity !== 0 ? bySeverity : createdMs(b) - createdMs(a);
    });
}

export function formatSeconds(seconds: number): string {
  return seconds > 120 ? `${(seconds / 60).toFixed(1)}m` : `${seconds.toFixed(1)}s`;
}

export function formatWindow(windowStart: number, now: number = Date.now()): string {
  const hours = Math.round((now - windowStart) / HOUR);
  if (hours < 1) return 'the last hour';
  if (hours < 48) return `the last ${hours}h`;
  return `the last ${Math.round(hours / 24)} days`;
}

export function greeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
