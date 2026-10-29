/**
 * Global keyboard shortcuts for the player.
 *
 * Handlers are held in a ref and refreshed every render, so the listener is
 * attached once but always calls the current closures. Binding them directly
 * would freeze whichever versions existed when the effect first ran.
 */

import { useEffect, useRef } from 'react';

export interface KeyboardShortcutHandlers {
  /** Space — only when nothing is focused, so it still activates buttons. */
  onTogglePlay: () => void;
  onToggleInfo: () => void;
  onToggleDarkMode: () => void;
  onToggleControls: () => void;
  onToggleRecording: () => void;
  onTogglePlaylist: () => void;
  onVolumeUp: () => void;
  onVolumeDown: () => void;
}

/** Typing somewhere shouldn't trigger shortcuts. */
function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node || typeof node.tagName !== 'string') return false;
  if (node.isContentEditable) return true;
  const tag = node.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Leave every browser and OS combination alone — Cmd+R has to reload
      // the page and Cmd+D has to reach the font tools, not record a take
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const h = ref.current;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          h.onVolumeUp();
          return;
        case 'ArrowDown':
          e.preventDefault();
          h.onVolumeDown();
          return;
        case ' ':
          // Only when focus is nowhere: space is also how a focused button is
          // pressed, and handling it here too would fire both
          if (e.target !== document.body) return;
          e.preventDefault();
          h.onTogglePlay();
          return;
      }

      switch (e.key.toLowerCase()) {
        case 'i':
          e.preventDefault();
          h.onToggleInfo();
          break;
        case 'd':
          e.preventDefault();
          h.onToggleDarkMode();
          break;
        case 'c':
          e.preventDefault();
          h.onToggleControls();
          break;
        case 'r':
          e.preventDefault();
          h.onToggleRecording();
          break;
        case 'p':
          e.preventDefault();
          h.onTogglePlaylist();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
