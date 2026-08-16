import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// React has no hook equivalent for catching render-time errors — a class
// component with getDerivedStateFromError/componentDidCatch is still the
// only mechanism. Without one anywhere in this app, any uncaught render
// exception (e.g. calling a Number-only method on a value that turned out
// to be a string from the API) silently unmounted the whole tree to a
// blank white page — found live 2026-08-16 via a crash on /metrics.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page">
          <div className="card empty-state">
            <p>Something went wrong loading this page.</p>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
