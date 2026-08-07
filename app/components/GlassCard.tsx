import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  hoverEffect?: boolean;
}

export default function GlassCard({ children, className = '', delay = 0, hoverEffect = false }: GlassCardProps) {
  const baseClasses = "hologram-panel";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={hoverEffect ? { y: -4, boxShadow: "0 12px 30px rgba(0,200,83,0.15)" } : {}}
      className={`${baseClasses} ${className}`}
    >
      {children}
    </motion.div>
  );
}
