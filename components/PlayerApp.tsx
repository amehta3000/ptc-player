import React, { useRef, useEffect, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { useVisualizer } from '../lib/useVisualizer';
import { extractColors } from '../lib/colorExtractor';
import { trackEvent, trackGAEvent } from '../lib/analytics';
import { OverlayDrawerFn } from '../lib/exportManager';
import { mixes, getMixBySlug } from '../data/mixes';
import { buildShareUrl, parseShareParam } from '../lib/shareState';
import DetailView from './DetailView';

interface PlayerAppProps {
  initialSlug?: string;
}

export default function PlayerApp({ initialSlug }: PlayerAppProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerContainerRef = useRef<HTMLDivElement | null>(null);

  const [showIntro, setShowIntro] = useState(true);
  const [introTimeout, setIntroTimeout] = useState(5500);
  const [introForceOut, setIntroForceOut] = useState(false);

  const handleIntroDismiss = useCallback(() => {
    setShowIntro(false);
    setIntroForceOut(false);
  }, []);

  const handleShowAbout = useCallback(() => {
    if (showIntro) {
      setIntroForceOut(true);
    } else {
      setIntroForceOut(false);
      setIntroTimeout(30000);
      setShowIntro(true);
    }
  }, [showIntro]);

  // Parse share state synchronously at render time — before any effects can call replaceState
  const [initialShareState] = useState(() => {
    if (typeof window === 'undefined') return null;
    const vizParam = new URLSearchParams(window.location.search).get('viz');
    return vizParam ? parseShareParam(vizParam) : null;
  });

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
  const darkMode = usePlayerStore((s) => s.darkMode);
  const toggleDarkMode = usePlayerStore((s) => s.toggleDarkMode);
  const setDarkMode = usePlayerStore((s) => s.setDarkMode);

  // Intro overlay for screenshot/recording — updated each render so it's always current
  const introOverlayRef = useRef<OverlayDrawerFn | null>(null);
  introOverlayRef.current = showIntro
    ? (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const primary   = darkMode ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.70)';
        const secondary = darkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
        const muted     = darkMode ? 'rgba(255,255,255,0.40)' : 'rgba(0,0,0,0.40)';
        const divider   = darkMode ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.20)';

        const leftPad = w * 0.08;
        const rightPad = w * 0.04;
        const maxTextW = w - leftPad - rightPad;

        // Measure title at nominal size and scale all sizes down proportionally if needed
        let sz1 = w * 0.08;
        ctx.font = `bold ${sz1}px "Stint Ultra Expanded", serif`;
        const titleMeasured = ctx.measureText('PART TIME CHILLER').width;
        const scale = titleMeasured > maxTextW ? maxTextW / titleMeasured : 1;
        sz1 *= scale;
        const sz2 = w * 0.038 * scale;
        const sz3 = w * 0.024 * scale;
        const sz4 = w * 0.038 * scale;
        const gap1 = w * 0.011;  // mt-4 equivalent
        const gap2 = w * 0.017;  // mt-6 equivalent
        const pt   = w * 0.011;  // pt-4 equivalent

        const mixTitle = currentMix?.title;
        const totalH = sz1 + gap1 + sz2 * 1.25 + sz3 * 1.25 + (mixTitle ? gap2 + 1 + pt + sz4 * 1.25 : 0);
        let y = (h - totalH) / 2;

        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = `bold ${sz1}px "Stint Ultra Expanded", serif`;
        ctx.fillStyle = primary;
        ctx.fillText('PART TIME CHILLER', leftPad, y);
        y += sz1 + gap1;

        ctx.font = `bold ${sz2}px "Stint Ultra Expanded", serif`;
        ctx.fillStyle = secondary;
        ctx.fillText('MUSIC FOR THE IN BETWEEN', leftPad, y);
        y += sz2 * 1.25;

        ctx.font = `bold ${sz3}px "Stint Ultra Expanded", serif`;
        ctx.fillStyle = muted;
        ctx.fillText('A VISUAL BEAT TAPE + DJ MIXES', leftPad, y);
        y += sz3 * 1.25;

        if (mixTitle) {
          y += gap2;
          ctx.strokeStyle = divider;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(leftPad, y);
          ctx.lineTo(w * 0.7, y);
          ctx.stroke();
          y += 1 + pt;
          ctx.font = `bold ${sz4}px "Stint Ultra Expanded", serif`;
          ctx.fillStyle = primary;
          ctx.fillText(mixTitle.toUpperCase(), leftPad, y);
        }

        ctx.restore();
      }
    : null;

  // Visualizer hook
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
    currentConfig,
  } = useVisualizer({
    audioRef,
    containerRef: visualizerContainerRef,
    visualizerType,
    colors: { dominant: dominantColor, accent: accentColor },
    isPlaying,
    enabled: showVisualizer && !!currentMix,
    darkMode,
    overlayRef: introOverlayRef,
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

    if (mix.slug) {
      window.history.replaceState({}, '', `/track/${mix.slug}`);
    }

    const colors = await extractColors(mix.cover);
    setDominantColor(colors.dominant);
    setAccentColor(colors.accent);

    setIntroForceOut(false);
    setIntroTimeout(5500);
    setShowIntro(true);

    trackEvent('song_selected', mix.title);
  }, [setCurrentMix, setProgress, setCurrentTime, setDuration, setShowDetail, setDominantColor, setAccentColor]);

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
    const targetMix = initialSlug ? getMixBySlug(initialSlug) : mixes[0];
    if (!targetMix) return;
    (async () => {
      setCurrentMix(targetMix);
      setShowDetail(true);
      setShowVisualizer(true);
      if (targetMix.slug) {
        window.history.replaceState({}, '', `/track/${targetMix.slug}`);
      }
      const colors = await extractColors(targetMix.cover);
      setDominantColor(colors.dominant);
      setAccentColor(colors.accent);
    })();
  }, []);

  // Restore shared visualizer state from ?viz= URL param
  useEffect(() => {
    if (!initialShareState) return;
    setVisualizerType(initialShareState.v);
    setDarkMode(initialShareState.d);
    if (Object.keys(initialShareState.c).length > 0) {
      setTimeout(() => applyPreset(initialShareState.c), 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build and copy the share URL for the current track + visualizer state
  const handleShare = useCallback(() => {
    if (!currentMix?.slug) return;
    const url = buildShareUrl(currentMix.slug, visualizerType, visualizerControls, darkMode);
    navigator.clipboard.writeText(url).catch(() => {
      // Fallback for browsers that block clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    });
    trackEvent('share_link_copied', currentMix.title);
  }, [currentMix, visualizerType, visualizerControls]);

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

  // Visualizer dwell time tracking
  const dwellStartRef = useRef<number>(Date.now());
  const dwellTypeRef = useRef<string>(visualizerType);

  useEffect(() => {
    const prev = dwellTypeRef.current;
    const elapsed = Math.round((Date.now() - dwellStartRef.current) / 1000);

    // Fire for the outgoing visualizer if they spent at least 5s on it
    if (elapsed >= 5) {
      trackGAEvent('visualizer_dwell', {
        visualizer_type: prev,
        duration_seconds: elapsed,
      });
    }

    dwellTypeRef.current = visualizerType;
    dwellStartRef.current = Date.now();
  }, [visualizerType]);

  useEffect(() => {
    const handleUnload = () => {
      const elapsed = Math.round((Date.now() - dwellStartRef.current) / 1000);
      if (elapsed >= 5) {
        trackGAEvent('visualizer_dwell', {
          visualizer_type: dwellTypeRef.current,
          duration_seconds: elapsed,
        });
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
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
        onShare={handleShare}
        onShowAbout={handleShowAbout}
        showIntro={showIntro}
        introTimeout={introTimeout}
        introForceOut={introForceOut}
        onIntroDismiss={handleIntroDismiss}
      />
    </div>
  );
}
