/**
 * Simple i18n translation system for NEXUS Command SOC Platform
 * 
 * Provides translation functionality with fallback to English.
 * Supports multiple languages and namespace-based organization.
 * 
 * @example
 * const t = useTranslation('dashboard');
 * const title = t('title'); // Returns translated string
 */

type Translations = {
  [key: string]: string | Translations;
};

const translations: Record<string, Translations> = {
  en: {
    common: {
      retry: 'Retry',
      loading: 'Loading...',
      error: 'Error',
      viewAll: 'View All',
    },
    dashboard: {
      title: 'Command Center',
      description: 'Security operations overview and active incidents',
      analyzeAlert: 'Analyze Alert',
      failedToLoad: 'Failed to Load Dashboard',
      activeIncidents: 'Active Incidents',
      criticalAlerts: 'Critical Alerts',
      totalAlerts: 'Total Alerts',
      avgTriageTime: 'Avg Triage Time',
      recentIncidents: 'Recent Incidents',
      noIncidents: 'No Incidents',
      noIncidentsDescription: 'No security incidents have been recorded yet.',
      analyzeFirstAlert: 'Analyze Your First Alert',
      tableHeaders: {
        id: 'ID',
        verdict: 'Verdict',
        severity: 'Severity',
        eventType: 'Event Type',
        source: 'Source',
        time: 'Time',
        status: 'Status',
      },
      pending: 'Pending',
      unknown: 'Unknown',
    },
  },
};

/**
 * Get translation for a given key and locale
 * @param key - Translation key in dot notation (e.g., "dashboard.title")
 * @param locale - Language code (default: "en")
 * @returns Translated string or key if not found
 */
export function translate(key: string, locale: string = 'en'): string {
  const keys = key.split('.');
  let value: any = translations[locale];

  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  return typeof value === 'string' ? value : key;
}

/**
 * React hook for translations within a namespace
 * @param namespace - Translation namespace (e.g., "dashboard", "common")
 * @param locale - Language code (default: "en")
 * @returns Translation function scoped to namespace
 */
export function useTranslation(namespace: string, locale: string = 'en') {
  return (key: string): string => {
    return translate(`${namespace}.${key}`, locale);
  };
}

/**
 * Add translations dynamically (useful for plugins or dynamic content)
 * @param locale - Language code
 * @param namespace - Translation namespace
 * @param trans - Translation object
 */
export function addTranslations(
  locale: string,
  namespace: string,
  trans: Translations
): void {
  if (!translations[locale]) {
    translations[locale] = {};
  }
  translations[locale][namespace] = trans;
}
