import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { posthog } from 'posthog-js';
import { PostHogProvider } from '@posthog/react';

// Initialize PostHog
if (import.meta.env.VITE_PUBLIC_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    person_profiles: 'identified_only',
  } as Parameters<typeof posthog.init>[1]);
}

if (import.meta.env.PROD) {
  console.log = () => {};
  // Optional: Disable others if strict
  // console.info = () => {};
  // console.debug = () => {};
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <PostHogProvider client={posthog}>
    <App />
  </PostHogProvider>
);
