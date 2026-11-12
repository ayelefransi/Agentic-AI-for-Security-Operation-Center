"use client";

import type { ReactNode, KeyboardEvent } from 'react';
import styles from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  skeletonCount?: number;
  emptyMessage?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

/** Accessible keyboard-navigable table rendered inside a denser glass surface. */
export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  loading = false,
  skeletonCount = 5,
  emptyMessage = 'No records available.',
  emptyActionLabel,
  onEmptyAction,
}: DataTableProps<T>) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  if (loading) {
    return (
      <div className={styles.skeletonWrap} aria-busy="true" aria-label="Loading table">
        {Array.from({ length: skeletonCount }).map((_, idx) => (
          <div key={idx} className={styles.skeletonRow} />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyMessage}>{emptyMessage}</p>
        {emptyActionLabel && onEmptyAction && (
          <button type="button" className={styles.emptyActionBtn} onClick={onEmptyAction}>
            {emptyActionLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={onRowClick ? e => handleKeyDown(e, row) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              role={onRowClick ? 'button' : undefined}
              className={onRowClick ? styles.clickableRow : undefined}
            >
              {columns.map(col => (
                <td key={col.key} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
