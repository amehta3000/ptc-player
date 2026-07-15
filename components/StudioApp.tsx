import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useVisualizer } from '../lib/useVisualizer';
import { extractColors } from '../lib/colorExtractor';
import { readAudioMetadata } from '../lib/audioMetadata';
import { titleFromFilename } from '../data/track';
import { Mix } from '../data/mixes';
import UploadDropzone from './UploadDropzone';
import StudioView from './StudioView';

/**
 * The upload-driven visualizer studio (route: /studio).
 *
 * Reuses the shared player store and the same audio/visualizer/export engine as
 * the main PartTimeChiller player, but sources its `currentMix` from a
 * user-uploaded file (a blob URL) instead of the fixed catalog.
 */
export default function StudioApp() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerContainerRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasEmbeddedCover, setHasEmbeddedCover] = useState(false);

  const currentMix = usePlayerStore((s) => s.currentMix);
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
  const setCurrentMix = usePlayerStore((s) => s.setCurrentMix);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const setShowVisualizer = usePlayerStore((s) => s.setShowVisualizer);
  const visualizerType = usePlayerStore((s) => s.visualizerType);
  const setVisualizerType = usePlayerStore((s) => s.setVisualizerType);
  const currentFont = usePlayerStore((s) => s.currentFont);
  const darkMode = usePlayerStore((s) => s.darkMode);
  const toggleDarkMode = usePlayerStore((s) => s.toggleDarkMode);

  // Start clean — clear any leftover catalog track from the main player and
  // ensure the visualizer (not the cover) is shown for uploads.
  useEffect(() => {
    setCurrentMix(null);
    setShowVisualizer(true);
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    enabled: showVisualizer && !!currentMix,
    darkMode,
  });

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const handleFile = useCallback(
    async (file: File) => {
      setProcessing(true);
      setError(null);
      try {
        objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        objectUrlsRef.current = [];

        const audioUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(audioUrl);

        const meta = await readAudioMetadata(file);
        const cover = meta.coverUrl ?? '';
        if (cover) objectUrlsRef.current.push(cover);

        if (cover) {
          const colors = await extractColors(cover);
          setDominantColor(colors.dominant);
          setAccentColor(colors.accent);
        }
        setHasEmbeddedCover(!!cover);

        const mix: Mix = {
          title: meta.title || titleFromFilename(file.name),
          slug: 'upload',
          cover,
          audio: audioUrl,
          duration: '',
          description: '',
          type: 'track',
          artist: meta.artist || '',
        };
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setShowVisualizer(true);
        setCurrentMix(mix);
      } catch (err) {
        console.error('Failed to load track:', err);
        setError('Could not read that file. Try another audio file.');
      } finally {
        setProcessing(false);
      }
    },
    [setDominantColor, setAccentColor, setCurrentMix, setProgress, setCurrentTime, setDuration, setShowVisualizer]
  );

  // Audio element event wiring
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMix) return;

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
  }, [currentMix, setProgress, setCurrentTime, setDuration, setIsPlaying]);

  // Load + attempt autoplay when a track is selected
  useEffect(() => {
    if (!currentMix || !audioRef.current) return;
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
  }, [currentMix, audioContextRef, setIsPlaying]);

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
  }, [togglePlay]);

  const handleNewFile = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentMix(null);
    setHasEmbeddedCover(false);
  }, [setCurrentMix, setIsPlaying]);

  const handleRandomize = useCallback(() => {
    const newType = randomize();
    setVisualizerType(newType);
  }, [randomize, setVisualizerType]);

  return (
    <div className="min-h-screen bg-black text-white relative" style={{ fontFamily: currentFont }}>
      {/* Persistent audio element so the Web Audio source node stays valid across tracks */}
      <audio ref={audioRef} src={currentMix?.audio} preload="metadata" />

      {!currentMix ? (
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
