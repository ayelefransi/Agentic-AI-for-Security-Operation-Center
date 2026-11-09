import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './contexts/ThemeContext';
import LayoutShell from './components/LayoutShell';
import ErrorBoundary from './components/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NEXUS Command | SOC Platform',
  description: 'Agentic Threat Intelligence & Orchestration',
};

/**
 * Root layout component for the NEXUS Command SOC Platform.
 * 
 * Provides:
 * - Global fonts (Inter for UI, JetBrains Mono for code)
 * - Theme provider for light/dark mode
 * - Error boundary for crash recovery
 * - Layout shell with navigation
 * 
 * @param children - Page content to render
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <ErrorBoundary>
          <ThemeProvider>
            <LayoutShell>{children}</LayoutShell>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
