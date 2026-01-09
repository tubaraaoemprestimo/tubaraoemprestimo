import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Register service worker for PWA support (Safe check)
if ('serviceWorker' in navigator) {
  // Avoid registration in specific preview environments if causing issues
  const isPreview = window.location.hostname.includes('content.goog');
  
  if (!isPreview) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW fail', err));
    });
  }
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);