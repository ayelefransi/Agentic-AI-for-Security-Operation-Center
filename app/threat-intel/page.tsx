"use client";

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Database,
  Globe,
  Search,
  Shield,
  Server,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Layers
} from 'lucide-react';
import { fetchIncidents } from '@/app/lib/api';
import styles from './page.module.css';

interface GatewayStatus {
  name: string;
  type: string;
  status: 'active' | 'demo_fallback';
  rateLimit: string;
  cacheTtl: string;
  supportedTypes: string[];
}

const GATEWAYS: GatewayStatus[] = [
  {
    name: 'VirusTotal',
    type: 'Multi-Engine Antivirus & Threat Intel',
    status: 'active',
    rateLimit: '4 req / min (Free) | 500 (Pro)',
    cacheTtl: '24 hours (SQLite Cache)',
    supportedTypes: ['IP', 'Domain', 'Hash', 'URL'],
  },
  {
    name: 'AbuseIPDB',
    type: 'IP Abuse & Reputation Scoring',
    status: 'active',
    rateLimit: '1,000 req / day',
    cacheTtl: '12 hours (SQLite Cache)',
    supportedTypes: ['IP'],
  },
  {
    name: 'GreyNoise',
    type: 'Internet-wide Scanner & Benign Noise Filter',
    status: 'active',
    rateLimit: 'Community API',
    cacheTtl: '24 hours (SQLite Cache)',
    supportedTypes: ['IP'],
  },
  {
    name: 'AlienVault OTX',
    type: 'Open Threat Exchange Pulses & Adversary TTPs',
    status: 'active',
    rateLimit: '10,000 req / day',
    cacheTtl: '24 hours (SQLite Cache)',
    supportedTypes: ['IP', 'Domain', 'Hash'],
  },
  {
    name: 'IPinfo.io',
    type: 'Geolocation, ASN & Hosting Provider Intel',
    status: 'active',
    rateLimit: '50,000 req / month',
    cacheTtl: '7 days (SQLite Cache)',
    supportedTypes: ['IP'],
  },
];

export default function ThreatIntelPage() {
  const [iocs, setIocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchIncidents();
      const collectedIocs: any[] = [];
      const seen = new Set<string>();

      res.incidents?.forEach((inc: any) => {
        inc.events?.forEach((evt: any) => {
          evt.extracted_iocs?.forEach((ioc: any) => {
            const key = `${ioc.type}:${ioc.value}`;
            if (!seen.has(key)) {
              seen.add(key);
              const enr = inc.enrichments?.find((e: any) => e.ioc?.value === ioc.value);
              collectedIocs.push({
                ...ioc,
                incidentId: inc.id,
                verdict: enr?.final_verdict || 'unknown',
                confidence: enr?.final_confidence || 0,
                tags: enr?.tags || [],
                timestamp: inc.created_at,
              });
            }
          });
        });
      });

      setIocs(collectedIocs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredIocs = useMemo(() => {
    return iocs.filter((ioc) => {
      if (filterType !== 'ALL' && ioc.type?.toUpperCase() !== filterType) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        ioc.value?.toLowerCase().includes(term) ||
        ioc.verdict?.toLowerCase().includes(term) ||
        ioc.tags?.some((t: string) => t.toLowerCase().includes(term))
      );
    });
  }, [iocs, filterType, searchTerm]);

  const maliciousCount = iocs.filter((i) => i.verdict === 'malicious').length;
  const suspiciousCount = iocs.filter((i) => i.verdict === 'suspicious').length;
  const benignCount = iocs.filter((i) => i.verdict === 'benign').length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Threat Intelligence & IOC Telemetry</h1>
          <p className={styles.subtitle}>
            Multi-source threat indicators, SQLite reputation cache, and active gateway statuses
          </p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={loadData}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Metrics Strip */}
      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Tracked IOCs</span>
          <span className={styles.metricValue}>{loading ? '—' : iocs.length}</span>
          <span className={styles.metricSubtext}>Across all ingested alerts</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Confirmed Malicious</span>
          <span className={styles.metricValue} style={{ color: 'var(--severity-critical)' }}>
            {loading ? '—' : maliciousCount}
          </span>
          <span className={styles.metricSubtext}>High-confidence threats</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Suspicious Activity</span>
          <span className={styles.metricValue} style={{ color: 'var(--severity-high)' }}>
            {loading ? '—' : suspiciousCount}
          </span>
          <span className={styles.metricSubtext}>Elevated risk indicators</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Benign / Safe</span>
          <span className={styles.metricValue} style={{ color: 'var(--primary-accent)' }}>
            {loading ? '—' : benignCount}
          </span>
          <span className={styles.metricSubtext}>Known benign telemetry</span>
        </div>
      </div>

      {/* Threat Intel Gateways Table */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Configured Threat Intelligence Gateways</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Gateway Source</th>
                <th>Provider Capability</th>
                <th>Rate Limiting</th>
                <th>Cache TTL</th>
                <th>Supported IOCs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {GATEWAYS.map((gw, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{gw.name}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{gw.type}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{gw.rateLimit}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{gw.cacheTtl}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {gw.supportedTypes.map((t, i) => (
                        <span key={i} className="badge badge-info" style={{ fontSize: '10px' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>
                      Operational
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extracted IOCs Feed */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Extracted Indicators Database</h2>
          <div className={styles.filterControls}>
            <input
              type="text"
              placeholder="Search indicator, tags..."
              className={`input ${styles.searchInput}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className={`input ${styles.typeSelect}`}
            >
              <option value="ALL">All Types</option>
              <option value="IP">IP Address</option>
              <option value="DOMAIN">Domain</option>
              <option value="HASH">File Hash</option>
              <option value="URL">URL</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading indicators...
          </div>
        ) : filteredIocs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No indicators match the specified filters. Ingest alerts in the Command Center to populate this repository.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Indicator</th>
                  <th>Type</th>
                  <th>Consensus Verdict</th>
                  <th>Incident</th>
                  <th>Discovered</th>
                </tr>
              </thead>
              <tbody>
                {filteredIocs.map((ioc, idx) => (
                  <tr key={idx}>
                    <td>
                      <code className={styles.iocCode}>{ioc.value}</code>
                    </td>
                    <td>
                      <span className="badge badge-info">
                        {ioc.type}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${ioc.verdict === 'malicious' ? 'critical' : ioc.verdict === 'suspicious' ? 'high' : ioc.verdict === 'benign' ? 'success' : 'info'}`}
                      >
                        {ioc.verdict}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/incidents/${ioc.incidentId}`}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary-accent)', textDecoration: 'none' }}
                      >
                        #{ioc.incidentId?.substring(0, 8)}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      {new Date(ioc.timestamp).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
