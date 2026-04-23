# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production (static export)
npm run lint     # Run ESLint
npm run deploy   # Build + deploy to GitHub Pages
```

There is no test suite. Lint is the primary code quality check.

## Architecture

This is a **Next.js 14 static export** music player called "PartTimeChiller" (`basePath: /ptc-player`), hosted on GitHub Pages. It streams audio from `https://media.parttimechiller.com/` in production and falls back to `public/mixes/` locally.

### Data Flow

1. User selects a track → `store/usePlayerStore.ts` (Zustand) updates `currentMix`
2. `components/PlayerApp.tsx` extracts dominant/accent colors from album art via `lib/colorExtractor.ts`
3. The `<audio>` element plays; `lib/audioEngine.ts` runs Web Audio API FFT producing a 64-band frequency spectrum
4. `lib/visualizerManager.ts` pushes audio data each frame to the active visualizer
5. Visualizers (Three.js/WebGL) render in `<canvas>` inside `components/DetailView.tsx`

### Key Files

| File | Role |
|------|------|
| `store/usePlayerStore.ts` | Single Zustand store: playback state, UI state, navigation helpers |
| `lib/audioEngine.ts` | Web Audio API wrapper — FFT analysis, bass/mid/high band helpers |
| `lib/visualizerRegistry.ts` | Factory: maps visualizer type names → constructors |
| `lib/visualizerManager.ts` | Lifecycle: mounts/unmounts visualizers, routes audio data, handles resize |
| `lib/useVisualizer.ts` | React hook that wires `audioEngine` + `visualizerManager` to a component |
| `data/mixes.ts` | Static metadata for all 13 tracks (title, slug, cover, CDN URL) |

### Visualizer System

All visualizers live in `lib/visualizers/` and extend `BaseVisualizer.ts`. The pattern:

- `init(canvas, audioEngine)` — set up Three.js scene
- `update(frequencyData, deltaTime)` — called every animation frame with 64-band spectrum
- `dispose()` — clean up Three.js resources

To add a new visualizer: extend `BaseVisualizer`, implement the three methods, then register it in `visualizerRegistry.ts`. See `lib/visualizers/README.md` for the full guide.

### Routing

Two pages:
- `pages/index.tsx` — main player with mix list and visualizer
- `pages/track/[slug].tsx` — individual track deep-link (generates static paths from `data/mixes.ts`)

### Environment Variables

```
NEXT_PUBLIC_CLARITY_PROJECT_ID   # Microsoft Clarity (optional)
NEXT_PUBLIC_GA_MEASUREMENT_ID    # Google Analytics (optional)
```

Copy `.env.local.example` to `.env.local` to configure.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) auto-deploys to GitHub Pages on every push to `main`. The `out/` directory is the static export target; `touch out/.nojekyll` ensures GitHub Pages serves it correctly.
