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
    const timer = setTimeout(handleDismiss, 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[15] flex flex-col items-center justify-center cursor-pointer select-none px-6 ${animatingOut ? 'intro-out' : ''}`}
      onClick={handleDismiss}
    >
      <div
        className="intro-word text-white/70 font-bold leading-none tracking-tight text-[11vw] sm:text-[9vw] md:text-[8vw]"
        style={{ animationDelay: '100ms' }}
      >
        PART TIME CHILLER
      </div>
      <div
        className="intro-word text-white/60 font-bold leading-tight tracking-tight text-[5vw] sm:text-[4vw] md:text-[3.5vw] mt-3"
        style={{ animationDelay: '500ms' }}
      >
        MUSIC FOR THE IN BETWEEN
      </div>
      <div
        className="intro-word text-white/60 font-bold leading-tight tracking-tight text-[5vw] sm:text-[4vw] md:text-[3.5vw]"
        style={{ animationDelay: '900ms' }}
      >
        A VISUAL BEAT TAPE + DJ MIXES
      </div>
      <div className="absolute bottom-8 text-xs text-white/30 tracking-widest uppercase">
        tap to skip
      </div>
    </div>
  );
}
