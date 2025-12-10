# Visualizer Platform Architecture

## Overview
A modular, plugin-based architecture for audio visualizers that separates concerns and enables easy addition of new visualizers.

## Core Components

### 1. Audio Engine (`lib/audioEngine.ts`)
- **Purpose**: Centralized audio analysis and frequency mapping
- **Features**:
  - Standardized audio data processing
  - Logarithmic frequency mapping (64 bars)
  - Frequency band analysis (bass, mid, high)
  - Optimized for better bass response
  
### 2. Base Visualizer (`lib/visualizers/BaseVisualizer.ts`)
- **Purpose**: Abstract base class for all visualizers
- **Interface**:
  - `init()`: Setup visualizer
  - `update(audioAnalysis)`: Process audio data
  - `render()`: Render frame
  - `destroy()`: Clean up resources
  - `getControls()`: Define UI controls
  - `getName()`: Visualizer name
  
### 3. Visualizer Registry (`lib/visualizerRegistry.ts`)
- **Purpose**: Central registry for all visualizers
- **Features**:
  - Register visualizers with type, name, and default config
  - Factory pattern for creating visualizer instances
  - Type-safe visualizer management
  
### 4. Visualizer Manager (`lib/visualizerManager.ts`)
- **Purpose**: Lifecycle management and coordination
- **Features**:
  - Switch between visualizers
  - Update configurations in real-time
  - Coordinate audio engine with active visualizer
  - Handle animation loop

## File Structure
```
lib/
├── audioEngine.ts              # Core audio processing
├── visualizerManager.ts        # Lifecycle management
├── visualizerRegistry.ts       # Visualizer registration
└── visualizers/
    ├── BaseVisualizer.ts       # Abstract base class
    ├── BarsVisualizer.ts       # Bars implementation
    ├── RadialVisualizer.ts     # TODO
    ├── OrbVisualizer.ts        # TODO
    ├── WebVisualizer.ts        # TODO
    └── TerrainVisualizer.ts    # TODO
```

## Adding a New Visualizer

### Step 1: Create Visualizer Class
```typescript
// lib/visualizers/MyVisualizer.ts
import { BaseVisualizer } from './BaseVisualizer';

export class MyVisualizer extends BaseVisualizer {
  getName(): string { return 'My Visualizer'; }
  
  getControls(): VisualizerControl[] {
    return [
      { name: 'Param', key: 'param', min: 0, max: 10, step: 0.1, default: 5, value: 5 }
    ];
  }
  
  init(): void {
    // Setup your visualizer
  }
  
  update(audioAnalysis: AudioAnalysis): void {
    // Process audio data
  }
  
  render(): void {
    // Render frame
  }
  
  destroy(): void {
    // Clean up
  }
}
```

### Step 2: Register in Registry
```typescript
// lib/visualizerRegistry.ts
import { MyVisualizer } from './visualizers/MyVisualizer';

VisualizerRegistry.register('mytype', 'My Visualizer', MyVisualizer, {
  param: 5.0
});
```

### Step 3: Done!
The visualizer is now available and can be switched to via the UI.

## Benefits

1. **Separation of Concerns**: Audio processing separate from visualization logic
2. **Plug and Play**: Add new visualizers without touching existing code
3. **Type Safety**: Full TypeScript support with interfaces
4. **Maintainability**: Each visualizer in its own file
5. **Testability**: Easy to test individual components
6. **Scalability**: Can add unlimited visualizers
7. **Performance**: Centralized audio engine, single animation loop
8. **Consistency**: All visualizers use same audio data format

## Migration Status

1. ✅ Create core infrastructure
2. ✅ Migrate Bars visualizer
3. ✅ Migrate Radial visualizer
4. ✅ Migrate Orb visualizer  
5. ✅ Migrate Web visualizer
6. ✅ Migrate/Fix Terrain visualizer (with improved performance)
7. ✅ Create React hook for easy integration
8. 🔄 Update main component to use new system

## Usage in React

```typescript
import { useVisualizer } from '@/lib';
import { VisualizerType } from '@/lib';

function MyComponent() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const visualizerRef = useRef<HTMLDivElement>(null);
  const [visualizerType, setVisualizerType] = useState<VisualizerType>('orb');
  
  const {
    controls,
    currentConfig,
    updateConfig,
    resetToDefaults,
    visualizerName
  } = useVisualizer({
    audioRef,
    containerRef: visualizerRef,
    visualizerType,
    colors: { dominant: 'rgb(255,0,0)', accent: 'rgb(0,0,255)' },
    isPlaying: true,
    enabled: true
  });
  
  return (
    <div>
      <div ref={visualizerRef} />
      {controls.map(control => (
        <input
          key={control.key}
          type="range"
          min={control.min}
          max={control.max}
          step={control.step}
          value={control.value}
          onChange={e => updateConfig(control.key, parseFloat(e.target.value))}
        />
      ))}
    </div>
  );
}
```
