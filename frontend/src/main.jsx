import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Ensure document root is always dark and remove any legacy light theme classes
if (typeof document !== 'undefined') {
  document.documentElement.classList.remove('light');
  document.documentElement.classList.add('dark');
  document.documentElement.setAttribute('data-theme', 'dark');
  try {
    localStorage.removeItem('codeo_theme');
  } catch {}
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
