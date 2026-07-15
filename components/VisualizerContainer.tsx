import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';

interface VisualizerContainerProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

export default function VisualizerContainer({ containerRef }: VisualizerContainerProps) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const showVisualizer = usePlayerStore((s) => s.showVisualizer);
  const accentColor = usePlayerStore((s) => s.accentColor);
  const dominantColor = usePlayerStore((s) => s.dominantColor);

  if (!currentTrack) return null;

  // When the visualizer is toggled off, show the embedded cover art if present,
  // otherwise a simple gradient placeholder built from the extracted colors.
  if (!showVisualizer) {
    if (currentTrack.cover) {
      return (
        <img
          src={currentTrack.cover}
          alt={currentTrack.title}
          className="max-h-[90%] max-w-[90%] aspect-square object-cover rounded shadow-xl"
          style={{ boxShadow: `0 0 0 3px ${accentColor}40` }}
        />
      );
    }
    return (
      <div
        className="max-h-[90%] max-w-[90%] aspect-square w-80 rounded shadow-xl"
        style={{ background: `linear-gradient(135deg, ${dominantColor}, ${accentColor})` }}
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
