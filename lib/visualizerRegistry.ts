/**
 * Visualizer Registry
 * Central registry for all available visualizers
 */

import { BaseVisualizer, VisualizerConfig, ColorScheme } from './visualizers/BaseVisualizer';
import { BarsVisualizer } from './visualizers/BarsVisualizer';
import { OrbVisualizer } from './visualizers/OrbVisualizer';
import { WebVisualizer } from './visualizers/WebVisualizer';
import { TerrainVisualizer } from './visualizers/TerrainVisualizer';
import { ChrysalisVisualizer } from './visualizers/ChrysalisVisualizer';
import { SonicGalaxyVisualizer } from './visualizers/SonicGalaxyVisualizer';
import { RaindropsVisualizer } from './visualizers/RaindropsVisualizer';

// Re-export the canonical type from the store
export type { VisualizerType } from '../store/usePlayerStore';
import type { VisualizerType } from '../store/usePlayerStore';

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
  private static visualizers: Map<string, VisualizerRegistryEntry> = new Map();

  static register(
    type: VisualizerType,
    name: string,
    constructor: VisualizerConstructor,
    defaultConfig: VisualizerConfig
  ): void {
    this.visualizers.set(type, { type, name, constructor, defaultConfig });
  }

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

  static getTypes(): VisualizerType[] {
    return Array.from(this.visualizers.keys()) as VisualizerType[];
  }

  static getName(type: VisualizerType): string {
    return this.visualizers.get(type)?.name || type;
  }

  static getDefaultConfig(type: VisualizerType): VisualizerConfig {
    return { ...(this.visualizers.get(type)?.defaultConfig || {}) };
  }
}

// Register all visualizers with their default configs
VisualizerRegistry.register('bars', 'Bars', BarsVisualizer, {
  scale: 0.5,
  smoothness: 1.0,
  width: 4,
  mode: 0,
  palette: 0,
});

VisualizerRegistry.register('orb', 'Orb', OrbVisualizer, {
  freqMultiplier: 3.6,
  noiseMultiplier: 0.55,
  timeSpeed: 2.0,
  autoRotationSpeed: 0.003,
  radius: 2.0,
  meshDetail: 4,
  wireframe: 1,
  shape: 0,
  lightIntensity: 2,
  lightSpeed: 0.5,
  ambient: 0.3,
});

VisualizerRegistry.register('web', 'Web', WebVisualizer, {
  bassPulse: 0.4,
  midExtension: 0.5,
  highShimmer: 0.1,
  rotationSpeed: 0.002,
});

VisualizerRegistry.register('terrain', 'Terrain', TerrainVisualizer, {
  amplitude: 3.9,
  speed: 17.5,
  decay: 0.95,
  cameraDistance: 9.5,
  autoRotation: 0.0005,
});

VisualizerRegistry.register('chrysalis', 'Chrysalis', ChrysalisVisualizer, {
  slices: 56,
  waviness: 0.05,
  rotationSpeed: 0.003,
  pulseIntensity: 0.7,
  lineThickness: 2,
});

VisualizerRegistry.register('sonicGalaxy', 'Sonic Galaxy', SonicGalaxyVisualizer, {
  particleCount: 30000,
  attractorCount: 4,
  bassGravity: 2.0,
  midSpin: 2.0,
  maxSpeed: 8,
  velocityDamping: 0.04,
  particleSize: 1.0,
  cameraSpeed: 0.004,
  trail: 0,
  beatSensitivity: 1.2,
});

VisualizerRegistry.register('raindrops', 'Raindrops', RaindropsVisualizer, {
  maxRipples: 64,
  bassThreshold: 0.10,
  drizzleRate: 0.05,
  planeSize: 40,
  intensity: 0.8,
  ringThickness: 0.10,
  layoutMode: 0,
});
