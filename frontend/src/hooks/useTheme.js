// hooks/useTheme.js - Disabled / Reset to dark theme
import { useEffect } from 'react';

export function useTheme() {
  useEffect(() => {
    try {
      localStorage.removeItem('codeo_theme');
    } catch {}
    const root = document.documentElement;
    root.classList.remove('light');
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  }, []);

  return {
    theme: 'dark',
    isDark: true,
    setTheme: () => {},
    toggleTheme: () => {},
  };
}

export default useTheme;
