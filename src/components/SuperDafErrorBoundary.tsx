import React from 'react';

// If anything in Super Daf throws while drawing, show what happened and a way back instead of a blank white page.
export class SuperDafErrorBoundary extends React.Component<{ children: React.ReactNode; dafRef: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Super Daf crashed', error, info?.componentStack);
    try {
      // tell the server which daf and what error, so it can be fixed without a screenshot
      fetch('https://aisefarim-chat.abrahamserouya.workers.dev/daf/open', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: this.props.dafRef, src: 'crash' }) }).catch(() => {});
    } catch { /* ignore */ }
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: '#141416', color: '#e8e6e3', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Super Daf hit a problem on this page.</p>
          <p style={{ fontSize: 14, opacity: 0.8, margin: '0 0 16px' }}>Please send a screenshot of this message to AI Sefarim so it can be fixed.</p>
          <pre style={{ fontSize: 12, textAlign: 'left', whiteSpace: 'pre-wrap', background: '#202024', padding: 12, borderRadius: 10, maxHeight: 200, overflow: 'auto' }}>{`${this.props.dafRef}\n${e.name}: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}\n${navigator.userAgent}`}</pre>
          <button onClick={() => location.reload()} style={{ marginTop: 16, padding: '10px 22px', borderRadius: 999, background: '#5b5fd6', color: '#fff', fontWeight: 700, border: 0, fontSize: 15 }}>Reload</button>
        </div>
      </div>
    );
  }
}
