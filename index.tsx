import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import './index.css';
import { ErrorFallback } from './components/ErrorFallback';

// --- ROBUSTNESS PATCH ---
// Fix for "Failed to execute 'removeChild' on 'Node'" error common in managed environments
// where browser extensions or translation tools modify the DOM directly.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    try {
      return originalRemoveChild.call(this, child) as T;
    } catch (error) {
      console.warn("DOM Interference detected (likely Translation/Extension). Suppressing 'removeChild' error to prevent crash.");
      // Return child as if success to satisfy React internals
      return child;
    }
  };
}

// SAFE ENVIRONMENT CHECK
// We use type casting (as any) to prevent TypeScript errors (TS2339) when the 
// compiler context doesn't fully load Vite types (e.g. in strict tsc runs).
const getEnvVar = (key: string) => {
  // Check Vite/ESM environment
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viteMeta = typeof import.meta !== 'undefined' ? (import.meta as any) : undefined;
  
  if (viteMeta && viteMeta.env && viteMeta.env[key]) {
    return viteMeta.env[key];
  }
  
  // Check Node/Process environment
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

const isProduction = 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD) || 
  (typeof process !== 'undefined' && process.env.NODE_ENV === 'production');

const sentryDsn = getEnvVar('VITE_SENTRY_DSN') || getEnvVar('SENTRY_DSN');

// Initialize Sentry only if DSN is present
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: isProduction ? 'production' : 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, 
    // Session Replay
    replaysSessionSampleRate: 0.1, 
    replaysOnErrorSampleRate: 1.0, 
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={({ error, resetError }) => <ErrorFallback error={error as Error} resetErrorBoundary={resetError} />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
