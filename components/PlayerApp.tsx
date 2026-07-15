import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useVisualizer } from '../lib/useVisualizer';
import { extractColors } from '../lib/colorExtractor';
import { readAudioMetadata } from '../lib/audioMetadata';
import { Track, titleFromFilename } from '../data/track';
import UploadDropzone from './UploadDropzone';
import StudioView from './StudioView';

export default function PlayerApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerContainerRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEmbeddedCover, setHasEmbeddedCover] = useState(false);

  // Store selectors
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const dominantColor = usePlayerStore((s) => s.dominantColor);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const setDominantColor = usePlayerStore((s) => s.setDominantColor);
  const setAccentColor = usePlayerStore((s) => s.setAccentColor);
  const setCurrentTrack = usePlayerStore((s) => s.setCurrentTrack);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const visualizerType = usePlayerStore((s) => s.visualizerType);
  const setVisualizerType = usePlayerStore((s) => s.setVisualizerType);
  const currentFont = usePlayerStore((s) => s.currentFont);
  const darkMode = usePlayerStore((s) => s.darkMode);
  const toggleDarkMode = usePlayerStore((s) => s.toggleDarkMode);

  // Visualizer hook — same engine used by the original player
  const {
    controls: visualizerControls,
    presets: visualizerPresets,
    updateConfig,
    resetToDefaults,
    randomize,
    applyPreset,
    randomizeControls,
    visualizerName,
    audioContextRef,
    takeScreenshot,
    toggleRecording,
    cancelConversion,
    recordingState,
  } = useVisualizer({
    audioRef,
    containerRef: visualizerContainerRef,
    visualizerType,
    colors: { dominant: dominantColor, accent: accentColor },
    isPlaying,
    enabled: showVisualizer && !!currentTrack,
    darkMode,
  });

  // Sync volume to the audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle a newly uploaded file: analyze metadata, theme, and start playback
  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      try {
        // Release any previous object URLs
        objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        objectUrlsRef.current = [];

        const audioUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(audioUrl);

        const meta = await readAudioMetadata(file);
        const cover = meta.coverUrl ?? null;
        if (cover) objectUrlsRef.current.push(cover);

        // Theme from embedded album art when available
        if (cover) {
          const colors = await extractColors(cover);
          setDominantColor(colors.dominant);
          setAccentColor(colors.accent);
        }
        setHasEmbeddedCover(!!cover);

        const track: Track = {
          title: meta.title || titleFromFilename(file.name),
          artist: meta.artist || '',
          audio: audioUrl,
          cover,
        };
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setCurrentTrack(track);
      } catch (err) {
        console.error('Failed to load track:', err);
        setError('Could not read that file. Try another audio file.');
      } finally {
        setProcessing(false);
      }
    },
    [setDominantColor, setAccentColor, setCurrentTrack, setProgress, setCurrentTime, setDuration]
  );

  // Audio element event wiring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
    };
  }, [currentTrack, setProgress, setCurrentTime, setDuration, setIsPlaying]);

  // Load + attempt autoplay when a track is selected
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;
    const audio = audioRef.current;
    const timer = setTimeout(async () => {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        audio.load();
        await audio.play();
        setIsPlaying(true);
      } catch {
        // Autoplay blocked — user can press play
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentTrack, audioContextRef, setIsPlaying]);

  // Font loading
  useEffect(() => {
    const fontFamily = currentFont.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [currentFont]);

  // Keyboard: space toggles play, arrows adjust volume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const s = usePlayerStore.getState();
        s.setVolume(Math.min(1, s.volume + 0.05));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const s = usePlayerStore.getState();
        s.setVolume(Math.max(0, s.volume - 0.05));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setIsPlaying(true);
      } catch {
        // ignore
      }
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [audioContextRef, setIsPlaying]);

  const handleNewFile = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentTrack(null);
    setHasEmbeddedCover(false);
  }, [setCurrentTrack, setIsPlaying]);

  const handleRandomize = useCallback(() => {
    const newType = randomize();
    setVisualizerType(newType);
  }, [randomize, setVisualizerType]);

  return (
    <div className="min-h-screen bg-black text-white relative" style={{ fontFamily: currentFont }}>
      {/* Persistent audio element so the Web Audio source node stays valid across tracks */}
      <audio ref={audioRef} src={currentTrack?.audio} preload="metadata" />

      {!currentTrack ? (
        <UploadDropzone onFile={handleFile} processing={processing} error={error} />
      ) : (
        <StudioView
          audioRef={audioRef}
          containerRef={visualizerContainerRef}
          onTogglePlay={togglePlay}
          visualizerControls={visualizerControls}
          visualizerPresets={visualizerPresets}
          onUpdateConfig={updateConfig}
          onResetConfig={resetToDefaults}
          onRandomize={handleRandomize}
          onApplyPreset={applyPreset}
          onRandomizeControls={randomizeControls}
          visualizerName={visualizerName}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onScreenshot={takeScreenshot}
          onToggleRecording={toggleRecording}
          onCancelConversion={cancelConversion}
          recordingState={recordingState}
          onNewFile={handleNewFile}
          hasEmbeddedCover={hasEmbeddedCover}
        />
      )}
    </div>
  );
}
