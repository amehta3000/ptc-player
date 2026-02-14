import React, { useCallback } from 'react';
import { usePlayerStore, VISUALIZER_NAMES, VISUALIZER_TYPES, FONTS } from '../store/usePlayerStore';
import { VisualizerControl } from '../lib/visualizers/BaseVisualizer';
import VisualizerControls from './VisualizerControls';
import VisualizerContainer from './VisualizerContainer';
import { trackEvent } from '../lib/analytics';
import { Mix } from '../data/mixes';
import { extractColors } from '../lib/colorExtractor';
import TrackMenu from './TrackMenu';

interface DetailViewProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  onTogglePlay: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
  visualizerControls: VisualizerControl[];
  onUpdateConfig: (key: string, value: number) => void;
  onResetConfig: () => void;
  onRandomize: () => void;
  visualizerName: string;
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function DetailView({
  audioRef,
  containerRef,
  onTogglePlay,
  onPlayNext,
  onPlayPrevious,
  visualizerControls,
  onUpdateConfig,
  onResetConfig,
  onRandomize,
  visualizerName,
}: DetailViewProps) {
  const currentMix = usePlayerStore((s) => s.currentMix);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const dominantColor = usePlayerStore((s) => s.dominantColor);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const setShowVisualizer = usePlayerStore((s) => s.setShowVisualizer);
  const showControls = usePlayerStore((s) => s.showControls);
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const visualizerType = usePlayerStore((s) => s.visualizerType);
  const setVisualizerType = usePlayerStore((s) => s.setVisualizerType);
  const getCurrentIndex = usePlayerStore((s) => s.getCurrentIndex);
  const getFilteredMixes = usePlayerStore((s) => s.getFilteredMixes);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const showPlaylist = usePlayerStore((s) => s.showPlaylist);
  const setShowPlaylist = usePlayerStore((s) => s.setShowPlaylist);
  const setCurrentMix = usePlayerStore((s) => s.setCurrentMix);
  const setDominantColor = usePlayerStore((s) => s.setDominantColor);
  const setAccentColor = usePlayerStore((s) => s.setAccentColor);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const showDebug = usePlayerStore((s) => s.showDebug);
  const currentFont = usePlayerStore((s) => s.currentFont);
  const setCurrentFont = usePlayerStore((s) => s.setCurrentFont);
  const filter = usePlayerStore((s) => s.filter);
  const setFilter = usePlayerStore((s) => s.setFilter);

  const currentIndex = getCurrentIndex();
  const filteredMixes = getFilteredMixes();
  const currentDisplayName = showVisualizer ? VISUALIZER_NAMES[visualizerType] : 'Album Art';

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercentage = (clickX / rect.width) * 100;
    const newTime = (clickPercentage / 100) * audio.duration;
    audio.currentTime = newTime;
    setProgress(clickPercentage);
    setCurrentTime(newTime);
    trackEvent('progress_scrubbed', currentMix?.title);
  }, [audioRef, currentMix, setProgress, setCurrentTime]);

  const navigateView = useCallback((direction: 1 | -1) => {
    const totalCount = VISUALIZER_TYPES.length + 1;
    const currentIdx = showVisualizer
      ? VISUALIZER_TYPES.indexOf(visualizerType) + 1
      : 0;
    const nextIndex = (currentIdx + direction + totalCount) % totalCount;

    if (nextIndex === 0) {
      setShowVisualizer(false);
    } else {
      setShowVisualizer(true);
      setVisualizerType(VISUALIZER_TYPES[nextIndex - 1]);
    }
  }, [showVisualizer, visualizerType, setShowVisualizer, setVisualizerType]);

  const handleMixSelect = useCallback(async (mix: Mix) => {
    setCurrentMix(mix);
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);
    setShowPlaylist(false);

    const colors = await extractColors(mix.cover);
    setDominantColor(colors.dominant);
    setAccentColor(colors.accent);

    trackEvent('song_selected', mix.title);
  }, [setCurrentMix, setProgress, setCurrentTime, setDuration, setShowPlaylist, setDominantColor, setAccentColor]);

  if (!currentMix) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Background */}
      <div
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          backgroundImage: `url(${currentMix.cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black/85 backdrop-blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowPlaylist(!showPlaylist)}>
          <img src="https://media.parttimechiller.com/logo3.png" alt="PTC" className="h-10 w-10" />
          <span className="text-lg font-bold hidden sm:inline">Part Time Chiller</span>
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

        {/* Social media icons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <a href="https://instagram.com/parttimechiller" target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:scale-110" title="Instagram">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          </a>
          <a href="https://youtube.com/@parttimechiller" target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-red-600 hover:scale-110" title="YouTube">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
          </a>
          <a href="https://open.spotify.com/user/ameet3000?si=833fb8c8623241a1" target="_blank" rel="noopener noreferrer"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all bg-neutral-800 hover:bg-green-500 hover:scale-110" title="Spotify">
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </a>
        </div>

        <div className="flex items-center gap-2">
          {/* View navigator: < Name > */}
          <div className="flex items-center">
            <button
              onClick={() => navigateView(-1)}
              className="px-2 py-1 rounded-l bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
              aria-label="Previous view"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="px-3 py-1 bg-neutral-800/80 text-white text-sm select-none min-w-[5rem] text-center whitespace-nowrap">
              {currentDisplayName}
            </span>
            <button
              onClick={() => navigateView(1)}
              className="px-2 py-1 rounded-r bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
              aria-label="Next view"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {showVisualizer && (
            <>
              {/* Randomize */}
              <button
                onClick={onRandomize}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                title="Randomize Visualizer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </button>
              {/* Toggle controls */}
              <button
                onClick={() => setShowControls(!showControls)}
                className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-sm transition-colors"
                title={showControls ? 'Hide Controls' : 'Show Controls'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Control Panel */}
      {showControls && showVisualizer && (
        <VisualizerControls
          controls={visualizerControls}
          onUpdateConfig={onUpdateConfig}
          onReset={onResetConfig}
          visualizerName={visualizerName}
        />
      )}

      {/* Full-viewport visualizer layer (behind UI) */}
      {showVisualizer && (
        <div className="absolute inset-0 z-[5] p-4">
          <VisualizerContainer containerRef={containerRef} />
        </div>
      )}

      {/* Middle area — album art when not visualizing, spacer when visualizing */}
      <div className={`relative z-10 flex-1 flex flex-col items-center justify-center p-4 gap-6${showVisualizer ? ' pointer-events-none' : ''}`}>
        {!showVisualizer && <VisualizerContainer containerRef={containerRef} />}
      </div>

      {/* Playlist Drawer */}
      <div
        className={`absolute bottom-[72px] left-4 right-4 z-20 rounded-lg backdrop-blur-xl bg-black/60 border border-white/10 max-h-[60vh] overflow-y-auto transition-all duration-300 ${
          showPlaylist ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className="sticky top-0 z-10 p-3 pb-2 backdrop-blur-xl bg-black/80 border-b border-white/10 flex items-center justify-between">
          <span className="text-sm text-neutral-300">{filteredMixes.length} tracks</span>
          <div className="flex gap-1">
            {(['all', 'track', 'mix'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 text-xs rounded ${filter === f ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/70'}`}
              >
                {f === 'all' ? 'All' : f === 'track' ? 'Tracks' : 'Mixes'}
              </button>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-1">
          {filteredMixes.map((mix, idx) => (
            <div
              key={idx}
              onClick={() => handleMixSelect(mix)}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/10 active:scale-[0.99] ${
                currentMix?.title === mix.title ? 'bg-white/10 border border-white/20' : 'border border-transparent'
              }`}
            >
              <img
                src={mix.cover}
                alt={mix.title}
                className="w-10 h-10 rounded object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{mix.title}</div>
                <div className="text-xs text-neutral-400 truncate">{mix.description} &bull; {mix.duration}</div>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                mix.type === 'mix'
                  ? 'border-purple-500/40 text-purple-400/90'
                  : 'border-blue-500/40 text-blue-400/90'
              }`}>
                {mix.type}
              </span>
              <TrackMenu mix={mix} position="below" />
            </div>
          ))}
        </div>
      </div>

      {/* Slim Player Bar */}
      <div
        className="relative z-10 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 backdrop-blur-xl border-t border-neutral-800/50"
        style={{
          background: `linear-gradient(to right, ${dominantColor}25, ${accentColor}25)`,
        }}
      >
        {/* Album art — toggles playlist */}
        <button
          className="p-0 m-0 border-none bg-transparent flex-shrink-0"
          onClick={() => setShowPlaylist(!showPlaylist)}
          aria-label={showPlaylist ? 'Hide playlist' : 'Show playlist'}
        >
          <img
            src={currentMix.cover}
            alt={currentMix.title}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover shadow-lg transition-all duration-500"
            style={{ boxShadow: `0 0 0 2px ${accentColor}40` }}
          />
        </button>

        {/* Track info + progress */}
        <div className="flex-1 min-w-0">
          <div className="text-xs sm:text-sm font-medium truncate">{currentMix.title}</div>
          <div
            className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-1 cursor-pointer relative backdrop-blur"
            onClick={handleProgressClick}
          >
            <div
              className="h-full transition-all duration-300 shadow-lg"
              style={{ width: `${progress}%`, background: `linear-gradient(to right, ${dominantColor}, ${accentColor})` }}
            />
          </div>
          <div className="flex justify-between items-center mt-0.5">
            <span className="text-[10px] sm:text-xs text-neutral-300">{formatTime(currentTime)} / {formatTime(duration)}</span>
          </div>
        </div>

        {/* Shuffle */}
        <button
          onClick={toggleShuffle}
          className={`w-8 h-8 rounded-full flex-shrink-0 hidden sm:flex items-center justify-center transition-all ${
            shuffleMode ? 'text-white' : 'text-white/40 hover:text-white/70'
          }`}
          style={shuffleMode ? { color: accentColor } : undefined}
          aria-label="Toggle shuffle"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
          </svg>
        </button>

        {/* Playback controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button
            onClick={onPlayPrevious}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})` }}
            disabled={currentIndex === 0 && repeatMode === 'off'}
            aria-label="Previous track"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})` }}
          >
            {isPlaying ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={onPlayNext}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 hover:scale-105 active:scale-95"
            style={{ background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})` }}
            disabled={currentIndex === filteredMixes.length - 1 && repeatMode === 'off'}
            aria-label="Next track"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Repeat */}
        <button
          onClick={cycleRepeat}
          className={`w-8 h-8 rounded-full flex-shrink-0 hidden sm:flex items-center justify-center transition-all relative ${
            repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white/70'
          }`}
          style={repeatMode !== 'off' ? { color: accentColor } : undefined}
          aria-label={`Repeat: ${repeatMode}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {repeatMode === 'one' && (
            <span className="absolute -top-0.5 -right-0.5 text-[8px] font-bold" style={{ color: accentColor }}>1</span>
          )}
        </button>

        {/* Volume control */}
        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-all"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
            ) : volume < 0.5 ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (isMuted && v > 0) toggleMute();
            }}
            className="w-16 lg:w-20 h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10"
            style={{ accentColor: dominantColor }}
            aria-label="Volume"
          />
        </div>

        {/* Track menu */}
        <TrackMenu mix={currentMix} position="above" />
      </div>
    </div>
  );
}
