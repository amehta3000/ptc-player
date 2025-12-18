# Visualizer Architecture Guide

## Overview

All visualizers extend `BaseVisualizer` which provides a consistent lifecycle and rendering pattern. This ensures predictable behavior and easy integration with the app.

## Lifecycle Pattern

### 1. Construction
```typescript
const visualizer = new MyVisualizer(container, config, colors);
```

### 2. Initialization & Start
```typescript
visualizer.start(); // Calls init() + starts internal animation loop
```

### 3. Audio Data Updates
```typescript
// Called from external audio processing loop
visualizer.setAudioData(audioAnalysis);
```

### 4. Cleanup
```typescript
visualizer.destroy(); // Stops animation loop, cleans up resources
```

## Creating a New Visualizer

### Step 1: Extend BaseVisualizer

```typescript
import { BaseVisualizer, VisualizerControl, VisualizerConfig, ColorScheme } from './BaseVisualizer';
import { AudioAnalysis } from '../audioEngine';
import * as THREE from 'three';

export class MyVisualizer extends BaseVisualizer {
  private scene: THREE.Scene | null = null;
  private camera: THREE.Camera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  
  constructor(container: HTMLDivElement, config: VisualizerConfig, colors: ColorScheme) {
    super(container, config, colors);
  }
  
  getName(): string {
    return 'My Visualizer';
  }
  
  getControls(): VisualizerControl[] {
    return [
      {
        name: 'Parameter Name',
        key: 'paramKey',
        min: 0,
        max: 10,
        step: 0.1,
        default: 5,
        value: this.config.paramKey || 5
      }
    ];
  }
  
  // Implement required methods...
}
```

### Step 2: Implement Required Methods

#### `init(): void`
- Create Three.js scene, camera, renderer
- Initialize geometry, materials, meshes
- Set up event listeners
- **DO NOT start animation loop** (handled by `start()`)

```typescript
init(): void {
  // Use container dimensions directly
  const width = this.container.clientWidth || 800;
  const height = this.container.clientHeight || 600;
  
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  
  this.renderer = new THREE.WebGLRenderer({ 
    alpha: true,
    antialias: true 
  });
  this.renderer.setSize(width, height);
  this.container.appendChild(this.renderer.domElement);
  
  // Initialize your visualizer elements...
}
```

#### `update(audioAnalysis: AudioAnalysis): void`
- Update internal state based on audio data
- Modify geometry, positions, colors, etc.
- Apply physics simulations
- **DO NOT render** (handled separately)

```typescript
update(audioAnalysis: AudioAnalysis): void {
  if (!this.isInitialized || !audioAnalysis.isPlaying) return;
  
  // Use audio data to update visualizer
  const { bassAvg, midAvg, highAvg } = audioAnalysis;
  
  // Update your visualization based on audio...
}
```

#### `render(): void`
- Render current state to canvas
- Call `renderer.render(scene, camera)`
- Add safety checks

```typescript
render(): void {
  if (!this.isInitialized || !this.renderer || !this.scene || !this.camera) return;
  this.renderer.render(this.scene, this.camera);
}
```

#### `destroy(): void`
- Stop animation loop: `this.stopAnimationLoop()`
- Dispose Three.js resources
- Remove event listeners
- Clear references

```typescript
destroy(): void {
  this.stopAnimationLoop();
  this.isInitialized = false;
  
  // Dispose Three.js resources
  if (this.renderer) {
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
  
  // Clear references
  this.scene = null;
  this.camera = null;
  this.renderer = null;
}
```

### Step 3: Register the Visualizer

In `visualizerRegistry.ts`:

```typescript
import { MyVisualizer } from './visualizers/MyVisualizer';

// Add to type union
export type VisualizerType = '...' | 'myVisualizer';

// Register
VisualizerRegistry.register('myVisualizer', 'My Visualizer', MyVisualizer, {
  paramKey: 5,
  // ... default config values
});
```

### Step 4: Add to UI

In `pages/index.tsx`:

1. Add to type: `type VisualizerType = '...' | 'myVisualizer';`
2. Add ref: `const myVisualizerRef = useRef<HTMLDivElement | null>(null);`
3. Add state for controls
4. Add useEffect for initialization
5. Add to toggle button cycle
6. Add to randomizer array
7. Add controls UI
8. Add render div

## Best Practices

### ✅ DO
- Use `this.isInitialized` checks in `update()` and `render()`
- Get container dimensions after appending to DOM
- Dispose all Three.js resources in `destroy()`
- Use `this.config` for all parameters
- Return early from `update()` when not playing
- Use `this.colors.dominant` and `this.colors.accent` for theming

### ❌ DON'T
- Don't start animation loops in `init()` (use `start()`)
- Don't call `render()` from `update()` or vice versa
- Don't create wrapper divs (use container directly)
- Don't hardcode colors (use color scheme)
- Don't forget to remove event listeners in `destroy()`

## Animation Loop Architecture

The base class handles the animation loop:

```
start() 
  ↓
init() 
  ↓
startInternalAnimationLoop()
  ↓
  ┌─────────────────┐
  │  requestFrame   │
  └────────┬────────┘
           │
    ┌──────┴──────┐
    │   update()  │ ← Uses this.currentAudioAnalysis
    └──────┬──────┘
           │
    ┌──────┴──────┐
    │   render()  │
    └──────┬──────┘
           │
     (repeat) ──────┘
```

External audio data is fed via `setAudioData()` which updates `this.currentAudioAnalysis`.

## Common Patterns

### Handling Configuration Changes

```typescript
updateConfig(key: string, value: number): void {
  super.updateConfig(key, value);
  
  // Handle changes that require reinitialization
  if (key === 'particleCount' && this.scene) {
    this.reinitializeParticles();
  }
}
```

### Responsive Sizing

```typescript
init(): void {
  // ... setup code
  
  const handleResize = () => {
    if (!this.camera || !this.renderer || !this.container) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };
  
  window.addEventListener('resize', handleResize);
  
  // Don't forget to remove in destroy()!
}
```

## Example: SonicGalaxyVisualizer

See `SonicGalaxyVisualizer.ts` for a complete, production-ready example following all these patterns.

## Troubleshooting

**Visualizer not rendering?**
- Check `init()` isn't starting its own loop
- Verify `start()` is called (not just `init()`)
- Check console for errors
- Verify container has dimensions

**Animation stuttering?**
- Make sure there's only ONE animation loop per visualizer
- Don't call `update()` and `render()` from page AND visualizer

**Memory leaks?**
- Ensure `destroy()` calls `stopAnimationLoop()`
- Dispose all Three.js geometries and materials
- Remove all event listeners

**Config changes not working?**
- Override `updateConfig()` if reinitialization is needed
- Make sure you're reading from `this.config` not hardcoded values
