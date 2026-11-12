"use client";

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Settings as SettingsIcon, Key, CheckCircle2, XCircle,
  Loader2, RefreshCw, Shield, Users, FileCheck,
  Search, Trash2
} from 'lucide-react';
import {
  healthCheck, fetchIncidents, fetchCurrentUser, fetchUsers,
  createUser, updateUserRole, deleteUser,
  type AuthUser, type ManagedUser,
} from '@/app/lib/api';
import styles from './page.module.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  value: string;
  status: 'idle' | 'testing' | 'success' | 'error';
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  status: string;
  details: string;
}

// ── Tabs ───────────────────────────────────────────────────────────────────

type SettingsTab = 'general' | 'audit' | 'users';

// ── Component ──────────────────────────────────────────────────────────────

function SettingsInner() {
  const searchParams = useSearchParams();
  const initialParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    initialParam === 'audit' || initialParam === 'users' ? initialParam : 'general'
  );
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setCurrentUser(u);
        if (u.role !== 'admin' && activeTab === 'users') {
          setActiveTab('general');
        }
      })
      .catch(() => {});
  }, [activeTab]);

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'general' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <SettingsIcon size={14} />
          General
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'audit' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <FileCheck size={14} />
          Audit logs
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={14} />
            User management
          </button>
        )}
      </div>

      {activeTab === 'general' && <GeneralTab />}
      {activeTab === 'audit' && <AuditTab />}
      {activeTab === 'users' && isAdmin && <UsersTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className={styles.container}><div className={styles.emptyState}>Loading…</div></div>}>
      <SettingsInner />
    </Suspense>
  );
}

// ── General Tab ────────────────────────────────────────────────────────────

