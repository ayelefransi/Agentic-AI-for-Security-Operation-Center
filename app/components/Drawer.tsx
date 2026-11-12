"use client";

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from './Drawer.module.css';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Accessible slide-over side drawer supporting Esc close and focus handoff. */
export default function Drawer({
  open,
  title,
  onClose,
  children,
  footer,
}: DrawerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <aside
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </aside>
    </>
  );
}
