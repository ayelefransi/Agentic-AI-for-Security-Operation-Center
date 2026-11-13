/**
 * API client with error handling, retries, and type safety.
 */

/**
 * Base URL of the FastAPI backend. Defaults to the same-origin `/api`, which is
 * where both the dev proxy and the Vercel function serve it. An override is
 * honoured only when it is an absolute http(s) URL or ends in `/api`; anything
 * else (such as Vercel's `/_/backend` service prefix) points at a path the
 * backend does not serve and would break sign-in.
 */
function resolveApiBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(configured) || configured.endsWith('/api')) {
    return configured;
  }
  return '/api';
}

const API_BASE_URL = resolveApiBaseUrl();

// Requests authenticate with the httpOnly session cookie (credentials: 'include').
// Never put API keys in NEXT_PUBLIC_* variables: they are bundled into client code.

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface FetchOptions extends RequestInit {
  retry?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

/**
 * Enhanced fetch with error handling and retries.
 */
async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    retry = false,
    retryCount = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  
  let lastError: Error | null = null;
  const attempts = retry ? retryCount : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers as Record<string, string>,
      };

      const response = await fetch(url, {
        ...fetchOptions,
        credentials: 'include',
        headers,
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // An expired or missing session on a protected endpoint: send the user back to sign in.
        if (response.status === 401 && typeof window !== 'undefined' && !endpoint.startsWith('/auth/')) {
          const from = window.location.pathname + window.location.search;
          window.location.assign(`/login?from=${encodeURIComponent(from)}`);
        }

        throw new APIError(
          errorData.detail || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error as Error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof APIError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Retry on network errors or 5xx errors
      if (attempt < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }

      // Last attempt failed
      throw lastError;
    }
  }

  throw lastError || new Error('Unknown error occurred');
}

// ── API Methods ────────────────────────────────────────────────────────────

export interface AlertAnalysisRequest {
  alert: string;
}

export interface AlertAnalysisResponse {
  structured_json: {
    decision?: string;
    score?: number;
    triage_score?: number;
    iocs?: Array<{
      type: string;
      value: string;
      verdict?: string;
    }>;
    mitre_techniques?: Array<{
      technique_id?: string;
      technique_name?: string;
    } | string>;
  };
  report: string;
  iterations: number;
  telemetry_data?: Array<{
    time: string;
    volume: number;
    severity: number;
  }>;
}

export interface Incident {
  id: string;
  created_at: string;
  decision?: string;
  decision_reasoning?: string;
  triage?: {
    severity: string;
    score: number;
    confidence?: number;
    breakdown?: Record<string, number>;
  };
  events?: Array<{
    event_type: string;
    src_ip?: string;
    dst_ip?: string;
    hostname?: string;
    user?: string | any;
    raw_log?: string;
    extracted_iocs?: Array<{
      type: string;
      value: string;
      context?: string;
    }>;
  }>;
  enrichments?: Array<{
    ioc: {
      type: string;
      value: string;
    };
    final_verdict: string;
    final_confidence: number;
    tags?: string[];
  }>;
  mitre_mappings?: Array<{
    tactic: string;
    technique_id: string;
    technique_name: string;
    confidence: number;
    evidence?: string;
  }>;
  agent_trace?: Array<{
    agent_name: string;
    status: string;
    started_at?: string;
    completed_at?: string;
    duration_ms?: number;
    output_summary?: string;
    error?: string;
  }>;
  raw_alert?: string;
  report?: string;
  status: string;
  investigation_plan_summary?: string;
  supervisor_iteration?: number;
  supervisor_decision?: any;
  feedback?: {
    override_verdict?: string;
    override_severity?: string;
    notes?: string;
    analyst_id?: string;
    timestamp?: string;
  };
}

export interface Stats {
  total_alerts: number;
  open_incidents: number;
  critical_alerts: number;
  avg_triage_seconds: number;
}

/**
 * Analyze a security alert.
 */
export async function analyzeAlert(
  alert: string
): Promise<AlertAnalysisResponse> {
  return apiFetch<AlertAnalysisResponse>('/analyze-alert', {
    method: 'POST',
    body: JSON.stringify({ alert }),
    retry: false, // Don't retry analysis (expensive LLM calls)
  });
}

/**
 * Fetch dashboard statistics.
 */
export async function fetchStats(): Promise<Stats> {
  return apiFetch<Stats>('/stats', {
    retry: true,
  });
}

/**
 * Fetch all incidents.
 */
export async function fetchIncidents(): Promise<{ incidents: Incident[] }> {
  return apiFetch<{ incidents: Incident[] }>('/incidents', {
    retry: true,
  });
}

/**
 * Fetch a specific incident by ID.
 */
export async function fetchIncident(id: string): Promise<Incident> {
  return apiFetch<Incident>(`/incidents/${id}`, {
    retry: true,
  });
}

/**
 * Submit analyst feedback for an incident.
 */
export async function submitFeedback(
  incidentId: string,
  feedback: {
    override_verdict?: string;
    override_severity?: string;
    notes: string;
  }
): Promise<{ status: string; incident: Incident }> {
  return apiFetch(`/feedback/${incidentId}`, {
    method: 'POST',
    body: JSON.stringify(feedback),
  });
}

