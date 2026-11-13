'use client';

/**
 * Shared motion primitives. Every effect is short, one-shot and only fires
 * when something actually changes. All of them render their final state
 * immediately when the user has "reduce motion" turned on.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

const groupVariants: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Staggers the entrance of its <Reveal> children once, on mount. */
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={groupVariants} initial="hidden" animate="shown">
      {children}
    </motion.div>
  );
}

/** Rises 8px and fades in; inherits timing from a parent RevealGroup. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  );
}

/**
 * Animates a number from its previous value to the new one over 600 ms.
 * Width stays stable because numerals are tabular (set globally).
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const fromRef = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const duration = 600;
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (value - from) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      fromRef.current = value;
    };
  }, [value, reduce]);

  return (
    <span className={className}>
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * Returns "value-flash" for one animation cycle after `value` changes
 * (never on first render). Pair with the global .value-flash keyframes.
 */
export function useFlashOnChange(value: unknown): string {
  const first = useRef(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((n) => n + 1);
  }, [value]);
  useEffect(() => {
    if (!tick) return;
    const id = setTimeout(() => setTick(0), 950);
    return () => clearTimeout(id);
  }, [tick]);
  return tick ? 'value-flash' : '';
}

/**
 * Remembers which keys were present on the previous render and reports the
 * new ones, so live lists can highlight rows that just arrived. Rows present
 * on the very first render are never treated as new.
 */
export function useNewKeys(keys: string[]): Set<string> {
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const signature = keys.join('|');

  useEffect(() => {
    const current = new Set(signature ? signature.split('|') : []);
    if (seen.current === null) {
      seen.current = current;
      return;
    }
    const added = new Set([...current].filter((k) => !seen.current!.has(k)));
    seen.current = current;
    if (added.size === 0) return;
    setFresh(added);
    const id = setTimeout(() => setFresh(new Set()), 3000);
    return () => clearTimeout(id);
  }, [signature]);

  return fresh;
}

/** Fades and lifts page content on route change. Never delays navigation. */
export function PageTransition({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      key={routeKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
