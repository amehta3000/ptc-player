import React from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { Mix } from '../data/mixes';
import { extractColors } from '../lib/colorExtractor';
import { trackEvent } from '../lib/analytics';

export default function MixList() {
  const currentMix = usePlayerStore((s) => s.currentMix);
  const setCurrentMix = usePlayerStore((s) => s.setCurrentMix);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setDominantColor = usePlayerStore((s) => s.setDominantColor);
  const setAccentColor = usePlayerStore((s) => s.setAccentColor);
  const setShowDetail = usePlayerStore((s) => s.setShowDetail);
  const setShowVisualizer = usePlayerStore((s) => s.setShowVisualizer);
  const getFilteredMixes = usePlayerStore((s) => s.getFilteredMixes);

  const filteredMixes = getFilteredMixes();

  const handleMixSelect = async (mix: Mix) => {
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
  };

  return (
    <div className="space-y-2 pb-28">
      {filteredMixes.map((mix, idx) => (
        <div
          key={idx}
          onClick={() => handleMixSelect(mix)}
          className={`bg-neutral-900 border transition-all duration-300 cursor-pointer rounded-lg hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] ${
            currentMix?.title === mix.title ? 'border-white/40' : 'border-neutral-800 hover:border-white'
          }`}
        >
          <div className="flex items-center space-x-3 p-3">
            <img
              src={mix.cover}
              alt={mix.title}
              className="w-12 h-12 rounded object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                target.nextElementSibling?.classList.remove('hidden');
              }}
            />
            <div className="w-12 h-12 rounded bg-neutral-700 flex items-center justify-center hidden">
              <span className="text-xs text-neutral-400">♪</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-md font-medium leading-tight truncate">{mix.title}</h2>
              <p className="text-xs text-neutral-400 truncate">{mix.description} &bull; {mix.duration}</p>
            </div>
            <span className={`text-xs px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 ${
              mix.type === 'mix'
                ? 'border-purple-500/40 text-purple-400/90'
                : 'border-blue-500/40 text-blue-400/90'
            }`}>
              {mix.type}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
