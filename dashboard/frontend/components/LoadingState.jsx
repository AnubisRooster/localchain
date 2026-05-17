export function Spinner({ size = "md", className = "" }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className={`inline-block ${className}`}>
      <svg
        className={`animate-spin text-slate-400 ${sizeClasses[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

export function LoadingState({ message = "Loading...", size = "md", className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 text-slate-500 ${className}`}>
      <Spinner size={size} />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function LoadingCard({ message = "Loading data..." }) {
  return (
    <div className="card">
      <LoadingState message={message} size="sm" />
    </div>
  );
}

export function LoadingRow({ cols = 4 }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8">
        <div className="flex items-center justify-center gap-3 text-slate-500">
          <Spinner size="sm" />
          <span className="text-sm">Loading...</span>
        </div>
      </td>
    </tr>
  );
}

export function ErrorState({ message = "An error occurred", error, onRetry, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}>
      <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-red-400">{message}</p>
      {error && (
        <p className="text-xs text-slate-500 max-w-md text-center">{error}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded bg-red-500/20 px-4 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorBanner({ title = "Connection Error", message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-red-400">{title}</h4>
          <p className="mt-1 text-sm text-slate-400">{message}</p>
        </div>
        {onDismiss && (
          <button onClick={onDismiss} className="text-slate-500 hover:text-slate-300">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
