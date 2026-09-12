import { Component, type ReactNode } from 'react';
import { addSystemLog } from '../lib/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary. Prevents an unexpected render crash from blanking the
 * whole screen on native (iOS/Android). Shows a recoverable message instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: any): State {
    return { hasError: true, message: err?.message || String(err) };
  }

  componentDidCatch(error: any, info: any) {
    addSystemLog(`App crashed: ${error?.message || error}`, 'error');
    console.error('lifeOS crashed:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoDashboard = () => {
    window.location.href = '/';
  };

  handleCopyError = () => {
    if (this.state.message) {
      navigator.clipboard?.writeText(this.state.message).catch(() => {});
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 shadow-lg text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 text-xl font-bold">!</div>
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. Your data is safe.
            </p>
            {this.state.message ? (
              <div className="text-left bg-muted/60 border border-border/80 rounded-lg p-3 text-xs font-mono text-destructive break-all max-h-36 overflow-y-auto">
                {this.state.message}
              </div>
            ) : null}
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full rounded-lg bg-primary text-primary-foreground font-medium h-11 hover:bg-primary/90 transition-colors"
              >
                Reload App
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={this.handleGoDashboard}
                  className="flex-1 rounded-lg border border-border bg-muted/50 text-foreground font-medium h-10 hover:bg-muted transition-colors text-sm"
                >
                  Go to Dashboard
                </button>
                {this.state.message ? (
                  <button
                    type="button"
                    onClick={this.handleCopyError}
                    className="rounded-lg border border-border bg-muted/50 px-3 text-muted-foreground font-medium h-10 hover:bg-muted transition-colors text-xs"
                    title="Copy error to clipboard"
                  >
                    Copy Error
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
