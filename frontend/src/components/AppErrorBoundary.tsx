import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('FO3 Service Desk render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#F0F3F7', fontFamily: 'system-ui, sans-serif' }}>
        <section style={{ width: 'min(620px, 100%)', background: '#fff', border: '1px solid #F0B7B7', borderRadius: 8, padding: 24, color: '#1A2A3A' }}>
          <h1 style={{ marginTop: 0, color: '#8B1A1A', fontSize: 20 }}>FO3 Service Desk could not load</h1>
          <p style={{ lineHeight: 1.5 }}>Refresh the page once. If this continues, share the technical detail below with the system administrator.</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 12, background: '#FDE8E8', borderRadius: 4, fontSize: 12 }}>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} style={{ padding: '9px 14px', border: 0, borderRadius: 4, background: '#0D3B6E', color: '#fff', cursor: 'pointer' }}>Refresh page</button>
        </section>
      </main>
    );
  }
}
