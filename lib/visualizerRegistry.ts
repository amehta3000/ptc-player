/**
 * Visualizer Registry
 * Central registry for all available visualizers
 */

import { BaseVisualizer, VisualizerConfig, ColorScheme } from './visualizers/BaseVisualizer';
import { BarsVisualizer } from './visualizers/BarsVisualizer';
import { OrbVisualizer } from './visualizers/OrbVisualizer';
import { WebVisualizer } from './visualizers/WebVisualizer';
import { TerrainVisualizer } from './visualizers/TerrainVisualizer';
// import { ChrysalisVisualizer } from './visualizers/ChrysalisVisualizer'; // retired
import { SonicGalaxyVisualizer } from './visualizers/SonicGalaxyVisualizer';
import { RaindropsVisualizer } from './visualizers/RaindropsVisualizer';
import { CassetteVisualizer } from './visualizers/CassetteVisualizer';
import { SacredGeometryVisualizer } from './visualizers/SacredGeometryVisualizer';
import { ConstellationVisualizer } from './visualizers/ConstellationVisualizer';
import { PlasmaVisualizer } from './visualizers/PlasmaVisualizer';
import { RadialPlaneVisualizer } from './visualizers/RadialPlaneVisualizer';
import { RadialSpokesVisualizer } from './visualizers/RadialSpokesVisualizer';
import { RidgeVisualizer } from './visualizers/RidgeVisualizer';

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
  mobileConfig?: Partial<VisualizerConfig>;
}

export class VisualizerRegistry {
  private static visualizers: Map<string, VisualizerRegistryEntry> = new Map();

