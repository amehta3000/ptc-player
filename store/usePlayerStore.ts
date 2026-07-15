import { create } from 'zustand';
import { Track } from '../data/track';

type VisualizerType = 'bars' | 'orb' | 'web' | 'terrain' | 'sonicGalaxy' | 'constellation' | 'raindrops' | 'sacredGeometry' | 'cassette' | 'plasma';

export type { VisualizerType };

interface PlayerState {
  // Playback
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;

  // UI
  showVisualizer: boolean;
  showControls: boolean;
  showDebug: boolean;
  darkMode: boolean;
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
  setCurrentTrack: (track: Track | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // UI actions
  setShowVisualizer: (show: boolean) => void;
  setShowControls: (show: boolean) => void;
  setShowDebug: (show: boolean) => void;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setVisualizerType: (type: VisualizerType) => void;
  setCurrentFont: (font: string) => void;

  // Color actions
  setDominantColor: (color: string) => void;
  setAccentColor: (color: string) => void;

  // Audio data
  setAudioData: (data: number[]) => void;
}

export const VISUALIZER_TYPES: VisualizerType[] = ['terrain', 'sonicGalaxy', 'constellation', 'orb', 'plasma', 'bars', 'web', 'raindrops', 'sacredGeometry'];

export const VISUALIZER_NAMES: Record<VisualizerType, string> = {
  bars: 'Bars',
  orb: 'Orb',
  web: 'Web',
  terrain: 'Terrain',
  sonicGalaxy: 'Sonic Galaxy',
  constellation: 'Constellation',
  raindrops: 'Raindrops',
  sacredGeometry: 'Sacred Geometry',
  cassette: 'Cassette',
  plasma: 'Plasma',
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

export const usePlayerStore = create<PlayerState & PlayerActions>((set) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMuted: false,

  showVisualizer: true,
  showControls: false,
  showDebug: false,
  darkMode: true,
  visualizerType: 'terrain',
  currentFont: 'Stint Ultra Expanded',

  dominantColor: 'rgb(115, 115, 115)',
  accentColor: 'rgb(45, 185, 185)',

  audioData: Array(64).fill(0),

  // Playback actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setProgress: (progress) => set({ progress }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),

  // UI actions
  setShowVisualizer: (show) => set({ showVisualizer: show }),
  setShowControls: (show) => set({ showControls: show }),
  setShowDebug: (show) => set({ showDebug: show }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
  setDarkMode: (dark) => set({ darkMode: dark }),
  setVisualizerType: (type) => set({ visualizerType: type }),
  setCurrentFont: (font) => set({ currentFont: font }),

  // Color actions
  setDominantColor: (color) => set({ dominantColor: color }),
  setAccentColor: (color) => set({ accentColor: color }),

  // Audio data
  setAudioData: (data) => set({ audioData: data }),
}));
