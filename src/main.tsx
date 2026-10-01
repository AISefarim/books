import {StrictMode, Suspense, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// /studio is the admin-only research/speech tool. It is lazy-loaded so regular
// visitors never download it; the worker rejects any request without the admin key.
const StudioPage = lazy(() => import('./components/StudioPage'));
const isStudio = window.location.pathname === '/studio';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isStudio ? (
      <Suspense fallback={null}>
        <StudioPage />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
