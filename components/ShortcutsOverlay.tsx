import React from 'react';
import { SHORTCUT_HINTS } from '../lib/useKeyboardShortcuts';

interface ShortcutsOverlayProps {
  open: boolean;
  darkMode: boolean;
  onClose: () => void;
}

/**
 * The keyboard shortcut list, opened with `?`.
 *
 * Rows come from SHORTCUT_HINTS, which sits beside the key bindings
 * themselves, so this can't end up advertising a key that no longer fires.
 */
export default function ShortcutsOverlay({ open, darkMode, onClose }: ShortcutsOverlayProps) {
  if (!open) return null;

  const panel = darkMode
    ? 'bg-black/85 border-white/15 text-white'
    : 'bg-white/95 border-black/10 text-neutral-900';
  const chip = darkMode
    ? 'bg-white/10 border-white/20 text-white'
    : 'bg-black/5 border-black/15 text-neutral-800';
  const subtle = darkMode ? 'text-white/50' : 'text-neutral-500';
  const closeBtn = darkMode
    ? 'text-white/50 hover:text-white hover:bg-white/10'
    : 'text-neutral-500 hover:text-neutral-900 hover:bg-black/10';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      {/* Click anywhere off the panel to dismiss */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className={`relative w-full max-w-xs rounded-xl border backdrop-blur-xl shadow-2xl overflow-hidden ${panel}`}>
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h2 className="text-sm font-semibold tracking-wide">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className={`w-7 h-7 -mr-1 rounded-full flex items-center justify-center transition-colors ${closeBtn}`}
            aria-label="Close shortcuts"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="px-4 pb-3">
          {SHORTCUT_HINTS.map((hint) => (
            <li key={hint.keys} className="flex items-center justify-between gap-4 py-1.5 text-sm">
              <span>{hint.label}</span>
              <kbd className={`px-2 py-0.5 rounded border text-xs font-mono whitespace-nowrap ${chip}`}>
                {hint.keys}
              </kbd>
            </li>
          ))}
        </ul>

        <p className={`px-4 pb-3.5 text-[11px] leading-snug ${subtle}`}>
          Esc closes. Shortcuts pause while you&rsquo;re typing.
        </p>
      </div>
    </div>
  );
}
