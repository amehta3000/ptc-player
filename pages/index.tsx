import React, { useRef, useEffect, useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useVisualizer } from '../lib/useVisualizer';
import { extractColors } from '../lib/colorExtractor';
import { trackEvent } from '../lib/analytics';
import { mixes } from '../data/mixes';
import DetailView from '../components/DetailView';

export default function Mixes() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerContainerRef = useRef<HTMLDivElement | null>(null);

  // Store selectors
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
  const setShowDetail = usePlayerStore((s) => s.setShowDetail);
  const setShowVisualizer = usePlayerStore((s) => s.setShowVisualizer);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const visualizerType = usePlayerStore((s) => s.visualizerType);
  const setVisualizerType = usePlayerStore((s) => s.setVisualizerType);
  const currentFont = usePlayerStore((s) => s.currentFont);
  const setShowDebug = usePlayerStore((s) => s.setShowDebug);

  // Visualizer hook
  const {
    controls: visualizerControls,
    updateConfig,
    resetToDefaults,
    randomize,
    visualizerName,
    audioContextRef,
  } = useVisualizer({
    audioRef,
    containerRef: visualizerContainerRef,
    visualizerType,
    colors: { dominant: dominantColor, accent: accentColor },
    isPlaying,
    enabled: showVisualizer && !!currentMix,
  });

  // Sync volume to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Select a mix (shared logic)
  const handleMixSelect = useCallback(async (mix: typeof currentMix) => {
    if (!mix) return;
    setCurrentMix(mix);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setShowDetail(true);
    setShowVisualizer(true);

    const colors = await extractColors(mix.cover);
    setDominantColor(colors.dominant);
    setAccentColor(colors.accent);

    trackEvent('song_selected', mix.title);
  }, [setCurrentMix, setProgress, setCurrentTime, setDuration, setShowDetail, setShowVisualizer, setDominantColor, setAccentColor]);

  // Audio event listeners
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
    const onEnded = () => {
      trackEvent('song_completed', currentMix.title);
      const next = usePlayerStore.getState().playNext();
      if (next) {
        handleMixSelect(next);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => console.log('Audio error');

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentMix, handleMixSelect, setProgress, setCurrentTime, setDuration, setIsPlaying]);

  // Auto-play on mix selection
  useEffect(() => {
    if (!currentMix || !audioRef.current) return;
    const timer = setTimeout(async () => {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        audioRef.current!.load();
        await audioRef.current!.play();
        setIsPlaying(true);
        trackEvent('song_played', currentMix.title);
      } catch (err) {
        console.log('Auto-play failed:', err);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [currentMix]);

  // Font loading
  useEffect(() => {
    const fontFamily = currentFont.replace(/ /g, '+');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;700&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, [currentFont]);

  // Initialize first track on mount
  useEffect(() => {
    if (currentMix) return;
    const firstMix = mixes[0];
    (async () => {
      setCurrentMix(firstMix);
      setShowDetail(true);
      setShowVisualizer(true);
      const colors = await extractColors(firstMix.cover);
      setDominantColor(colors.dominant);
      setAccentColor(colors.accent);
    })();
  }, []);

  // Debug mode keyboard shortcut (Cmd/Ctrl + D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        setShowDebug(!usePlayerStore.getState().showDebug);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowDebug]);

  // Keyboard shortcuts for volume and spacebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const s = usePlayerStore.getState();
        s.setVolume(Math.min(1, s.volume + 0.05));
      } else if (e.key === 'ArrowDown' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const s = usePlayerStore.getState();
        s.setVolume(Math.max(0, s.volume - 0.05));
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Playback controls
  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    const state = usePlayerStore.getState();

    if (state.isPlaying) {
      audio.pause();
      setIsPlaying(false);
      trackEvent('song_paused', state.currentMix?.title);
    } else {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        await audio.play();
        setIsPlaying(true);
        trackEvent('song_played', state.currentMix?.title);
      } catch (error) {
        console.log('Play failed:', error);
      }
    }
  }, [setIsPlaying, audioContextRef]);

  const playNext = useCallback(() => {
    const next = usePlayerStore.getState().playNext();
    if (next) handleMixSelect(next);
  }, [handleMixSelect]);

  const playPrevious = useCallback(() => {
    const result = usePlayerStore.getState().playPrevious();
    if (!result) return;
    if (result.action === 'restart') {
      if (audioRef.current) audioRef.current.currentTime = 0;
    } else {
      handleMixSelect(result.mix);
    }
  }, [handleMixSelect]);

  const handleRandomize = useCallback(() => {
    const newType = randomize();
    setVisualizerType(newType);
  }, [randomize, setVisualizerType]);

  return (
    <div className="min-h-screen bg-black text-white relative" style={{ fontFamily: currentFont }}>
      {currentMix && (
        <audio ref={audioRef} src={currentMix.audio} preload="metadata" crossOrigin="anonymous" />
      )}

      <DetailView
        audioRef={audioRef}
        containerRef={visualizerContainerRef}
        onTogglePlay={togglePlay}
        onPlayNext={playNext}
        onPlayPrevious={playPrevious}
        visualizerControls={visualizerControls}
        onUpdateConfig={updateConfig}
        onResetConfig={resetToDefaults}
        onRandomize={handleRandomize}
        visualizerName={visualizerName}
      />
    </div>
  );
}
