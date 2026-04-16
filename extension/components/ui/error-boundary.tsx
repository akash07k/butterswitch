/**
 * @module components/ui/error-boundary
 *
 * React error boundary that catches rendering errors and displays
 * an accessible fallback instead of a blank white page.
 *
 * Used in popup and options page root to prevent a single component
 * crash from taking down the entire UI.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  /** The component tree to wrap. */
  children: ReactNode;
  /** Context label for the error message (e.g., "Popup", "Options"). */
  context?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors in child components and displays
 * an accessible error message instead of crashing to blank.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ButterSwitch ${this.props.context ?? "UI"}] Rendering error:`, error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main role="alert" className="p-6 max-w-lg mx-auto">
          <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">
            ButterSwitch encountered an error. Try reloading the extension.
          </p>
          <pre className="text-sm bg-muted p-3 rounded overflow-auto max-h-40">
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 rounded border border-input bg-transparent text-sm hover:bg-accent"
          >
            Try Again
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}
