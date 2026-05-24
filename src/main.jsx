import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameProvider } from './context/GameContext';
import './styles/index.css';
import { initGA } from './utils/analytics';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GameProvider>
      <App />
    </GameProvider>
  </React.StrictMode>
);

// Initialize GA4 only in production and when VITE_GA_ID is provided
if (import.meta.env.PROD && import.meta.env.VITE_GA_ID) {
  initGA(import.meta.env.VITE_GA_ID);
}
