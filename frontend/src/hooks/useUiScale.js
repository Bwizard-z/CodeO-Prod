// hooks/useUiScale.js - User-adjustable UI display scale & density management
import { useState, useEffect, useCallback } from 'react';

export const UI_SCALE_OPTIONS = [
  { id: 'compact', label: 'Compact (85%)', description: 'Best for 13"-14" laptops with 150% scaling' },
  { id: 'small', label: 'Small (90%)', description: 'Comfortable fit on 14" screens' },
  { id: 'auto', label: 'Auto (Screen Adaptive)', description: 'Automatically adjusts based on window size' },
  { id: 'normal', label: 'Standard (100%)', description: 'Standard desktop scaling' },
  { id: 'large', label: 'Enlarged (110%)', description: 'Larger text and buttons' },
];

export function useUiScale() {
  const [scale, setScaleState] = useState(() => {
    try {
      return localStorage.getItem('codeo_ui_scale') || 'auto';
    } catch {
      return 'auto';
    }
  });

  const applyScale = useCallback((scaleId) => {
    const root = document.documentElement;
    if (scaleId === 'auto') {
      root.removeAttribute('data-ui-scale');
    } else {
      root.setAttribute('data-ui-scale', scaleId);
    }
  }, []);

  const setScale = useCallback((newScale) => {
    setScaleState(newScale);
    try {
      localStorage.setItem('codeo_ui_scale', newScale);
    } catch {
      // Ignored
    }
    applyScale(newScale);
  }, [applyScale]);

  useEffect(() => {
    applyScale(scale);
  }, [scale, applyScale]);

  return {
    scale,
    setScale,
    options: UI_SCALE_OPTIONS,
  };
}

export default useUiScale;
