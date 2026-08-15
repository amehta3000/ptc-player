# Particle Fields

A **field** is the per-particle body of a particle visualizer with none of the
Three.js boilerplate: given a particle index, the clock and the current audio,
it decides where that particle goes and what colour it is.

`ParticleFieldVisualizer` is the host. It owns the scene, camera, renderer,
points mesh, drag/zoom controls, trail overlay, audio smoothing, beat
detection and palette, and calls the selected field's `body` once per particle
per frame. Adding a field is ~30 lines instead of ~700.

Fields are picked with the **Field** slider in the visualizer controls.

## Adding a field

1. Generate a body with the prompt in [`../PARTICLE_FIELD_PROMPT.md`](../PARTICLE_FIELD_PROMPT.md).
2. Copy the template below into `fields/<yourField>.ts`.
3. Paste the generated code between the markers, and add any context
   properties it uses to the destructuring block.
4. Append it to `PARTICLE_FIELDS` in [`index.ts`](./index.ts) — **at the end**,
   since share links store the field's index.

```ts
import { ParticleField } from './types';

export const myField: ParticleField = {
  key: 'myField',        // stable camelCase id — namespaces this field's control keys
  name: 'My Field',      // shown on the Field slider
  blurb: 'One line describing the visual.',
  body: (c) => {
    const {
      i, count, time, dt, bass, mid, high, level, beat, isPlaying,
      target, color, attr,
      spectrum, band, hash, addControl,
      dominant, accent, paletteHue, isDark,
    } = c;
    // ---- generated body below ------------------------------------------

    // paste here

    // ---- generated body above ------------------------------------------
  },
};
```

Trim the destructuring list to what the body actually uses — unused bindings
will fail lint.

## Optional: `defaults`

A field may declare preferred host settings, applied when it is selected:

```ts
defaults: { cameraPitch: 0.6, particleSize: 0.8, trail: 0.3 },
```

Any host control key works (`particleSize`, `trail`, `cameraSpeed`, …), plus
`cameraPitch` — the camera's vertical angle in radians, defaulting to 0.25.
Flat disc-shaped fields want roughly 0.6, or they are seen almost edge-on and
read as a line; upright fields want the shallow default. The pitch is read
straight off the field each time one is selected, so one field's preference
never leaks into the next.

## What the host guarantees

- `target`, `color` and `attr` are the same objects every call. Mutate them;
  never reassign. `attr.size` and `attr.alpha` are reset to 1 before each call.
- Audio inputs are pre-smoothed, clamped to 0-1, and never `NaN` — including
  before playback has started, when they are all 0.
- Non-finite coordinates are zeroed and all coordinates are clamped to ±60.
- Sizes are clamped to 0-8, alphas to 0-1, colour channels to 0-4.
- A body that throws is disabled for the rest of the session with the error
  logged to the console. The player keeps running; switch fields to recover.

## Constraints worth knowing

- **Stateless.** Positions are recomputed from scratch every frame, so a field
  cannot integrate velocity. Anything needing real physics (attractors, boids,
  springs) wants a full `BaseVisualizer` subclass instead — see
  `../SonicGalaxyVisualizer.ts`.
- **Main thread.** The body runs `particleCount` times per frame in JS. 12,000
  is the desktop default and 30,000 the ceiling; mobile drops to 4,000 via the
  registry's `mobileConfig`. Keep bodies to plain arithmetic.
- **Controls.** `addControl` must be called unconditionally at the top of the
  body with the same keys every frame. The host discovers controls by running
  the body once at init and reads them by key afterwards. Values persist under
  `f_<fieldKey>_<controlKey>`, so two fields can both have a `speed` slider
  without colliding.
