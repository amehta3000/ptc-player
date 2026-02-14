import { create } from 'zustand';
import { Mix, mixes } from '../data/mixes';

type FilterType = 'all' | 'mix' | 'track';
type RepeatMode = 'off' | 'all' | 'one';
type VisualizerType = 'bars' | 'orb' | 'web' | 'terrain' | 'chrysalis' | 'sonicGalaxy' | 'raindrops';

export type { FilterType, RepeatMode, VisualizerType };

interface PlayerState {
  // Playback
  currentMix: Mix | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffleMode: boolean;
  repeatMode: RepeatMode;

  // UI
  filter: FilterType;
  showDetail: boolean;
  showVisualizer: boolean;
  showControls: boolean;
  showPlaylist: boolean;
  showDebug: boolean;
  visualizerType: VisualizerType;
  currentFont: string;

  // Colors
  dominantColor: string;
  accentColor: string;

  // Audio data (64-bin frequency spectrum)
  audioData: number[];
}

interface PlayerActions {
  // Playback actions
  setCurrentMix: (mix: Mix | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // UI actions
  setFilter: (filter: FilterType) => void;
  setShowDetail: (show: boolean) => void;
  setShowVisualizer: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowPlaylist: (show: boolean) => void;
  setShowDebug: (show: boolean) => void;
  setVisualizerType: (type: VisualizerType) => void;
  setCurrentFont: (font: string) => void;

  // Color actions
  setDominantColor: (color: string) => void;
  setAccentColor: (color: string) => void;

  // Audio data
  setAudioData: (data: number[]) => void;

  // Computed helpers
  getFilteredMixes: () => Mix[];
  getCurrentIndex: () => number;

  // Navigation actions
  playNext: () => Mix | null;
  playPrevious: () => { action: 'restart' } | { action: 'previous'; mix: Mix } | null;
}

export const VISUALIZER_TYPES: VisualizerType[] = ['bars', 'orb', 'web', 'terrain', 'chrysalis', 'sonicGalaxy', 'raindrops'];

export const VISUALIZER_NAMES: Record<VisualizerType, string> = {
  bars: 'Bars',
  orb: 'Orb',
  web: 'Web',
  terrain: 'Terrain',
  chrysalis: 'Chrysalis',
  sonicGalaxy: 'Sonic Galaxy',
  raindrops: 'Raindrops',
};

export const FONTS = [
  'Stint Ultra Expanded',
  'Barrio',
  'Bungee Hairline',
  'Splash',
  'Cal Sans',
  'Inconsolata',
  'Kumbh Sans',
  'Nabla',
  'Barriecito',
];

export const usePlayerStore = create<PlayerState & PlayerActions>((set, get) => ({
  // Initial state
  currentMix: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  shuffleMode: false,
  repeatMode: 'off',

  filter: 'all',
  showDetail: true,
  showVisualizer: true,
  showControls: false,
  showPlaylist: false,
  showDebug: false,
  visualizerType: 'terrain',
  currentFont: 'Stint Ultra Expanded',

  dominantColor: 'rgb(115, 115, 115)',
  accentColor: 'rgb(163, 163, 163)',

  audioData: Array(64).fill(0),

  // Playback actions
  setCurrentMix: (mix) => set({ currentMix: mix }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setProgress: (progress) => set({ progress }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleShuffle: () => set((s) => ({ shuffleMode: !s.shuffleMode })),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off',
    })),

  // UI actions
  setFilter: (filter) => set({ filter }),
  setShowDetail: (show) => set({ showDetail: show }),
  setShowVisualizer: (show) => set({ showVisualizer: show }),
  setShowControls: (show) => set({ showControls: show }),
  setShowPlaylist: (show) => set({ showPlaylist: show }),
  setShowDebug: (show) => set({ showDebug: show }),
  setVisualizerType: (type) => set({ visualizerType: type }),
  setCurrentFont: (font) => set({ currentFont: font }),

  // Color actions
  setDominantColor: (color) => set({ dominantColor: color }),
  setAccentColor: (color) => set({ accentColor: color }),

  // Audio data
  setAudioData: (data) => set({ audioData: data }),

  // Computed helpers
  getFilteredMixes: () => {
    const { filter } = get();
    return mixes.filter((m) => (filter === 'all' ? true : m.type === filter));
  },

  getCurrentIndex: () => {
    const { currentMix } = get();
    const filtered = get().getFilteredMixes();
    if (!currentMix) return -1;
    return filtered.findIndex((m) => m.title === currentMix.title);
  },

  // Navigation
  playNext: () => {
    const state = get();
    const filtered = state.getFilteredMixes();
    const idx = state.getCurrentIndex();

    if (state.repeatMode === 'one') {
      return state.currentMix;
    }

    if (state.shuffleMode) {
      const candidates = filtered.filter((_, i) => i !== idx);
      if (candidates.length === 0) return null;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    if (idx < filtered.length - 1) {
      return filtered[idx + 1];
    }

    if (state.repeatMode === 'all' && filtered.length > 0) {
      return filtered[0];
    }

    return null;
  },

  playPrevious: () => {
    const state = get();
    const filtered = state.getFilteredMixes();
    const idx = state.getCurrentIndex();

    if (state.currentTime > 3) {
      return { action: 'restart' as const };
    }

    if (idx > 0) {
      return { action: 'previous' as const, mix: filtered[idx - 1] };
    }

    if (state.repeatMode === 'all' && filtered.length > 0) {
      return { action: 'previous' as const, mix: filtered[filtered.length - 1] };
    }

    return null;
  },
}));
