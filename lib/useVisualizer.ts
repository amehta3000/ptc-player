/**
 * React Hook for Visualizer System
 * Provides easy integration with React components
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from './audioEngine';
import { VisualizerManager } from './visualizerManager';
import { VisualizerRegistry } from './visualizerRegistry';
import { ColorScheme, VisualizerControl } from './visualizers/BaseVisualizer';
import { VisualizerType, VISUALIZER_TYPES } from '../store/usePlayerStore';

interface UseVisualizerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  visualizerType: VisualizerType;
  colors: ColorScheme;
  isPlaying: boolean;
  enabled: boolean;
}

export function useVisualizer({
  audioRef,
  containerRef,
  visualizerType,
  colors,
  isPlaying,
  enabled,
}: UseVisualizerProps) {
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const visualizerManagerRef = useRef<VisualizerManager | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceCreatedRef = useRef<boolean>(false);
  const [controls, setControls] = useState<VisualizerControl[]>([]);
  const [currentConfig, setCurrentConfig] = useState<Record<string, number>>({});

  // Initialize audio engine
  useEffect(() => {
    if (!audioRef.current || !enabled) return;

    const audio = audioRef.current;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (!sourceCreatedRef.current) {
      const source = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;

      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      audioEngineRef.current = new AudioEngine(audioContextRef.current, analyserRef.current, 64);
      sourceCreatedRef.current = true;
    }
  }, [audioRef, enabled]);

  // Initialize visualizer manager
  useEffect(() => {
    if (!containerRef.current || !audioEngineRef.current || !enabled) return;

    visualizerManagerRef.current = new VisualizerManager(
      audioEngineRef.current,
      containerRef.current
    );

    return () => {
      visualizerManagerRef.current?.destroy();
      visualizerManagerRef.current = null;
    };
  }, [containerRef, enabled]);

  // Switch visualizer type
  useEffect(() => {
    if (!visualizerManagerRef.current || !enabled) return;

    const config = { ...VisualizerRegistry.getDefaultConfig(visualizerType), ...currentConfig };
    visualizerManagerRef.current.switchVisualizer(visualizerType, config, colors);

    const newControls = visualizerManagerRef.current.getCurrentControls();
    setControls(newControls);
  }, [visualizerType, enabled]);

  // Update colors
  useEffect(() => {
    if (!visualizerManagerRef.current || !enabled) return;
    visualizerManagerRef.current.updateColors(colors);
  }, [colors, enabled]);

  // Update playback state
  useEffect(() => {
    if (!visualizerManagerRef.current || !enabled) return;
    visualizerManagerRef.current.setPlaybackState(isPlaying);
  }, [isPlaying, enabled]);

  // Resume audio context on play
  useEffect(() => {
    if (isPlaying && audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [isPlaying]);

  // Update config value
  const updateConfig = useCallback((key: string, value: number) => {
    if (!visualizerManagerRef.current) return;

    visualizerManagerRef.current.updateConfig(key, value);
    setCurrentConfig((prev) => ({ ...prev, [key]: value }));

    setControls((prev) =>
      prev.map((control) => (control.key === key ? { ...control, value } : control))
    );
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const defaults = VisualizerRegistry.getDefaultConfig(visualizerType);
    setCurrentConfig(defaults);
    Object.entries(defaults).forEach(([key, value]) => {
      if (visualizerManagerRef.current) {
        visualizerManagerRef.current.updateConfig(key, value);
      }
    });
    if (visualizerManagerRef.current) {
      setControls(visualizerManagerRef.current.getCurrentControls());
    }
  }, [visualizerType]);

  // Randomize visualizer
  const randomize = useCallback((): VisualizerType => {
    const randomType = VISUALIZER_TYPES[Math.floor(Math.random() * VISUALIZER_TYPES.length)];
    const defaults = VisualizerRegistry.getDefaultConfig(randomType);
    const randomConfig: Record<string, number> = {};

    Object.entries(defaults).forEach(([key, defaultVal]) => {
      // Randomize within a reasonable range around the default
      const variance = defaultVal * 0.8;
      randomConfig[key] = defaultVal + (Math.random() - 0.5) * 2 * variance;
    });

    setCurrentConfig(randomConfig);
    return randomType;
  }, []);

  return {
    controls,
    currentConfig,
    updateConfig,
    resetToDefaults,
    randomize,
    visualizerName: VisualizerRegistry.getName(visualizerType),
    audioContextRef,
  };
}
