// Data clock. Never touches rendering.
export function connect({ onEvent, onStatus, onResolved, url = '/api/stream' }) {
  const es = new EventSource(url);
  es.addEventListener('cinema', (m) => {
    try { onEvent(JSON.parse(m.data)); } catch { /* ignore a bad frame */ }
  });
  es.addEventListener('status', (m) => {
    try { onStatus?.(JSON.parse(m.data)); } catch { /* ignore */ }
  });
  es.addEventListener('resolved', (m) => {
    try { onResolved?.(JSON.parse(m.data)); } catch { /* ignore */ }
  });
  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) return;
    onStatus?.({ state: 'reconnecting' });
  };
  return () => es.close();
}