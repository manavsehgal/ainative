"use client";
import React from "react";

/**
 * Minimal error boundary for wrapping fragile render paths (e.g. third-party
 * markdown renderers, dynamic content). Falls back to the provided node when
 * a descendant throws. Logs via `console.warn` so failures stay visible
 * without crashing the host page.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("ErrorBoundary caught:", err);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
