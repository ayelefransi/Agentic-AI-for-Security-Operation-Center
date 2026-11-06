"use client";

import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <AppSidebar />
      <div className="main-content">
        <AppHeader />
        <main className="page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
