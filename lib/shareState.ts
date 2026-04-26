import { VisualizerType } from '../store/usePlayerStore';
import { VisualizerRegistry } from './visualizerRegistry';
import { VisualizerControl } from './visualizers/BaseVisualizer';

export interface ShareState {
  v: VisualizerType;
  c: Record<string, number>;
  d: boolean;
}

export function buildShareUrl(
  mixSlug: string,
  vizType: VisualizerType,
  controls: VisualizerControl[],
  darkMode: boolean
): string {
  const defaults = VisualizerRegistry.getDefaultConfig(vizType, false);
  const deltas: Record<string, number> = {};

  controls.forEach(({ key, value }) => {
    if (defaults[key] !== value) {
      deltas[key] = value;
    }
  });

  const state: ShareState = { v: vizType, c: deltas, d: darkMode };
  const encoded = btoa(JSON.stringify(state))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/track/${mixSlug}?viz=${encoded}`;
}

export function parseShareParam(param: string): ShareState | null {
  try {
    const padded = param + '==='.slice((param.length + 3) % 4);
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    const state = JSON.parse(json);
    if (state && typeof state.v === 'string' && state.c && typeof state.c === 'object') {
      // Default d to true for old links that predate the darkMode field
      if (typeof state.d !== 'boolean') state.d = true;
      return state as ShareState;
    }
    return null;
  } catch {
    return null;
  }
}