  static register(
    type: VisualizerType,
    name: string,
    constructor: VisualizerConstructor,
    defaultConfig: VisualizerConfig,
    mobileConfig?: Partial<VisualizerConfig>
  ): void {
    this.visualizers.set(type, { type, name, constructor, defaultConfig, mobileConfig });
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

  static getDefaultConfig(type: VisualizerType, isMobile = false): VisualizerConfig {
    const entry = this.visualizers.get(type);
    if (!entry) return {};
    const base = { ...entry.defaultConfig };
    if (isMobile && entry.mobileConfig) {
      return { ...base, ...entry.mobileConfig } as VisualizerConfig;
    }
    return base;
  }
}

// Register all visualizers with their default configs
VisualizerRegistry.register('bars', 'Bars', BarsVisualizer, {
  scale: 1.0,
  smoothness: 1.5,
  width: 20,
  mode: 3,
  palette: 2,
  hue: 0,
});

VisualizerRegistry.register('orb', 'Orb', OrbVisualizer, {
  freqMultiplier: 3.6,
  noiseMultiplier: 0.8,
  timeSpeed: 2.0,
  autoRotationSpeed: 0.002,
  radius: 2.5,
  meshDetail: 7,
  wireframe: 1,
  shape: 1,
  lightIntensity: 3.0,
  lightSpeed: 0.25,
  ambient: 0.3,
  hue: 0,
}, {
  radius: 2.0,
});

VisualizerRegistry.register('web', 'Web', WebVisualizer, {
  bassPulse: 0.4,
  midExtension: 0.5,
  highShimmer: 0.1,
  rotationSpeed: 0.002,
  hue: 0,
});

VisualizerRegistry.register('terrain', 'Terrain', TerrainVisualizer, {
  amplitude: 3.9,
  speed: 17.5,
  decay: 0.95,
  cameraDistance: 9.5,
  autoRotation: 0.0005,
  zoomSpeed: 0,
  hue: 0,
});

// VisualizerRegistry.register('chrysalis', 'Chrysalis', ChrysalisVisualizer, { // retired
//   slices: 56,
//   waviness: 0.05,
//   rotationSpeed: 0.003,
//   pulseIntensity: 0.7,
//   lineThickness: 2,
//   hue: 0,
// });

VisualizerRegistry.register('sonicGalaxy', 'Sonic Galaxy', SonicGalaxyVisualizer, {
  particleCount: 4000,
  attractorCount: 3,
  gravity: 7.0,
  maxSpeed: 0.5,
  particleSize: 0.5,
  cameraSpeed: 0.001,
  zoomSpeed: 0,
  trail: 0,
  hue: 0,
  harmonyMode: 0,
}, {
  particleSize: 1.0,
  trail: 0.12,
});

VisualizerRegistry.register('raindrops', 'Raindrops', RaindropsVisualizer, {
  maxRipples: 64,
  bassThreshold: 0.10,
  drizzleRate: 0.05,
  planeSize: 40,
  intensity: 0.8,
  ringThickness: 0.10,
  layoutMode: 0,
  hue: 0,
});

VisualizerRegistry.register('sacredGeometry', 'Sacred Geometry', SacredGeometryVisualizer, {
  rotationSpeed: 0.003,
  glowIntensity: 0.6,
  pulseStrength: 0.4,
  layerCount: 6,
  complexity: 2,
  hue: 0,
  harmonyMode: 1,
  symmetry: 6,
});

VisualizerRegistry.register('cassette', 'Cassette', CassetteVisualizer, {
  reelSpeed: 1.0,
  bassWobble: 0.3,
  lightOrbit: 0.5,
  lightIntensity: 3,
  bounce: 0.2,
  autoRotate: 0.003,
  tiltReact: 0.1,
  hue: 0,
});

VisualizerRegistry.register('constellation', 'Constellation', ConstellationVisualizer, {
  particleCount: 2000,
  attractorCount: 3,
  gravity: 7.0,
  maxSpeed: 0.5,
  particleSize: 0.5,
  cameraSpeed: 0.001,
  zoomSpeed: 0,
  trail: 0,
  hue: 0,
  harmonyMode: 0,
  connectionThreshold: 0.6,
  edgeOpacity: 0.5,
  maxConnections: 3,
}, {
  particleSize: 1.0,
  trail: 0.12,
});

VisualizerRegistry.register('radial', 'Radial', RadialPlaneVisualizer, {
  ringStyle: 0,
  amplitude: 3.0,
  speed: 14,
  decay: 0.92,
  innerRadius: 1.2,
  outerRadius: 9,
  ringWidth: 0.65,
  autoRotation: 0.001,
  zoomSpeed: 0,
  cameraDistance: 13,
  hue: 0,
  harmonyMode: 0,
}, {
  angularSegments: 96,
  rings: 32,
});

VisualizerRegistry.register('spokes', 'Spokes', RadialSpokesVisualizer, {
  amplitude: 2.8,
  speed: 14,
  decay: 1.0,
  innerRadius: 1.3,
  spokeWidth: 0,
  autoRotation: 0.0008,
  zoomSpeed: 0,
  cameraDistance: 14,
  hue: 0,
  harmonyMode: 0,
}, {
  spokeCount: 64,
  samplesPerSpoke: 36,
});

// Ripples merged into Radial (Solid style). This alias keeps old share
// links working; it is not in the VISUALIZER_TYPES cycle.
VisualizerRegistry.register('ripples', 'Ripples', RadialPlaneVisualizer, {
  ringStyle: 1,
  amplitude: 2.4,
  speed: 10,
  decay: 0.93,
  innerRadius: 0.35,
  outerRadius: 9,
  ringWidth: 0.65,
  autoRotation: 0.0008,
  zoomSpeed: 0,
  cameraDistance: 14,
  hue: 0,
  harmonyMode: 0,
}, {
  angularSegments: 72,
  rings: 28,
});

VisualizerRegistry.register('ridge', 'Ridge', RidgeVisualizer, {
  amplitude: 3.2,
  speed: 12,
  decay: 0.98,
  autoRotation: 0,
  zoomSpeed: 0,
  cameraDistance: 13,
  hue: 0,
  harmonyMode: 2,
}, {
  samples: 72,
  rows: 22,
});

VisualizerRegistry.register('plasma', 'Plasma', PlasmaVisualizer, {
  bassPulse: 1.2,
  surfaceDetail: 0.7,
  glowIntensity: 1.1,
  rotationSpeed: 0.002,
  radius: 2.5,
  meshDetail: 6,
  tendrils: 7,
  hue: 0,
  harmonyMode: 0,
}, {
  radius: 2.0,
  meshDetail: 5,
  tendrils: 5,
});