function GeneralTab() {
  const [backendHealth, setBackendHealth] = useState<'online' | 'offline' | 'checking'>('checking');
  const [activeModel, setActiveModel] = useState<string>('llama3-8b-8192');

  const [keys, setKeys] = useState<ApiKey[]>([
    { id: 'groq', name: 'Groq API key', value: 'gsk_••••••••••••', status: 'idle' },
    { id: 'virustotal', name: 'VirusTotal API key', value: '••••••••••••••••', status: 'idle' },
    { id: 'abuseipdb', name: 'AbuseIPDB key', value: '', status: 'idle' },
    { id: 'alienvault', name: 'AlienVault OTX key', value: '', status: 'idle' },
  ]);

  const checkBackend = async () => {
    try {
      setBackendHealth('checking');
      const res = await healthCheck();
      if (res.status === 'healthy') {
        setBackendHealth('online');
        if (res.model) setActiveModel(res.model);
      } else {
        setBackendHealth('offline');
      }
    } catch {
      setBackendHealth('offline');
    }
  };

  useEffect(() => { checkBackend(); }, []);

  const handleTestConnection = async (id: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'testing' } : k));
    try {
      const res = await healthCheck();
      setKeys(prev => prev.map(k =>
        k.id === id ? { ...k, status: res.status === 'healthy' ? 'success' : 'error' } : k
      ));
    } catch {
      setKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'error' } : k));
    }
  };

  const handleKeyChange = (id: string, value: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, value, status: 'idle' } : k));
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Key size={18} className={styles.sectionIcon} />
          <div>
            <h2 className={styles.sectionTitle}>API integrations</h2>
            <p className={styles.sectionDesc}>Manage credentials for the LLM engine and threat intelligence lookups.</p>
          </div>
        </div>

        <div className={styles.keyList}>
          {keys.map(apiKey => (
            <div key={apiKey.id} className={styles.keyRow}>
              <div className={styles.keyInfo}>
                <label className={styles.keyLabel}>{apiKey.name}</label>
                <input
                  type="password"
                  value={apiKey.value}
                  onChange={e => handleKeyChange(apiKey.id, e.target.value)}
                  placeholder={`Enter ${apiKey.name}`}
                  className={styles.keyInput}
                />
              </div>
              <div className={styles.keyActions}>
                <button
                  className={styles.testButton}
                  onClick={() => handleTestConnection(apiKey.id)}
                  disabled={apiKey.status === 'testing'}
                >
                  {apiKey.status === 'testing'
                    ? <Loader2 size={14} className={styles.spin} />
                    : 'Test'}
                </button>
                <div className={styles.statusIndicator}>
                  {apiKey.status === 'success' && <CheckCircle2 size={16} className={styles.success} />}
                  {apiKey.status === 'error' && <XCircle size={16} className={styles.error} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Shield size={18} className={styles.sectionIcon} />
          <div>
            <h2 className={styles.sectionTitle}>Platform info</h2>
          </div>
        </div>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Backend</span>
            <span className={backendHealth === 'online' ? styles.statusOnline : styles.statusOffline}>
              {backendHealth === 'online' ? 'Online' : backendHealth === 'checking' ? 'Connecting…' : 'Offline'}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>LLM engine</span>
            <span className={styles.infoValue}>{activeModel}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Version</span>
            <span className={styles.infoValue}>2.0.0</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Status</span>
            <button className={styles.ghostBtn} onClick={checkBackend} disabled={backendHealth === 'checking'}>
              <RefreshCw size={14} className={backendHealth === 'checking' ? styles.spin : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Audit Tab ──────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      const res = await fetchIncidents();
      const entries: AuditEntry[] = [];

      res.incidents?.forEach((inc: any) => {
        entries.push({
          timestamp: inc.created_at,
          actor: 'Supervisor agent',
          action: 'Incident created',
          target: `#${inc.id.substring(0, 8)}`,
          status: 'success',
          details: inc.decision || 'Alert ingested',
        });

        inc.agent_trace?.forEach((step: any) => {
          entries.push({
            timestamp: step.started_at || inc.created_at,
            actor: step.agent_name,
            action: `Agent ${step.status}`,
            target: `#${inc.id.substring(0, 8)}`,
            status: step.status === 'done' ? 'success' : step.status === 'error' ? 'failed' : 'info',
            details: step.output_summary || `${step.duration_ms?.toFixed(0) || '<10'}ms`,
          });
        });

        if (inc.feedback) {
          entries.push({
            timestamp: inc.feedback.timestamp || inc.created_at,
            actor: inc.feedback.analyst_id || 'Analyst',
            action: 'Override',
            target: `#${inc.id.substring(0, 8)}`,
            status: 'warning',
            details: `Verdict: ${inc.feedback.override_verdict || '—'}`,
          });
        }
      });

      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(entries);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return logs;
    const t = searchTerm.toLowerCase();
    return logs.filter(l =>
      l.actor.toLowerCase().includes(t) ||
      l.action.toLowerCase().includes(t) ||
      l.target.toLowerCase().includes(t) ||
      l.details.toLowerCase().includes(t)
    );
  }, [logs, searchTerm]);

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        <div className={styles.auditToolbar}>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search audit trail…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.ghostBtn} onClick={loadLogs} disabled={loading}>
            <RefreshCw size={14} className={loading ? styles.spin : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>Loading audit records…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.emptyState}>No audit records found.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => (
                  <tr key={idx}>
                    <td className={styles.mono}>
                      {new Date(entry.timestamp).toLocaleString([], {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </td>
                    <td>{entry.actor}</td>
                    <td>{entry.action}</td>
                    <td className={styles.mono}>{entry.target}</td>
                    <td>
                      <span className={`${styles.statusPill} ${
                        entry.status === 'success' ? styles.pillSuccess
                          : entry.status === 'failed' ? styles.pillDanger
                          : styles.pillWarning
                      }`}>
                        {entry.status}
                      </span>
                    </td>
                    <td className={styles.detailsCell}>{entry.details}</td>
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

// ── Users Tab (admin only) ─────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'analyst'>('analyst');
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetchUsers();
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleAddUser = async () => {
    if (!newEmail || !newName || !newPassword) return;
    setSaving(true);
    try {
      await createUser({ email: newEmail, name: newName, password: newPassword, role: newRole });
      setShowAddForm(false);
      setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('analyst');
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId: string, role: 'admin' | 'analyst') => {
    try {
      await updateUserRole(userId, role);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      await loadUsers();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return <div className={styles.tabContent}><div className={styles.emptyState}>Loading users…</div></div>;
  }

  return (
    <div className={styles.tabContent}>
      <div className={styles.section}>
        {error && (
          <div className={styles.errorBanner}>{error}</div>
        )}

        <div className={styles.sectionFooter}>
          <button className={styles.primaryBtn} onClick={() => setShowAddForm(v => !v)}>
            {showAddForm ? 'Cancel' : 'Add user'}
          </button>
        </div>

        {showAddForm && (
          <div className={styles.addUserForm}>
            <input
              className={styles.keyInput}
              placeholder="Full name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <input
              className={styles.keyInput}
              type="email"
              placeholder="Email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
            />
            <input
              className={styles.keyInput}
              type="password"
              placeholder="Password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <select
              className={styles.keyInput}
              value={newRole}
              onChange={e => setNewRole(e.target.value as 'admin' | 'analyst')}
            >
              <option value="analyst">Analyst</option>
              <option value="admin">Admin</option>
            </select>
            <button className={styles.primaryBtn} onClick={handleAddUser} disabled={saving}>
              {saving ? 'Creating…' : 'Create user'}
            </button>
          </div>
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userName}>{user.name}</div>
                    <div className={styles.userEmail}>{user.email}</div>
                  </td>
                  <td>
                    <select
                      className={styles.roleSelect}
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value as 'admin' | 'analyst')}
                    >
                      <option value="analyst">Analyst</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => handleDeleteUser(user.id)}
                      title="Delete user"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
