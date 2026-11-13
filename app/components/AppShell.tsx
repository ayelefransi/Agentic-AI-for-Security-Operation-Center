'use client';

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';
import { PageTransition } from './motion';

/* ── Search context ── */
interface SearchContextValue {
  query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextValue>({
  query: '',
  setQuery: () => {},
});

export function useSearch(): SearchContextValue {
  return useContext(SearchContext);
}

/* ── Shell ── */
const PUBLIC_ROUTES = ['/', '/login'];

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  const [query, setQueryRaw] = useState('');
  const setQuery = useCallback((q: string) => setQueryRaw(q), []);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('awra-sidebar-collapsed') === 'true';
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('awra-sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <SearchContext.Provider value={{ query, setQuery }}>
      <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <div className="app-main">
          <AppHeader onOpenMobileNav={() => setMobileOpen(true)} />
          <main className="app-content">
            <PageTransition routeKey={pathname}>{children}</PageTransition>
          </main>
        </div>
      </div>
    </SearchContext.Provider>
  );
}
