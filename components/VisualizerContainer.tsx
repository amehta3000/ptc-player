import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

interface VisualizerContainerProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function VisualizerContainer({ containerRef }: VisualizerContainerProps) {
  const currentMix = usePlayerStore((s) => s.currentMix);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const accentColor = usePlayerStore((s) => s.accentColor);

  if (!currentMix) return null;

  if (!showVisualizer) {
    return (
      <img
        src={currentMix.cover}
        alt={currentMix.title}
        className="max-h-[90%] max-w-[90%] aspect-square object-cover rounded shadow-xl"
        style={{ boxShadow: `0 0 0 3px ${accentColor}40` }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing"
      style={{ touchAction: 'none' }}
    />
  );
}
