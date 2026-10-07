import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAnalytics } from './lib/analytics';

// /studio is the admin-only research/speech tool. It is lazy-loaded so regular
// visitors never download it; the worker rejects any request without the admin key.
const StudioPage = lazy(() => import('./components/StudioPage'));
const isStudio = window.location.pathname === '/studio';
const DafStatsPage = lazy(() => import('./components/DafStatsPage'));
const isStats = window.location.pathname === '/stats';
const JoinPage = lazy(() => import('./components/JoinPage'));
const isJoin = /^\/join\/?$/.test(window.location.pathname);

if (!isStats && !isStudio) startAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isJoin ? (
      <Suspense fallback={null}>
        <JoinPage />
      </Suspense>
    ) : isStats ? (
      <Suspense fallback={null}>
        <DafStatsPage />
      </Suspense>
    ) : isStudio ? (
      <Suspense fallback={null}>
        <StudioPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
