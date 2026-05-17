import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error);
      }

      return (
        <div className="card border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400">Something went wrong</h3>
              <p className="mt-1 text-sm text-slate-400">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              {this.props.showDetails && this.state.error && (
                <pre className="mt-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">
                  {this.state.error.stack}
                </pre>
              )}
              {this.props.onRetry && (
                <button
                  onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                  className="mt-3 rounded bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