/**
 * Fetch MITRE ATT&CK heatmap data.
 */
export interface MitreHeatmapTechnique {
  technique_id: string;
  technique_name: string;
  tactic: string;
  count: number;
  max_confidence: number;
}

export interface MitreHeatmapResponse {
  tactics: string[];
  techniques: MitreHeatmapTechnique[];
}

export async function fetchMitreHeatmap(): Promise<MitreHeatmapResponse> {
  return apiFetch<MitreHeatmapResponse>('/mitre-heatmap', {
    retry: true,
  });
}

/**
 * Health check.
 */
export async function healthCheck(): Promise<{ status: string; model: string }> {
  return apiFetch<{ status: string; model: string }>('/health', {
    retry: true,
  });
}

// ── Auth Types & Methods ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst';
}

/**
 * Login with email and password.
 */
export async function login(
  email: string,
  password: string,
  remember_me: boolean = false
): Promise<{ user: AuthUser }> {
  return apiFetch<{ user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, remember_me }),
  });
}

/**
 * Logout and clear session cookie.
 */
export async function logout(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/auth/logout', {
    method: 'POST',
  });
}

/**
 * Get current authenticated user.
 */
export async function fetchCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/auth/me');
}

/**
 * Update incident status (acknowledge, escalate, close).
 */
export async function updateIncidentStatus(
  incidentId: string,
  status: string
): Promise<{ status: string; incident: Incident }> {
  return apiFetch(`/incidents/${incidentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Fetch agent health status.
 */
export interface AgentHealth {
  name: string;
  status: 'online' | 'offline' | 'warning';
  latency_ms: number;
  last_run: string;
  last_run_at?: string | null;
}

export async function fetchAgentHealth(): Promise<{ agents: AgentHealth[] }> {
  return apiFetch<{ agents: AgentHealth[] }>('/agents/health', {
    retry: true,
  });
}

export interface VolumeBucket {
  label: string;
  count: number;
}

export async function fetchIncidentVolume(
  range: '24h' | '7d'
): Promise<{ range: '24h' | '7d'; buckets: VolumeBucket[] }> {
  return apiFetch<{ range: '24h' | '7d'; buckets: VolumeBucket[] }>(
    `/incidents/volume?range=${range}`,
    { retry: true }
  );
}

export interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst';
  status: string;
}

export async function fetchUsers(): Promise<{ users: ManagedUser[] }> {
  return apiFetch<{ users: ManagedUser[] }>('/users');
}

export async function createUser(payload: {
  email: string;
  name: string;
  password: string;
  role: 'admin' | 'analyst';
}): Promise<{ user: ManagedUser }> {
  return apiFetch<{ user: ManagedUser }>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUserRole(
  userId: string,
  role: 'admin' | 'analyst'
): Promise<{ user: ManagedUser }> {
  return apiFetch<{ user: ManagedUser }>(`/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteUser(userId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/users/${userId}`, {
    method: 'DELETE',
  });
}

function parseFilenameFromDisposition(header: string | null, fallbackName: string): string {
  if (!header) return fallbackName;
  const utf8Match = header.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]).replace(/["/\\]/g, '');
    } catch {
      /* fall through to quoted filename */
    }
  }
  const plainMatch = header.match(/filename="?([^";\n]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].replace(/["/\\]/g, '');
  }
  return fallbackName;
}

/**
 * Dynamically generate and trigger a browser download of the complete PDF
 * investigation report for either a persisted incident ID or an ad-hoc payload.
 */
export async function downloadIncidentReportPdf(
  incidentId?: string | null,
  fallbackPayload?: Record<string, any>
): Promise<string> {
  const cleanId = typeof incidentId === 'string' ? incidentId.trim() : '';
  const url = cleanId
    ? `${API_BASE_URL}/incidents/${encodeURIComponent(cleanId)}/report.pdf`
    : `${API_BASE_URL}/reports/pdf`;

  const headers: Record<string, string> = {};
  if (!cleanId) {
    headers['Content-Type'] = 'application/json';
  }

  let response = await fetch(url, {
    method: cleanId ? 'GET' : 'POST',
    credentials: 'include',
    headers,
    body: cleanId ? undefined : JSON.stringify(fallbackPayload || {}),
  });

  if (cleanId && response.status === 404 && fallbackPayload) {
    const postHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    response = await fetch(`${API_BASE_URL}/reports/pdf`, {
      method: 'POST',
      credentials: 'include',
      headers: postHeaders,
      body: JSON.stringify({ id: cleanId, ...fallbackPayload }),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new APIError(
      errorData.detail || `Failed to download PDF report (HTTP ${response.status})`,
      response.status,
      errorData
    );
  }

  const blob = await response.blob();
  const safeFallback = cleanId
    ? `awra-soc-report-${cleanId.replace(/[^A-Za-z0-9._-]+/g, '-')}.pdf`
    : 'awra-soc-report-investigation.pdf';
  const filename = parseFilenameFromDisposition(
    response.headers.get('Content-Disposition'),
    safeFallback
  );

  const objectUrl = window.URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  }

  return filename;
}
