import React, { useCallback, useRef, useState } from 'react';
import PlayerApp from './PlayerApp';
import { Mix } from '../data/mixes';
import { usePlayerStore, FONTS } from '../store/usePlayerStore';
import { useFontTools } from '../lib/useFontTools';

// Default cover when the user doesn't upload artwork — a warm gradient the
// color extractor can pull real dominant/accent colors from (data URIs are
// same-origin, so pixel reads always work)
const DEFAULT_COVER =
  'data:image/svg+xml,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#e2604f"/>
        <stop offset="0.55" stop-color="#7d3b8f"/>
        <stop offset="1" stop-color="#1f2d63"/>
      </linearGradient>
    </defs>
    <rect width="256" height="256" fill="url(#g)"/>
  </svg>`);

function fileTitle(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'My Track';
}

export default function StudioApp() {
  // Same typography system as the main player: current font applied
  // everywhere, Cmd/Ctrl+D reveals the font selector
  const { currentFont, setCurrentFont, showDebug } = useFontTools();
  const [mix, setMix] = useState<Mix | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const acceptAudioFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|flac|aac)$/i.test(file.name)) {
      setError('That doesn’t look like an audio file — try an MP3, M4A, WAV, OGG, or FLAC.');
      return;
    }
    setError(null);
    setAudioFile(file);
  }, []);

  const acceptCoverFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    setCoverFile(file);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }, []);

  const handleStart = useCallback(() => {
    if (!audioFile) return;
    const audioUrl = URL.createObjectURL(audioFile);
    objectUrlsRef.current.push(audioUrl);
    let cover = DEFAULT_COVER;
    if (coverFile) {
      cover = coverPreview ?? URL.createObjectURL(coverFile);
      objectUrlsRef.current.push(cover);
    }
    setMix({
      title: fileTitle(audioFile),
      slug: 'studio',
      cover,
      audio: audioUrl,
      duration: '',
      description: 'Made in PTC Studio',
      type: 'track',
      artist: 'Your Track',
    });
  }, [audioFile, coverFile, coverPreview]);

  const handleNewTrack = useCallback(() => {
    const store = usePlayerStore.getState();
    store.setIsPlaying(false);
    store.setCurrentMix(null);
    store.setProgress(0);
    store.setCurrentTime(0);
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrlsRef.current = [];
    setMix(null);
    setAudioFile(null);
    setCoverFile(null);
    setCoverPreview(null);
  }, []);

  if (mix) {
    return <PlayerApp key={mix.audio} studioMix={mix} onStudioNewTrack={handleNewTrack} />;
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col" style={{ fontFamily: currentFont }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-3">
            <img src="https://media.parttimechiller.com/logo3.png" alt="PTC" className="h-10 w-10" />
            <span className="text-lg font-bold">PTC Studio</span>
          </a>
          {showDebug && (
            <select
              value={currentFont}
              onChange={(e) => setCurrentFont(e.target.value)}
              className="ml-2 px-2 py-1 text-xs rounded border border-neutral-700 bg-black/50 backdrop-blur hover:border-white transition-colors cursor-pointer focus:outline-none focus:border-white"
              title="Select Font (Debug Mode)"
            >
              {FONTS.map(font => (
                <option key={font} value={font} style={{ fontFamily: font }}>
                  {font}
                </option>
              ))}
            </select>
          )}
        </div>
        <a
          href="/"
          className="px-3 h-9 rounded-full flex items-center text-xs font-medium bg-neutral-800 text-white hover:bg-neutral-700 transition-all"
        >
          Back to player
        </a>
      </div>

      {/* Upload card */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg">
          <h1 className="text-2xl sm:text-3xl font-bold text-center mb-2">Create your own visual</h1>
          <p className="text-sm text-white/60 text-center mb-8">
            Upload a track, play with the visualizers, then record a video sized for
            TikTok, Reels, Instagram, or YouTube. Your music never leaves your browser.
          </p>

          {/* Audio dropzone */}
          <div
            onClick={() => audioInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              acceptAudioFile(e.dataTransfer.files?.[0]);
            }}
            className={`rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-white/60 bg-white/10'
                : audioFile
                ? 'border-emerald-400/50 bg-emerald-400/5'
                : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
            }`}
          >
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac"
              className="hidden"
              onChange={(e) => acceptAudioFile(e.target.files?.[0])}
            />
            {audioFile ? (
              <>
                <svg className="w-8 h-8 mx-auto mb-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-2v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-2a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div className="text-sm font-medium">{audioFile.name}</div>
                <div className="text-xs text-white/50 mt-1">Tap to choose a different file</div>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 mx-auto mb-2 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
                </svg>
                <div className="text-sm font-medium">Drop your track here</div>
                <div className="text-xs text-white/50 mt-1">MP3, M4A, WAV, OGG, FLAC</div>
              </>
            )}
          </div>
          {error && <p className="text-xs text-red-400 mt-2 text-center">{error}</p>}

          {/* Optional cover art */}
          <div
            onClick={() => coverInputRef.current?.click()}
            className="mt-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 flex items-center gap-3 cursor-pointer transition-all"
          >
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => acceptCoverFile(e.target.files?.[0])}
            />
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="Cover preview" className="w-10 h-10 rounded object-cover" />
            ) : (
              <div className="w-10 h-10 rounded" style={{ background: 'linear-gradient(135deg, #e2604f, #7d3b8f, #1f2d63)' }} />
            )}
            <div className="flex-1">
              <div className="text-sm">{coverFile ? coverFile.name : 'Add cover art (optional)'}</div>
              <div className="text-xs text-white/50">Sets the color palette of the visuals</div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!audioFile}
            className={`w-full mt-6 py-3 rounded-xl text-sm font-semibold transition-all ${
              audioFile
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            Enter the Studio
          </button>

          <p className="text-[11px] text-white/40 text-center mt-4">
            Everything runs locally in your browser — nothing is uploaded to a server.
          </p>
        </div>
      </div>
    </div>
  );
}
