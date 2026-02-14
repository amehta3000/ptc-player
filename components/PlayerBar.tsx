import React, { useCallback } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { trackEvent } from '../lib/analytics';

interface PlayerBarProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  onTogglePlay: () => void;
  onPlayNext: () => void;
  onPlayPrevious: () => void;
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

export default function PlayerBar({ audioRef, onTogglePlay, onPlayNext, onPlayPrevious }: PlayerBarProps) {
  const currentMix = usePlayerStore((s) => s.currentMix);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const dominantColor = usePlayerStore((s) => s.dominantColor);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const setShowDetail = usePlayerStore((s) => s.setShowDetail);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const getCurrentIndex = usePlayerStore((s) => s.getCurrentIndex);
  const getFilteredMixes = usePlayerStore((s) => s.getFilteredMixes);

  const currentIndex = getCurrentIndex();
  const filteredMixes = getFilteredMixes();

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

  if (!currentMix) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 backdrop-blur-xl transition-all duration-500 z-40"
      style={{
        background: `linear-gradient(to right, ${dominantColor}25, ${accentColor}25)`,
        borderColor: `${dominantColor}30`,
      }}
    >
      {/* Album art */}
      <button className="p-0 m-0 border-none bg-transparent flex-shrink-0" onClick={() => setShowDetail(true)} aria-label="Open detailed player">
        <img
          src={currentMix.cover}
          alt={currentMix.title}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded object-cover shadow-lg transition-all duration-500"
          style={{ boxShadow: `0 0 0 2px ${accentColor}40` }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
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

      {/* Shuffle button */}
      <button
        onClick={toggleShuffle}
        className={`w-8 h-8 rounded-full flex-shrink-0 hidden sm:flex items-center justify-center transition-all ${
          shuffleMode ? 'text-white' : 'text-white/40 hover:text-white/70'
        }`}
        style={shuffleMode ? { color: accentColor } : undefined}
        aria-label="Toggle shuffle"
        title={shuffleMode ? 'Shuffle on' : 'Shuffle off'}
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
          aria-label="Previous track"
          disabled={currentIndex === 0 && repeatMode === 'off'}
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
          aria-label="Next track"
          disabled={currentIndex === filteredMixes.length - 1 && repeatMode === 'off'}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      {/* Repeat button */}
      <button
        onClick={cycleRepeat}
        className={`w-8 h-8 rounded-full flex-shrink-0 hidden sm:flex items-center justify-center transition-all relative ${
          repeatMode !== 'off' ? 'text-white' : 'text-white/40 hover:text-white/70'
        }`}
        style={repeatMode !== 'off' ? { color: accentColor } : undefined}
        aria-label={`Repeat: ${repeatMode}`}
        title={`Repeat: ${repeatMode}`}
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
    </div>
  );
}
