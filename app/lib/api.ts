/**
 * API client with error handling, retries, and type safety.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Optional API key for authenticated endpoints
// Set this in .env.local as NEXT_PUBLIC_API_KEY if backend requires auth
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

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
      // Build headers with optional authorization
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers as Record<string, string>,
      };

      // Add API key if available (for endpoints that require auth)
      if (API_KEY) {
        headers['Authorization'] = `Bearer ${API_KEY}`;
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
      });

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
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
  decision: string;
  decision_reasoning: string;
  triage?: {
    severity: string;
    score: number;
  };
  events?: Array<{
    event_type: string;
    src_ip?: string;
    dst_ip?: string;
  }>;
  status: string;
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
 * Health check.
 */
export async function healthCheck(): Promise<{ status: string; model: string }> {
  return apiFetch<{ status: string; model: string }>('/health', {
    retry: true,
  });
}
