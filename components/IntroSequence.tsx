import React, { useEffect, useRef, useState } from 'react';

interface IntroSequenceProps {
  onDismiss: () => void;
}

export default function IntroSequence({ onDismiss }: IntroSequenceProps) {
  const [animatingOut, setAnimatingOut] = useState(false);
  const dismissedRef = useRef(false);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setAnimatingOut(true);
    setTimeout(onDismiss, 600);
  };

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 5500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[18] flex flex-col items-start justify-center cursor-pointer select-none pl-12 sm:pl-16 md:pl-20 lg:pl-28 ${animatingOut ? 'intro-out' : ''}`}
      onClick={handleDismiss}
    >
      <div
        className="intro-word text-white/70 font-bold leading-none tracking-tight text-[8vw] sm:text-[7vw] md:text-[6.5vw]"
        style={{ animationDelay: '100ms' }}
      >
        PART TIME CHILLER
      </div>
      <div
        className="intro-word text-white/55 font-bold leading-tight tracking-tight text-[3.8vw] sm:text-[3vw] md:text-[2.6vw] mt-4"
        style={{ animationDelay: '500ms' }}
      >
        MUSIC FOR THE IN BETWEEN
      </div>
      <div
        className="intro-word text-white/55 font-bold leading-tight tracking-tight text-[3.8vw] sm:text-[3vw] md:text-[2.6vw]"
        style={{ animationDelay: '900ms' }}
      >
        A VISUAL BEAT TAPE + DJ MIXES
      </div>
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/30 tracking-widest uppercase">
        tap to skip
      </div>
    </div>
  );
}
