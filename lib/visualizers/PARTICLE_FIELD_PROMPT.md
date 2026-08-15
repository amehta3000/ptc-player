# Particle Field Prompt

The generator prompt for new particle fields. Copy everything in the fenced
block below into your LLM of choice, replace the `[INSERT YOUR CREATIVE IDEA
HERE]` line, and paste the result into a new file in `fields/` using the
template in `fields/README.md`.

Everything except the `REQUEST` line stays fixed — that is the whole point.
One prompt, many fields.

```
Act as a Creative Computational Artist & High-Performance WebGL Shader Expert.

**YOUR GOAL:**
Write a single, highly optimized JavaScript function body that defines the
movement behavior and visual appearance of particles in a real-time,
audio-reactive 3D particle field (4,000-30,000 units) inside a music player.
The function runs once per particle, per frame, at 60fps.

**RUNTIME CONTRACT — READ-ONLY INPUTS:**
1.  `i` (Integer): Index of the current particle (0 to count-1).
2.  `count` (Integer): Total particles this frame.
3.  `time` (Float): Seconds since the visualizer mounted. Advances even while
    audio is paused.
4.  `dt` (Float): Seconds since last frame (~0.0167).
5.  `THREE`: The full Three.js library.

**AUDIO INPUTS (all normalized 0.0-1.0, pre-smoothed, never NaN):**
6.  `bass` (Float): 20-250 Hz energy.
7.  `mid` (Float): 250-2000 Hz energy.
8.  `high` (Float): 2000-16000 Hz energy.
9.  `level` (Float): Overall average energy.
10. `beat` (Float): Transient envelope. Spikes toward 1.0 on a detected
    beat, decays back to 0 over ~300ms. Use for punches and kicks.
11. `isPlaying` (Boolean): False when paused or before playback starts.

**WRITE-ONLY OUTPUTS (mutate these; never reassign them):**
12. `target` (THREE.Vector3): **REQUIRED every call.** `target.set(x,y,z)`.
13. `color` (THREE.Color): **REQUIRED every call.** `color.setHSL(...)`,
    `color.copy(...)`, or `color.copy(a).lerp(b, t)`.
14. `attr` (Object): Optional per-particle draw properties.
    - `attr.size` (Float, 0.2-6.0) — point size multiplier. Default 1.
    - `attr.alpha` (Float, 0.0-1.0) — opacity. Default 1.

**HELPER FUNCTIONS:**
- `spectrum(bin)`: Returns 0.0-1.0 amplitude for integer bin 0-63,
  logarithmically spaced from 20Hz to 16kHz. Bin index is clamped for you.
  Low bins = bass, high bins = treble.
- `band(t)`: Same spectrum, but `t` is a Float 0.0-1.0 smoothly interpolated
  across all 64 bins. Prefer this when mapping a continuous form to the
  spectrum. *Example:* `const amp = band(i / count);`
- `hash(n)`: Deterministic pseudo-random Float 0.0-1.0 from a number. Stable
  across frames. Use this for any per-particle variation.
- `addControl(key, label, min, max, step, initial)`: Registers a real-time
  slider in the player UI and returns its current float value. Must be
  called unconditionally at the TOP of the body, with the same keys every
  frame. `key` must be camelCase and stable. Maximum 6 controls.
  *Example:* `const twist = addControl("twist", "Twist", 0, 12, 0.1, 3);`

**COLOR INPUTS (derived from the album art of the playing track):**
- `dominant` (THREE.Color, read-only): Primary album color.
- `accent` (THREE.Color, read-only): Secondary album color.
- `paletteHue` (Float 0.0-1.0, read-only): Base hue of the album art with the
  user's global hue offset already applied.
- `isDark` (Boolean): True in dark mode (additive blending, so bright values
  glow). False in light mode — keep lightness at or below ~0.45 and alpha
  high, or particles vanish against the light background.
Prefer `color.copy(dominant).lerp(accent, t)` or
`color.setHSL(paletteHue + smallOffset, sat, lit)` so the visualization stays
tied to the album art. Do not hardcode absolute hues as the primary scheme.

**CRITICAL PERFORMANCE RULES (STRICT COMPLIANCE REQUIRED):**
1.  **ZERO GARBAGE COLLECTION:** This body runs up to 30,000 times per frame.
    - **NEVER** use `new THREE.Vector3()`, `new THREE.Color()`, or any `new`.
    - **NEVER** allocate arrays, objects, or closures.
    - Reuse only the provided `target`, `color`, and `attr`.
2.  **NO PER-FRAME RANDOMNESS:** **NEVER** call `Math.random()`. It re-rolls
    every frame and makes particles strobe. Use `hash(i)`, `hash(i + 977)`,
    etc. for stable per-particle variation.
3.  **NO PERSISTENT STATE:** The body is stateless. You cannot accumulate
    velocity or store values between frames. Every position must be a pure
    function of `i`, `time`, and the audio inputs. Model motion with
    `Math.sin(time * speed + phase)`, not integration.
4.  **MATH OVER LOGIC:** Avoid `if/else` inside the body. Use `Math.sin`,
    `Math.cos`, `Math.abs`, `Math.min/max`, and bitwise tricks
    (`(i & 1) * 2 - 1`) for shaping.
5.  **BOUNDED VOLUME:** The camera sits 16 units from the origin (8-24 when
    the user animates zoom) looking at (0,0,0). Keep the form centered on the
    origin and within roughly -8 to +8 on every axis, -12 to +12 at absolute
    audio peak. Clamp the audio term so it cannot run open-ended.
6.  **ALIVE IN SILENCE:** The form must still read and move when `isPlaying`
    is false and all audio inputs are 0. Drive the base geometry and motion
    from `time` and `i`; audio should MODULATE the form (amplitude, color,
    scale), never be the sole source of its existence or movement.
7.  **STABILITY LOCK:** All coordinates, colors, sizes and alphas MUST be
    finite real numbers. **NEVER** produce `NaN`, `Infinity`, or `undefined`.
    Guard every division and every `Math.pow`/`Math.log`/`Math.sqrt` against
    zero or negative input.
8.  **OUTPUT ONLY:** Do not return a value. Just mutate `target`, `color`,
    and optionally `attr`.
9.  **NO DUPLICATE CONTROLS:** The host already provides Field, Particle
    Count, Particle Size, Trail, Hue, Harmony, Camera Speed and Zoom Speed
    sliders. Do not add controls for any of those. Add only controls specific
    to the shape or behavior you are inventing.

**SECURITY & VALIDATION RULES (STRICT COMPLIANCE REQUIRED):**
1.  **FORBIDDEN PATTERNS:** Any code containing the following is REJECTED:
    - `document`, `window`, `fetch`, `XMLHttpRequest`, `WebSocket`
    - `eval`, `Function(`, `import(`, `require(`, `process`
    - `__proto__`, `.prototype`, `globalThis`, `self`, `location`, `navigator`
    - `localStorage`, `sessionStorage`, `indexedDB`, `crypto`
    - `setTimeout`, `setInterval`, `alert()`, `confirm()`, `prompt()`
2.  **NO UNDECLARED VARIABLES:** Every variable (`phi`, `theta`, `radius`,
    etc.) MUST be declared with `let` or `const` before use. Anything that
    throws a ReferenceError fails the stability gate.
3.  **NO GLOBAL COLLISIONS:** Never redefine `THREE`, `Math`, or any input
    name listed above.
4.  **CONCISE & CLEAN:** Keep it under ~40 lines. No deep nesting, no
    non-ASCII characters in comments.

**VISUALIZATION GUIDELINES:**
- Build complex, organic, or mathematical structures: attractors, fractals,
  interference patterns, flow fields, parametric surfaces, lattices.
- Map `i` to a continuous parameter (`const t = i / count;`) to form
  continuous shapes rather than clouds of unrelated points.
- Map spatial position to frequency so the structure reads as sound — e.g.
  radius, height, or arc length driven by `band(t)`. This is the single most
  important thing that makes it a music visualizer rather than an animation.
- Assign different roles to different bands: `bass` for scale and pulse,
  `mid` for rotation and flow, `high` for shimmer and detail, `beat` for
  discrete punches.

**REQUEST:**
[INSERT YOUR CREATIVE IDEA HERE - e.g., "A hyper-dimensional tesseract
breathing in 4D space"]

**STRICT RESPONSE FORMAT:**
Return **ONLY** the JavaScript function body. No markdown, no backticks, no
explanation before or after. The first two lines MUST be these comments:
// NAME: <two or three word display name>
// BLURB: <one sentence describing the visual>

**EXAMPLE OUTPUT:**
// NAME: Spectral Helix
// BLURB: A double helix whose strands swell with the spectrum and twist on the beat.
const radius = addControl("radius", "Radius", 1, 8, 0.1, 4);
const twist = addControl("twist", "Twist", 0, 12, 0.1, 3);
const spread = addControl("spread", "Spread", 1, 18, 0.5, 10);
const t = i / count;
const strand = (i & 1) * 2 - 1;
const amp = band(t);
const jitter = (hash(i) - 0.5) * 0.4;
const angle = t * Math.PI * 2 * twist + time * 0.6 + strand * Math.PI;
const r = radius * (1 + Math.min(amp * 1.2 + beat * 0.4, 1.4)) + jitter;
target.set(
  Math.cos(angle) * r,
  (t - 0.5) * spread + Math.sin(time + t * 6) * 0.3,
  Math.sin(angle) * r
);
color.copy(dominant).lerp(accent, amp);
attr.size = 0.6 + amp * 2.5 + beat * 1.5;
attr.alpha = isDark ? 0.35 + amp * 0.65 : 0.7 + amp * 0.3;
```

## Notes on the rules

Three of these rules exist because of how this host works, and are worth
keeping if you adapt the prompt:

- **No persistent state.** Fields are pure functions. Anything needing
  integrated velocity (gravitational attractors, boids, springs) does not fit
  this host — write a full `BaseVisualizer` subclass for that, the way
  `SonicGalaxyVisualizer` does.
- **No `Math.random()`.** Positions are recomputed from scratch every frame,
  so a random call gives a particle a different position each frame. Use
  `hash(i)`.
- **Bounded volume.** The host clamps coordinates to ±60 as a backstop, but
  anything past ~±9 is off the top and bottom of the frame at the default
  camera distance of 16.

The host validates output anyway: non-finite coordinates are zeroed, sizes
and alphas are clamped, and a body that throws is disabled with the error
logged to the console rather than taking down the player.
