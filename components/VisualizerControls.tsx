import React from 'react';
import { VisualizerControl } from '../lib/visualizers/BaseVisualizer';
import { usePlayerStore } from '../store/usePlayerStore';

interface VisualizerControlsProps {
  controls: VisualizerControl[];
  onUpdateConfig: (key: string, value: number) => void;
  onReset: () => void;
  visualizerName: string;
}

export default function VisualizerControls({
  controls,
  onUpdateConfig,
  onReset,
  visualizerName,
}: VisualizerControlsProps) {
  const dominantColor = usePlayerStore((s) => s.dominantColor);

  return (
    <div className="absolute top-20 right-4 w-72 max-h-[70vh] overflow-y-auto p-4 rounded-lg backdrop-blur-xl bg-black/60 border border-white/10 z-20 space-y-3">
      <div className="text-sm font-medium text-white/90 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        {visualizerName} Controls
      </div>

      {controls.map((control) => (
        <div key={control.key}>
          <label className="flex justify-between text-xs text-white/70 mb-1">
            <span>{control.name}</span>
            <span className="font-mono">
              {control.step >= 1
                ? control.value.toLocaleString()
                : control.step >= 0.1
                ? control.value.toFixed(1)
                : control.step >= 0.01
                ? control.value.toFixed(2)
                : control.value.toFixed(4)}
            </span>
          </label>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={control.value}
            onChange={(e) => onUpdateConfig(control.key, parseFloat(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-white/10"
            style={{ accentColor: dominantColor }}
          />
        </div>
      ))}

      <button
        onClick={onReset}
        className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white/70 hover:bg-white/20 transition-all duration-300 text-xs font-medium"
      >
        Reset to Defaults
      </button>
    </div>
  );
}
