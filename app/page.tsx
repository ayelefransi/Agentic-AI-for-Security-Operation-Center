"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ShieldAlert, ShieldCheck, Activity, Cpu, Play, Search, AlertOctagon, TerminalSquare, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import styles from "./page.module.css";

// Framer Motion Variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const typeWriterLine = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } }
};

export default function Home() {
  const [alertText, setAlertText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzeAlert = async () => {
    if (!alertText.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const response = await fetch(`${apiUrl}/api/analyze-alert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert: alertText }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred connecting to the Secure Network.");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (decision: string) => {
    if (decision?.includes("True Positive")) return styles.severityCritical;
    if (decision?.includes("False Positive")) return styles.severityLow;
    return styles.severityHigh;
  };

  const getDecisionIcon = (decision: string) => {
    if (decision?.includes("True Positive")) return <AlertOctagon size={28} className={styles.severityCritical} />;
    if (decision?.includes("False Positive")) return <ShieldCheck size={28} className={styles.severityLow} />;
    return <Search size={28} className={styles.severityHigh} />;
  };

  const mockChartData = [
    { time: "Day -7", volume: Math.floor(Math.random() * 10), severity: 20 },
    { time: "Day -6", volume: Math.floor(Math.random() * 20), severity: 25 },
    { time: "Day -5", volume: Math.floor(Math.random() * 15), severity: 40 },
    { time: "Day -4", volume: Math.floor(Math.random() * 30), severity: 30 },
    { time: "Day -3", volume: Math.floor(Math.random() * 45), severity: 55 },
    { time: "Day -2", volume: Math.floor(Math.random() * 60), severity: 80 },
    { time: "Today", volume: Math.floor(Math.random() * 90 + 30), severity: 95 },
  ];

  return (
    <>
      <div className="cyber-bg"></div>
      <div className="cyber-grid"></div>
      
      <main className={styles.container}>
        <motion.header 
          initial={{ opacity: 0, y: -40, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={styles.header}
        >
          <h1 className={styles.title}>NEXUS Command</h1>
          <p className={styles.subtitle}>
            Agentic Threat Intelligence & Orchestration
          </p>
        </motion.header>

        <div className={styles.mainGrid}>
          
          {/* Left Side: Input */}
          <motion.section 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={styles.inputSection}
          >
            <div className={styles.inputHeader}>
              <TerminalSquare size={20} />
              <span>Secure Telemetry Uplink</span>
            </div>
            
            <motion.div 
              className={styles.textareaBox}
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <textarea
                className={styles.textarea}
                placeholder="// INJECT RAW LOG, EDR PAYLOAD, OR SYSTEM TELEMETRY HERE..."
                value={alertText}
                onChange={(e) => setAlertText(e.target.value)}
              />
            </motion.div>

            <button
              className={styles.submitBtn}
              onClick={analyzeAlert}
              disabled={loading || !alertText.trim()}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Activity className="spin" size={18} /> DECRYPTING...
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Play size={18} fill="currentColor" /> INITIATE OVERRIDE
                </span>
              )}
            </button>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: "hidden", marginTop: "16px" }}
                >
                  <div style={{ padding: "16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239,68,68,0.5)", borderRadius: "4px", color: "var(--danger)", display: "flex", alignItems: "center", gap: "12px", fontFamily: "monospace" }}>
                    <ShieldAlert size={20} />
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>

          {/* Right Side: Results */}
          <section className={styles.resultsSection}>
            <AnimatePresence mode="wait">
              {!result && !loading && (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(5px)" }}
                  className={`hologram-panel ${styles.emptyState}`}
                >
                  <Cpu className={styles.emptyStateIcon} strokeWidth={1} />
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#fff", letterSpacing: "0.1em" }}>SYSTEM STANDBY</div>
                  <p style={{ maxWidth: "300px", fontFamily: "monospace", marginTop: "16px" }}>AWAITING DIRECTIVE FROM HOST</p>
                </motion.div>
              )}

              {loading && (
                 <motion.div 
                   key="loading"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0, filter: "blur(10px)" }}
                   className="hologram-panel"
                   style={{ minHeight: "500px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
                 >
                    <div className={styles.neuralContainer}>
                      <div className={styles.neuralCore}></div>
                      <div className={styles.neuralOrbit}></div>
                      <div className={styles.neuralOrbit} style={{ animationDirection: "reverse", animationDuration: "4s", transform: "rotateX(30deg)" }}></div>
                    </div>
                    <div style={{ display: "flex", gap: "12px", marginBottom: "24px", color: "var(--accent-cyan)", fontFamily: "monospace", letterSpacing: "2px" }}>
                      <Activity size={18} className="spin" /> ESTABLISHING NEURAL LINK...
                    </div>
                 </motion.div>
              )}

              {result && !loading && (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  <div className={styles.glassGrid}>
                    <motion.div whileHover={{ scale: 1.02, rotateY: 5 }} className={`hologram-panel ${styles.metricCard}`} style={{ perspective: "1000px" }}>
                      <div className={styles.metricLabel}><Activity size={16} /> Loop Depth</div>
                      <div className={styles.metricValue} style={{ color: "var(--accent-cyan)" }}>
                        {result.iterations || 1} <span style={{fontSize: "0.8rem", color: "rgba(255,255,255,0.3)"}}>CYCLES</span>
                      </div>
                    </motion.div>
                    
                    <motion.div whileHover={{ scale: 1.02, rotateY: -5 }} className={`hologram-panel ${styles.metricCard}`} style={{ perspective: "1000px" }}>
                      <div className={styles.metricLabel}><ShieldAlert size={16} /> Resolution</div>
                      <div className={`${styles.metricValue} ${getSeverityStyle(result.structured_json?.decision)}`} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {getDecisionIcon(result.structured_json?.decision)}
                        <span>{result.structured_json?.decision || "UNKNOWN"}</span>
                      </div>
                    </motion.div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="hologram-panel" style={{ marginTop: "24px", padding: "32px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px", borderBottom: "1px solid rgba(0,255,255,0.2)", paddingBottom: "16px" }}>
                      <TrendingUp size={20} color="var(--accent-cyan)" />
                      <h3 style={{ fontSize: "1.2rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-cyan)" }}>Telemetry Correlation</h3>
                    </div>
                    <div style={{ width: "100%", height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={mockChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.6}/>
                              <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorSeverity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.5}/>
                              <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: "rgba(0, 0, 0, 0.9)", border: "1px solid var(--accent-cyan)", borderRadius: "4px", color: "#fff", fontFamily: "monospace" }}
                            itemStyle={{ color: "var(--accent-cyan)" }}
                          />
                          <Area type="monotone" dataKey="volume" name="Signal Activity" stroke="var(--accent-cyan)" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                          <Area type="monotone" dataKey="severity" name="Threat Gravity" stroke="var(--danger)" strokeWidth={2} fillOpacity={1} fill="url(#colorSeverity)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>

                  <motion.div className="hologram-panel" style={{ marginTop: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                      <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "#fff", letterSpacing: "0.1em" }}>
                        <Copy size={20} color="var(--accent-cyan)" /> 
                        DECRYPTED INTELLIGENCE BRIEF
                      </h3>
                      <div style={{ padding: "4px 12px", border: "1px solid var(--accent-cyan)", background: "rgba(0,255,255,0.1)", color: "var(--accent-cyan)", fontFamily: "monospace", fontSize: "0.85rem" }}>
                         AUTH: VERIFIED
                      </div>
                    </div>
                    
                    <motion.div 
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      className={styles.markdownBody}
                    >
                      {result.report ? result.report.split('\n').map((line: string, i: number) => {
                          if (!line.trim()) return null;
                          
                          let parsedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                          parsedLine = parsedLine.replace(/`([^`]+)`/g, '<code style="background: rgba(0,255,255,0.1); color: var(--accent-cyan); padding: 2px 6px; border-radius: 2px; border: 1px solid rgba(0,255,255,0.2); font-family: monospace;">$1</code>');
                          
                          const headerMatch = parsedLine.trim().match(/^(#{1,6})\s+(.*)$/);
                          if (headerMatch) {
                             return <motion.h3 variants={typeWriterLine} key={i} style={{ marginTop: "32px", marginBottom: "16px", paddingBottom: "8px", borderBottom: "1px dashed rgba(0,255,255,0.3)" }} dangerouslySetInnerHTML={{ __html: headerMatch[2] }} />;
                          } 
                          else if (parsedLine.trim().startsWith('- ')) {
                             return (
                               <motion.ul variants={typeWriterLine} key={i} style={{ margin: "0 0 12px 24px", display: "flex", flexDirection: "column", gap: "8px" }}>
                                 <li dangerouslySetInnerHTML={{ __html: parsedLine.replace('- ', '') }} />
                               </motion.ul>
                             );
                          }
                          
                          return <motion.p variants={typeWriterLine} key={i} dangerouslySetInnerHTML={{ __html: parsedLine }} />;
                      }) : (
                         <pre style={{ color: "rgba(255,255,255,0.5)", whiteSpace: "pre-wrap" }}>
                           {JSON.stringify(result.structured_json, null, 2)}
                         </pre>
                      )}
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>
    </>
  );
}
