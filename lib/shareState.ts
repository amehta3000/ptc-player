import { VisualizerType } from '../store/usePlayerStore';
import { VisualizerRegistry } from './visualizerRegistry';
import { VisualizerControl } from './visualizers/BaseVisualizer';

export interface ShareState {
  v: VisualizerType;
  c: Record<string, number>;
  d: boolean;
}

function encodeShareState(
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
  return btoa(JSON.stringify(state))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function buildShareUrl(
  mixSlug: string,
  vizType: VisualizerType,
  controls: VisualizerControl[],
  darkMode: boolean
): string {
  const encoded = encodeShareState(vizType, controls, darkMode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/track/${mixSlug}?viz=${encoded}`;
}

/**
 * Studio share: captures the visual setup only (visualizer, controls,
 * mirror, dark mode). The receiver uploads their own track and the vibe
 * loads around it.
 */
export function buildStudioShareUrl(
  vizType: VisualizerType,
  controls: VisualizerControl[],
  darkMode: boolean
): string {
  const encoded = encodeShareState(vizType, controls, darkMode);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/studio?viz=${encoded}`;
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
