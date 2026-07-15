import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

/** Curated {dominant, accent} palettes for one-click theming. */
const PRESETS: { name: string; dominant: string; accent: string }[] = [
  { name: 'Teal', dominant: 'rgb(38, 70, 83)', accent: 'rgb(42, 195, 191)' },
  { name: 'Sunset', dominant: 'rgb(83, 42, 58)', accent: 'rgb(255, 122, 89)' },
  { name: 'Violet', dominant: 'rgb(55, 42, 83)', accent: 'rgb(167, 120, 255)' },
  { name: 'Lime', dominant: 'rgb(38, 60, 40)', accent: 'rgb(160, 230, 90)' },
  { name: 'Gold', dominant: 'rgb(70, 55, 30)', accent: 'rgb(240, 190, 70)' },
  { name: 'Ice', dominant: 'rgb(40, 55, 75)', accent: 'rgb(120, 190, 255)' },
];

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#888888';
  const [r, g, b] = m.map((n) => parseInt(n, 10));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function ColorPicker() {
  const dominantColor = usePlayerStore((s) => s.dominantColor);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const setDominantColor = usePlayerStore((s) => s.setDominantColor);
  const setAccentColor = usePlayerStore((s) => s.setAccentColor);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="color"
            value={rgbToHex(dominantColor)}
            onChange={(e) => setDominantColor(hexToRgb(e.target.value))}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/20"
            aria-label="Dominant color"
          />
          Base
        </label>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="color"
            value={rgbToHex(accentColor)}
            onChange={(e) => setAccentColor(hexToRgb(e.target.value))}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border border-white/20"
            aria-label="Accent color"
          />
          Accent
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setDominantColor(p.dominant);
              setAccentColor(p.accent);
            }}
            title={p.name}
            className="w-7 h-7 rounded-full border border-white/20 hover:scale-110 transition-transform"
            style={{ background: `linear-gradient(135deg, ${p.dominant}, ${p.accent})` }}
            aria-label={`${p.name} palette`}
          />
        ))}
      </div>
    </div>
  );
}
