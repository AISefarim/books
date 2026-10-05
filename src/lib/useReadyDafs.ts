import { useEffect, useState } from 'react';
import { loadReadyDafs } from './daf';

export function useReadyDafs(): Set<string> {
  const [ready, setReady] = useState<Set<string>>(new Set());
  useEffect(() => { let alive = true; loadReadyDafs().then((s) => { if (alive) setReady(s); }); return () => { alive = false; }; }, []);
  return ready;
}
