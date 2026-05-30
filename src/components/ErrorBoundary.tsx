import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-8">
          <div className="max-w-2xl w-full bg-surface border border-outline/20 rounded-xl p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="material-symbols-outlined text-[32px] text-error">error</span>
              <h2 className="text-xl font-bold text-on-surface">Something went wrong</h2>
            </div>
            <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-6 overflow-auto max-h-60">
              <p className="text-sm font-mono text-error whitespace-pre-wrap break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            {this.state.error?.stack && (
              <details className="mb-6">
                <summary className="text-sm text-on-surface-variant cursor-pointer hover:text-on-surface">Stack trace</summary>
                <pre className="mt-2 text-xs font-mono text-on-surface-variant whitespace-pre-wrap overflow-auto max-h-80 bg-black/20 rounded-lg p-3">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="px-6 py-3 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
