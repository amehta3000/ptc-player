/**
 * React Hook for Visualizer System
 * Provides easy integration with React components
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from './audioEngine';
import { VisualizerManager } from './visualizerManager';
import { VisualizerRegistry } from './visualizerRegistry';
import { ColorScheme, VisualizerControl, VisualizerPreset } from './visualizers/BaseVisualizer';
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
  const [presets, setPresets] = useState<VisualizerPreset[]>([]);
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

    const newPresets = visualizerManagerRef.current.getCurrentPresets();
    setPresets(newPresets);
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
      const variance = Math.abs(defaultVal) * 0.8;
      let val = defaultVal + (Math.random() - 0.5) * 2 * variance;
      // Keep values non-negative
      val = Math.max(0, val);
      // Round to integer if default is an integer
      if (Number.isInteger(defaultVal) && defaultVal !== 0) {
        val = Math.max(1, Math.round(val));
      }
      randomConfig[key] = val;
    });

    setCurrentConfig(randomConfig);
    return randomType;
  }, []);

  // Apply a preset config (batch-update all keys)
  const applyPreset = useCallback((presetConfig: Record<string, number>) => {
    if (!visualizerManagerRef.current) return;

    setCurrentConfig(presetConfig);
    Object.entries(presetConfig).forEach(([key, value]) => {
      visualizerManagerRef.current!.updateConfig(key, value);
    });
    if (visualizerManagerRef.current) {
      setControls(visualizerManagerRef.current.getCurrentControls());
    }
  }, []);

  // Randomize controls within their min/max ranges (current visualizer only)
  const randomizeControls = useCallback(() => {
    if (!visualizerManagerRef.current) return;

    const currentControls = visualizerManagerRef.current.getCurrentControls();
    const randomConfig: Record<string, number> = {};

    currentControls.forEach((control) => {
      const range = control.max - control.min;
      let val = control.min + Math.random() * range;
      // Snap to step
      val = Math.round(val / control.step) * control.step;
      // Clamp
      val = Math.max(control.min, Math.min(control.max, val));
      randomConfig[control.key] = val;
    });

    setCurrentConfig(randomConfig);
    Object.entries(randomConfig).forEach(([key, value]) => {
      visualizerManagerRef.current!.updateConfig(key, value);
    });
    if (visualizerManagerRef.current) {
      setControls(visualizerManagerRef.current.getCurrentControls());
    }
  }, []);

  return {
    controls,
    presets,
    currentConfig,
    updateConfig,
    resetToDefaults,
    randomize,
    applyPreset,
    randomizeControls,
    visualizerName: VisualizerRegistry.getName(visualizerType),
    audioContextRef,
  };
}
