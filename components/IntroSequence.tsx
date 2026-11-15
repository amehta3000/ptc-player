import React, { useCallback, useEffect, useRef, useState } from 'react';

interface IntroSequenceProps {
  onDismiss: () => void;
  autoTimeout?: number;
  forceOut?: boolean;
  currentMixTitle?: string;
  resetToken?: string;
  darkMode?: boolean;
}

export default function IntroSequence({ onDismiss, autoTimeout = 5500, forceOut, currentMixTitle, resetToken, darkMode = true }: IntroSequenceProps) {
  const [animatingOut, setAnimatingOut] = useState(false);
  const dismissedRef = useRef(false);

  const handleDismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setAnimatingOut(true);
    setTimeout(onDismiss, 600);
  }, [onDismiss]);

  // Reset timer (and any in-progress fade) whenever the song changes
  useEffect(() => {
    dismissedRef.current = false;
    setAnimatingOut(false);
    const timer = setTimeout(handleDismiss, autoTimeout);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useEffect(() => {
    if (forceOut) handleDismiss();
  }, [forceOut, handleDismiss]);

  const c = darkMode
    ? { primary: 'text-white/70', secondary: 'text-white/55', muted: 'text-white/40', divider: 'border-white/20' }
    : { primary: 'text-black/70', secondary: 'text-black/55', muted: 'text-black/40', divider: 'border-black/20' };

  return (
    // intro-stage makes this the sizing container: the type below is measured
    // against this column's width, which narrows when the playlist rail opens.
    <div className="intro-stage absolute inset-0 z-[18]">
      <div
        className={`w-full h-full flex flex-col items-start justify-center cursor-pointer select-none pl-12 sm:pl-16 md:pl-20 lg:pl-28 ${animatingOut ? 'intro-out' : ''}`}
        onClick={handleDismiss}
      >
      <div
        className={`intro-word intro-title ${c.primary} font-bold leading-none tracking-tight`}
        style={{ animationDelay: '100ms' }}
      >
        PART TIME CHILLER
      </div>
      <div
        className={`intro-word intro-tagline ${c.secondary} font-bold leading-tight tracking-tight mt-4`}
        style={{ animationDelay: '500ms' }}
      >
        MUSIC FOR THE IN BETWEEN
      </div>
      <div
        className={`intro-word intro-sub ${c.muted} font-bold leading-tight tracking-tight`}
        style={{ animationDelay: '900ms' }}
      >
        A VISUAL BEAT TAPE + DJ MIXES
      </div>
      {currentMixTitle && (
        <div
          className={`intro-word intro-tagline ${c.primary} font-bold leading-tight tracking-tight mt-6 border-t ${c.divider} pt-4`}
          style={{ animationDelay: '1200ms' }}
        >
          {currentMixTitle.toUpperCase()}
        </div>
        )}
      </div>
    </div>
  );
}
