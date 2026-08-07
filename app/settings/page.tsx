"use client";

import { useState } from 'react';
import { Settings as SettingsIcon, Key, CheckCircle2, XCircle, Loader2, Save } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import { useTheme } from '../contexts/ThemeContext';
import styles from './page.module.css';

interface ApiKey {
  id: string;
  name: string;
  value: string;
  status: 'idle' | 'testing' | 'success' | 'error';
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  
  const [keys, setKeys] = useState<ApiKey[]>([
    { id: 'openai', name: 'OpenAI (GPT-4o)', value: 'sk-proj-...', status: 'idle' },
    { id: 'groq', name: 'Groq (Llama 3)', value: 'gsk_...', status: 'idle' },
    { id: 'virustotal', name: 'VirusTotal', value: '...', status: 'idle' },
    { id: 'abuseipdb', name: 'AbuseIPDB', value: '', status: 'idle' },
    { id: 'greynoise', name: 'GreyNoise', value: '', status: 'idle' }
  ]);

  const handleTestConnection = (id: string) => {
    setKeys(keys.map(k => k.id === id ? { ...k, status: 'testing' } : k));
    
    // Simulate API test
    setTimeout(() => {
      setKeys(keys.map(k => {
        if (k.id === id) {
          // Fake logic: if it has value, success. If empty, error.
          return { ...k, status: k.value ? 'success' : 'error' };
        }
        return k;
      }));
    }, 1500);
  };

  const handleKeyChange = (id: string, value: string) => {
    setKeys(keys.map(k => k.id === id ? { ...k, value, status: 'idle' } : k));
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.subtitle}>Configure integrations and platform preferences</p>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.mainColumn}>
          <GlassCard className={styles.settingsSection}>
            <div className={styles.sectionHeader}>
              <Key size={20} className={styles.sectionIcon} />
              <div>
                <h2>API Integrations</h2>
                <p>Manage keys for AI models and threat intelligence providers.</p>
              </div>
            </div>

            <div className={styles.keyList}>
              {keys.map((apiKey) => (
                <div key={apiKey.id} className={styles.keyRow}>
                  <div className={styles.keyInfo}>
                    <label className={styles.keyLabel}>{apiKey.name}</label>
                    <div className={styles.inputWrapper}>
                      <input 
                        type="password" 
                        value={apiKey.value}
                        onChange={(e) => handleKeyChange(apiKey.id, e.target.value)}
                        placeholder={`Enter ${apiKey.name} API Key`}
                        className={styles.keyInput}
                      />
                    </div>
                  </div>
                  <div className={styles.keyActions}>
                    <button 
                      className={styles.testButton}
                      onClick={() => handleTestConnection(apiKey.id)}
                      disabled={apiKey.status === 'testing'}
                    >
                      {apiKey.status === 'testing' ? <Loader2 size={16} className={styles.spin} /> : 'Test'}
                    </button>
                    <div className={styles.statusIndicator}>
                      {apiKey.status === 'success' && <CheckCircle2 size={18} className={styles.success} />}
                      {apiKey.status === 'error' && <XCircle size={18} className={styles.error} />}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.sectionFooter}>
              <button className={styles.saveButton}>
                <Save size={16} /> Save Configuration
              </button>
            </div>
          </GlassCard>

          <GlassCard className={styles.settingsSection}>
            <div className={styles.sectionHeader}>
              <SettingsIcon size={20} className={styles.sectionIcon} />
              <div>
                <h2>Preferences</h2>
                <p>Customize your dashboard experience.</p>
              </div>
            </div>
            
            <div className={styles.prefRow}>
              <div className={styles.prefInfo}>
                <label className={styles.prefLabel}>Dark Mode</label>
                <p className={styles.prefDesc}>Toggle the dark theme for low-light environments.</p>
              </div>
              <button 
                className={`${styles.toggle} ${theme === 'dark' ? styles.toggleActive : ''}`}
                onClick={toggleTheme}
              >
                <div className={styles.toggleKnob} />
              </button>
            </div>
          </GlassCard>
        </div>

        <div className={styles.sideColumn}>
          <GlassCard className={styles.infoCard}>
            <h3>NEXUS Command</h3>
            <div className={styles.infoRow}>
              <span>Version</span>
              <span className={styles.mono}>v2.4.0 (Redesign)</span>
            </div>
            <div className={styles.infoRow}>
              <span>Environment</span>
              <span className={styles.mono}>Production</span>
            </div>
            <div className={styles.infoRow}>
              <span>Backend Status</span>
              <span className={styles.statusOnline}>Online</span>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
