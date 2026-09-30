// hooks/useMonacoBinding.js - Dedicated Monaco Editor <-> Yjs Binding Hook
import { useEffect, useRef, useState } from 'react';
import { MonacoBinding } from 'y-monaco';

/**
 * useMonacoBinding
 * Binds a Yjs Y.Text instance to a Monaco Code Editor model with Awareness.
 * Automatically synchronizes keystrokes, remote cursor positions, and text selections in real-time.
 *
 * @param {object} editor - Monaco editor instance (from onMount)
 * @param {object} yText - Shared Y.Text instance from Y.Doc
 * @param {object} awareness - Awareness instance from WebsocketProvider
 * @returns {object} { binding, isBound }
 */
export function useMonacoBinding(editor, yText, awareness) {
  const bindingRef = useRef(null);
  const [isBound, setIsBound] = useState(false);

  useEffect(() => {
    if (!editor || !yText) {
      setIsBound(false);
      return;
    }

    const model = editor.getModel();
    if (!model) {
      setIsBound(false);
      return;
    }

    // Clean up any stale binding before re-creating
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }

    try {
      const binding = new MonacoBinding(
        yText,
        model,
        new Set([editor]),
        awareness || null
      );
      bindingRef.current = binding;
      setIsBound(true);
    } catch (err) {
      console.warn('[useMonacoBinding] Error initializing MonacoBinding:', err);
      setIsBound(false);
    }

    return () => {
      if (bindingRef.current) {
        bindingRef.current.destroy();
        bindingRef.current = null;
        setIsBound(false);
      }
    };
  }, [editor, yText, awareness]);

  return {
    binding: bindingRef.current,
    isBound,
  };
}

export default useMonacoBinding;
