import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function ErrorFallback({error}: {error: Error}) {
  return (
    <div className="error-boundary" style={{
      padding: '20px',
      textAlign: 'center',
      color: 'white',
      backgroundColor: '#1f2937'
    }}>
      <h2>Something went wrong</h2>
      <p>Please refresh the page to try again.</p>
      <details style={{ marginTop: '10px', textAlign: 'left' }}>
        <summary>Error Details</summary>
        <pre style={{ 
          backgroundColor: '#374151', 
          padding: '10px', 
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '12px'
        }}>
          {error.message}
        </pre>
      </details>
    </div>
  );
}

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{error: Error}> },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return <this.props.fallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fallback={ErrorFallback}>
    <App />
  </ErrorBoundary>
);
