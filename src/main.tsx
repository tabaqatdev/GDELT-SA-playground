import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

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

createRoot(rootElement).render(<App />);
