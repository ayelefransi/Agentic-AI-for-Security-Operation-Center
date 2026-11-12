"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';
import SystemError from './SystemError';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component to catch React errors and display fallback UI.
 * 
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Send to error tracking service (e.g., Sentry)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
      // Sentry.captureException(error, { extra: errorInfo });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{ padding: '2rem' }}>
          <SystemError
            message={this.state.error?.message || 'An unexpected error occurred'}
            onRetry={this.handleReset}
          />
          
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details style={{ marginTop: '1rem', whiteSpace: 'pre-wrap' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                Error Details (Development Only)
              </summary>
              <pre style={{ 
                fontSize: '12px', 
                background: 'var(--bg-elevated)', 
                padding: '1rem',
                borderRadius: '4px',
                overflow: 'auto'
              }}>
                {this.state.error?.stack}
                {'\n\n'}
                Component Stack:
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
