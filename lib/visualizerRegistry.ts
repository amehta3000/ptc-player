/**
 * Visualizer Registry
 * Central registry for all available visualizers
 */

import { BaseVisualizer, VisualizerConfig, ColorScheme } from './visualizers/BaseVisualizer';
import { BarsVisualizer } from './visualizers/BarsVisualizer';
import { RadialVisualizer } from './visualizers/RadialVisualizer';
import { OrbVisualizer } from './visualizers/OrbVisualizer';
import { WebVisualizer } from './visualizers/WebVisualizer';
import { TerrainVisualizer } from './visualizers/TerrainVisualizer';
import { SonicGalaxyVisualizer } from './visualizers/SonicGalaxyVisualizer';

export type VisualizerType = 'bars' | 'radial' | 'orb' | 'web' | 'terrain' | 'sonicGalaxy';

type VisualizerConstructor = new (
  container: HTMLDivElement,
  config: VisualizerConfig,
  colors: ColorScheme
) => BaseVisualizer;

interface VisualizerRegistryEntry {
  type: VisualizerType;
  name: string;
  constructor: VisualizerConstructor;
  defaultConfig: VisualizerConfig;
}

export class VisualizerRegistry {
  private static visualizers: Map<VisualizerType, VisualizerRegistryEntry> = new Map();
  
  /**
   * Register a visualizer
   */
  static register(
    type: VisualizerType,
    name: string,
    constructor: VisualizerConstructor,
    defaultConfig: VisualizerConfig
  ): void {
    this.visualizers.set(type, { type, name, constructor, defaultConfig });
  }
  
  /**
   * Create a visualizer instance
   */
  static create(
    type: VisualizerType,
    container: HTMLDivElement,
    config: VisualizerConfig,
    colors: ColorScheme
  ): BaseVisualizer | null {
    const entry = this.visualizers.get(type);
    if (!entry) {
      console.error(`Visualizer type "${type}" not found in registry`);
      return null;
    }
    
    const mergedConfig = { ...entry.defaultConfig, ...config };
    return new entry.constructor(container, mergedConfig, colors);
  }
  
  /**
   * Get all registered visualizer types
   */
  static getTypes(): VisualizerType[] {
    return Array.from(this.visualizers.keys());
  }
  
  /**
   * Get visualizer name by type
   */
  static getName(type: VisualizerType): string {
    return this.visualizers.get(type)?.name || type;
  }
  
  /**
   * Get default config for a visualizer
   */
  static getDefaultConfig(type: VisualizerType): VisualizerConfig {
    return this.visualizers.get(type)?.defaultConfig || {};
  }
}

// Register all visualizers
VisualizerRegistry.register('bars', 'Bars', BarsVisualizer, {
  scale: 0.5,
  smoothness: 1.0,
  width: 4,
});

VisualizerRegistry.register('radial', 'Radial', RadialVisualizer, {
  intensity: 1.0,
  timeSpeed: 0.5
});

VisualizerRegistry.register('orb', 'Orb', OrbVisualizer, {
  freqMultiplier: 3.6,
  noiseMultiplier: 0.55,
  timeSpeed: 2.0,
  autoRotationSpeed: 0.003
});

VisualizerRegistry.register('web', 'Web', WebVisualizer, {
  bassPulse: 0.4,
  midExtension: 0.5,
  highShimmer: 0.1,
  rotationSpeed: 0.002
});

VisualizerRegistry.register('terrain', 'Terrain', TerrainVisualizer, {
  amplitude: 2.0,
  speed: 1.0,
  decay: 0.95,
  cameraDistance: 8,
  autoRotation: 0.002
});

VisualizerRegistry.register('sonicGalaxy', 'Sonic Galaxy', SonicGalaxyVisualizer, {
  particleCount: 10000,
  attractorCount: 3,
  bassGravity: 2.0,
  midSpin: 0.9,
  highEnergy: 1.5,
  maxSpeed: 8,
  velocityDamping: 0.04,
  particleSize: 0.5,
  cameraSpeed: 0.004,
  boundSize: 8,
  beatSensitivity: 1.2
});
