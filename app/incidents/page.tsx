"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Filter, ShieldAlert, ChevronRight } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import SeverityBadge from '../components/SeverityBadge';
import IOCChip from '../components/IOCChip';
import styles from './page.module.css';

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const res = await fetch('/api/incidents');
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const filteredIncidents = incidents.filter(inc => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      inc.id?.toLowerCase().includes(term) ||
      inc.decision?.toLowerCase().includes(term) ||
      inc.events?.some((e: any) => e.event_type?.toLowerCase().includes(term))
    );
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Incidents</h1>
          <p className={styles.subtitle}>Historical and active security investigations</p>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by ID, verdict, or event type..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className={styles.filterButton}>
          <Filter size={16} />
          Filters
        </button>
      </div>

      <div className={styles.incidentList}>
        {loading ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <GlassCard key={i} delay={0.1 + (i * 0.05)} className={`${styles.incidentCard} ${styles.skeletonCard}`}>
                 <div className={styles.cardLeft}>
                   <div className={`${styles.skeletonTitle} skeleton`} />
                   <div className={`${styles.skeletonDesc} skeleton`} />
                   <div className={`${styles.skeletonDesc} skeleton`} style={{ width: '60%' }} />
                 </div>
              </GlassCard>
            ))}
          </>
        ) : filteredIncidents.length === 0 ? (
          <GlassCard className={styles.emptyState}>
            <div className={styles.emptyIconWrap}>
              <ShieldAlert size={48} className={styles.emptyIcon} />
            </div>
            <h3>No Incidents Found</h3>
            <p>Try adjusting your search filters.</p>
          </GlassCard>
        ) : (
          filteredIncidents.map((incident, i) => (
            <GlassCard key={incident.id} delay={0.1 + (i * 0.05)} hoverEffect className={styles.incidentCard}>
              <div className={styles.cardLeft}>
                <div className={styles.cardHeader}>
                  <SeverityBadge severity={incident.triage?.severity || 'Low'} />
                  <span className={styles.incidentId}>#{incident.id?.substring(0, 8)}</span>
                </div>
                <h3 className={styles.cardTitle}>{incident.decision || "Investigation Pending"}</h3>
                <p className={styles.cardDesc}>
                  {incident.events?.[0]?.description || incident.decision_reasoning?.substring(0, 100) + '...'}
                </p>
                {incident.events && incident.events[0]?.extracted_iocs && (
                  <div className={styles.iocList}>
                    {incident.events[0].extracted_iocs.map((ioc: any, idx: number) => {
                       const enr = incident.enrichments?.find((e: any) => e.ioc.value === ioc.value);
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
                )}
              </div>
              <div className={styles.cardRight}>
                <div className={styles.timestamp}>
                  {new Date(incident.created_at).toLocaleString()}
                </div>
                <button 
                  className={styles.viewButton}
                  onClick={() => router.push(`/incidents/${incident.id}`)}
                >
                  View Full Report <ChevronRight size={16} />
                </button>
              </div>
            </GlassCard>
          ))
        )}
      </div>
    </div>
  );
}
