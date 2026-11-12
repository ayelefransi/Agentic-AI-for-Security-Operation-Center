import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'አውራ AI',
  description: 'Autonomous threat intelligence and incident triage',
};

/**
 * Root layout for አውራ AI SOC Platform.
 * Dark-only theme. Geist typeface. No theme toggle.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <ErrorBoundary>
          <AppShell>{children}</AppShell>
        </ErrorBoundary>
      </body>
    </html>
  );
}
