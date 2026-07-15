import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../store/usePlayerStore';

export default function BackgroundArtwork() {
  const currentMix = usePlayerStore(useShallow((s) => s.currentMix));

  if (!currentMix) return null;

  return (
    <div
      className="fixed inset-0 z-0 transition-opacity duration-1000"
      style={{
        backgroundImage: `url(${currentMix.cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-3xl"></div>
    </div>
  );
}
