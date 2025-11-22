# PartTimeChiller Music Player

A modern, dynamic music player built with Next.js featuring real-time audio visualization and album art color theming.

## Features

- 🎨 **Dynamic Color Theming** - Automatically extracts colors from album artwork
- 📊 **Real-time Audio Visualizer** - 32-band frequency spectrum analyzer
- 🎵 **Smooth Playback** - Progress tracking with seek functionality
- ⏩ **Skip Controls** - Jump forward/backward 10 seconds
- 📱 **Responsive Design** - Optimized for mobile and desktop
- 🌐 **Social Integration** - Instagram, YouTube, and Spotify links
- ✨ **Glassmorphic UI** - Modern frosted glass effects
- 🔤 **Space Mono Font** - Clean, monospace typography
- 📈 **Analytics Tracking** - Microsoft Clarity integration for user behavior insights

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Add your audio files to `public/mixes/` (*.mp3, *.aif files not included in repo)

3. Set up Microsoft Clarity (optional but recommended for analytics):
   - Go to [https://clarity.microsoft.com/](https://clarity.microsoft.com/)
   - Create a new project
   - Copy your Project ID
   - Create a `.env.local` file in the root directory:
   ```bash
   cp .env.local.example .env.local
   ```
   - Add your Clarity Project ID to `.env.local`:
   ```
   NEXT_PUBLIC_CLARITY_PROJECT_ID=your_project_id_here
   ```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

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

## Analytics Events Tracked

When Microsoft Clarity is configured, the following user interactions are tracked:

- `song_selected` - When a user clicks on a song/mix
- `song_played` - When playback starts
- `song_paused` - When playback is paused
- `song_completed` - When a song finishes playing
- `skip_forward` - When user skips forward (+10s)
- `skip_backward` - When user skips backward (-10s)
- `progress_scrubbed` - When user clicks on the progress bar to seek
- `download_clicked` - When the download button is clicked

All events include the song title for detailed analytics.

## Note

Audio files (*.mp3, *.aif, *.wav) are excluded from the repository. Add them locally to the `public/mixes/` directory.
