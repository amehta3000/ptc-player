# PartTimeChiller Music Player

A modern, dynamic music player built with Next.js featuring real-time audio visualization and album art color theming.

## Features

- 🎨 **Dynamic Color Theming** - Automatically extracts colors from album artwork
- 📊 **Real-time Audio Visualizer** - 32-band frequency spectrum analyzer
- 🎵 **Smooth Playback** - Progress tracking with seek functionality
- 📱 **Responsive Design** - Optimized for mobile and desktop
- 🌐 **Social Integration** - Instagram, YouTube, and Spotify links
- ✨ **Glassmorphic UI** - Modern frosted glass effects
- 🔤 **Space Mono Font** - Clean, monospace typography

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Add your audio files to `public/mixes/` (*.mp3, *.aif files not included in repo)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Web Audio API

## Project Structure

```
├── pages/
│   ├── _app.tsx       # App configuration with Space Mono font
│   └── index.tsx      # Main player component
├── data/
│   └── mixes.ts       # Mix metadata
├── public/
│   ├── covers/        # Album artwork
│   ├── mixes/         # Audio files (not in repo)
│   └── logo*.png      # Branding assets
└── styles/
    └── globals.css    # Global styles
```

## Note

Audio files (*.mp3, *.aif, *.wav) are excluded from the repository. Add them locally to the `public/mixes/` directory.
