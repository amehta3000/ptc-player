/**
 * Shared typography machinery: loads the current Google Font and registers
 * the Cmd/Ctrl+D debug shortcut that reveals the font selector. Used by the
 * main player and the Studio so the font system behaves identically on both.
 */

import { useEffect } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

export function useFontTools() {
  const currentFont = usePlayerStore((s) => s.currentFont);
  const setCurrentFont = usePlayerStore((s) => s.setCurrentFont);
  const showDebug = usePlayerStore((s) => s.showDebug);
  const setShowDebug = usePlayerStore((s) => s.setShowDebug);

  // Load the selected Google Font
  useEffect(() => {
    const fontFamily = currentFont.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [currentFont]);

  // Debug mode keyboard shortcut (Cmd/Ctrl + D) — reveals the font selector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebug(!usePlayerStore.getState().showDebug);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowDebug]);

  return { currentFont, setCurrentFont, showDebug };
}
