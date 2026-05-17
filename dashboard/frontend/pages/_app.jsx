import Layout from "../components/Layout";
import ErrorBoundary from "../components/ErrorBoundary";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <div className="flex min-h-screen items-center justify-center bg-slate-900 p-8">
          <div className="max-w-lg text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-2">Application Error</h1>
            <p className="text-slate-400 mb-4">The dashboard encountered an unexpected error.</p>
            <pre className="text-xs text-slate-500 bg-slate-800 p-4 rounded-lg overflow-auto">{error?.message}</pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 transition-colors"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      )}
    >
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ErrorBoundary>
  );
}
