/**
 * Visualizer Platform - Main Exports
 */

export { AudioEngine } from './audioEngine';
export type { AudioAnalysis } from './audioEngine';

export { VisualizerManager } from './visualizerManager';

export { VisualizerRegistry } from './visualizerRegistry';
export type { VisualizerType } from './visualizerRegistry';

export { BaseVisualizer } from './visualizers/BaseVisualizer';
export type { VisualizerConfig, VisualizerControl, ColorScheme } from './visualizers/BaseVisualizer';

export { useVisualizer } from './useVisualizer';

// Individual visualizers (optional, for advanced usage)
export { BarsVisualizer } from './visualizers/BarsVisualizer';
export { RadialVisualizer } from './visualizers/RadialVisualizer';
export { OrbVisualizer } from './visualizers/OrbVisualizer';
export { WebVisualizer } from './visualizers/WebVisualizer';
export { TerrainVisualizer } from './visualizers/TerrainVisualizer';
