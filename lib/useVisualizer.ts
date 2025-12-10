/**
 * React Hook for Visualizer System
 * Provides easy integration with React components
 */

import { useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audioEngine';
import { VisualizerManager } from './visualizerManager';
import { VisualizerRegistry, VisualizerType } from './visualizerRegistry';
import { ColorScheme, VisualizerControl } from './visualizers/BaseVisualizer';

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
  enabled
}: UseVisualizerProps) {
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const visualizerManagerRef = useRef<VisualizerManager | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [controls, setControls] = useState<VisualizerControl[]>([]);
  const [currentConfig, setCurrentConfig] = useState<Record<string, number>>({});
  
  // Initialize audio engine
  useEffect(() => {
    if (!audioRef.current || !enabled) return;
    
    const audio = audioRef.current;
    
    // Create audio context and analyser
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaElementSource(audio);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      
      audioEngineRef.current = new AudioEngine(audioContextRef.current, analyserRef.current, 64);
    }
    
    return () => {
      // Keep audio context alive for switching songs
    };
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
    
    const defaultConfig = VisualizerRegistry.getDefaultConfig(visualizerType);
    setCurrentConfig(defaultConfig);
    
    visualizerManagerRef.current.switchVisualizer(visualizerType, defaultConfig, colors);
    
    const newControls = visualizerManagerRef.current.getCurrentControls();
    setControls(newControls);
  }, [visualizerType, colors, enabled]);
  
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
  
  // Update config value
  const updateConfig = (key: string, value: number) => {
    if (!visualizerManagerRef.current) return;
    
    visualizerManagerRef.current.updateConfig(key, value);
    setCurrentConfig(prev => ({ ...prev, [key]: value }));
    
    // Update controls to reflect new value
    setControls(prev => 
      prev.map(control => 
        control.key === key ? { ...control, value } : control
      )
    );
  };
  
  // Reset to defaults
  const resetToDefaults = () => {
    const defaults = VisualizerRegistry.getDefaultConfig(visualizerType);
    Object.entries(defaults).forEach(([key, value]) => {
      updateConfig(key, value);
    });
  };
  
  return {
    controls,
    currentConfig,
    updateConfig,
    resetToDefaults,
    visualizerName: VisualizerRegistry.getName(visualizerType)
  };
}
