
## 💾 PRD: Whitecap Visualizer (Audio-Reactive 3D Wireframe)

### 1. Introduction

This document outlines the requirements for implementing a **WhiteCap-style audio visualizer** within a media player application using **React** and **Three.js**. The visualizer must dynamically map real-time audio analysis data to a complex, pulsating 3D wireframe mesh.

### 2. Goals

* Faithfully replicate the core aesthetic and responsive behavior of the classic WhiteCap visualizer.
* Achieve high-performance 3D rendering (minimum **60 FPS**).
* Provide a clear, modular architecture for audio-to-visual data mapping.

---

### 3. Technical Requirements: Audio Analysis

The visualizer requires real-time frequency data from the audio source.

| ID | Requirement | Implementation Detail |
| :--- | :--- | :--- |
| **TR.AUDIO.1** | Use the **Web Audio API** (`AudioContext`) to access the audio stream. | |
| **TR.AUDIO.2** | Implement an `AnalyserNode` to perform a **Fast Fourier Transform (FFT)**. | |
| **TR.AUDIO.3** | Extract a frequency array (e.g., **512 or 1024 bins**) on every animation frame. | This array is the primary data source for all visual effects. |

---

### 4. Technical Requirements: 3D Rendering (Three.js)

The visualizer must be built using Three.js and efficiently update its geometry.

| ID | Requirement | Implementation Detail |
| :--- | :--- | :--- |
| **TR.3D.1** | **Geometry:** Use **`THREE.BufferGeometry`** for the mesh to allow for efficient vertex updates. | |
| **TR.3D.2** | **Mesh Type:** Render the primary visual as a **wireframe** using `THREE.LineSegments` or similar. | |
| **TR.3D.3** | **Performance:** Set **`geometry.attributes.position.needsUpdate = true`** on every frame to reflect audio changes. | |
| **TR.3D.4** | **Material:** Use a material (e.g., `THREE.MeshBasicMaterial`) with a strong **`emissive` color** and potentially **`THREE.AdditiveBlending`** to achieve the glowing effect. | |
| **TR.3D.5** | **Post-Processing (Stretch):** Implement a post-processing pass for **Bloom** effects to enhance the glow and atmosphere. | |

---

### 5. Functional Requirements: Audio-to-Visual Mapping

The core of the visualizer is how specific frequency ranges are mapped to 3D properties.

#### 5.1. Shape/Geometry Modulation

The vertices of the mesh must move in response to the music.

| ID | Frequency Range | Visual Effect (3D Property) |
| :--- | :--- | :--- |
| **FR.MAP.1** | **Low Frequencies (Bass: 0–150 Hz)** | Control the **overall scale/size** and **main rhythmic pulse** of the wireframe. |
| **FR.MAP.2** | **Mid Frequencies (150–2000 Hz)** | Control the **radial complexity** and **outward extension** of the "wings" or spokes. |
| **FR.MAP.3** | **High Frequencies (Treble: 2000+ Hz)** | Control a **subtle, rapid noise/vibration** applied to all vertices for shimmering detail. |

#### 5.2. Color Modulation

The color of the visualizer must change based on audio energy.

| ID | Audio Data | Color/Lighting Effect |
| :--- | :--- | :--- |
| **FR.MAP.4** | **Low Frequencies (Bass)** | Control the intensity of **warm colors** (Red/Orange), primarily in the center of the visualizer. |
| **FR.MAP.5** | **High Frequencies (Treble)** | Control the intensity of **cool colors** (Yellow/Green), primarily in the outer sections of the visualizer. |
| **FR.MAP.6** | **Overall Energy** | Control the total **brightness** and **glow** of the material (`emissive` value). |

#### 5.3. Motion

The visual must have continuous, non-reactive motion.

| ID | Audio Data | Motion Effect |
| :--- | :--- | :--- |
| **FR.MAP.7** | **None (Constant)** | Apply a slow, continuous **rotation** to the `THREE.Group` that holds the entire visualizer. |

---
