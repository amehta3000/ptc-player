import React from 'react';
import { VisualizerControl, VisualizerPreset } from '../lib/visualizers/BaseVisualizer';
import { usePlayerStore } from '../store/usePlayerStore';

interface VisualizerControlsProps {
  controls: VisualizerControl[];
  presets: VisualizerPreset[];
  onUpdateConfig: (key: string, value: number) => void;
  onReset: () => void;
  onApplyPreset: (config: Record<string, number>) => void;
  onRandomizeControls: () => void;
  visualizerName: string;
}

export default function VisualizerControls({
  controls,
  presets,
  onUpdateConfig,
  onReset,
  onApplyPreset,
  onRandomizeControls,
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

      {presets.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/50 mr-1">Presets</span>
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => onApplyPreset(preset.config)}
              className="w-7 h-7 rounded text-xs font-medium transition-all duration-200 bg-white/5 text-white/50 border border-white/5 hover:bg-white/15 hover:text-white/90"
            >
              {preset.name}
            </button>
          ))}
          <button
            onClick={onRandomizeControls}
            className="w-7 h-7 rounded text-xs font-medium transition-all duration-200 bg-white/5 text-white/50 border border-white/5 hover:bg-white/15 hover:text-white/90"
            title="Randomize controls"
          >
            <svg className="w-3.5 h-3.5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </button>
        </div>
      )}

      {controls.map((control) => (
        <div key={control.key}>
          <label className="flex justify-between text-xs text-white/70 mb-1">
            <span>{control.name}</span>
            {!control.labels && (
              <span className="font-mono">
                {control.step >= 1
                  ? control.value.toLocaleString()
                  : control.step >= 0.1
                  ? control.value.toFixed(1)
                  : control.step >= 0.01
                  ? control.value.toFixed(2)
                  : control.value.toFixed(4)}
              </span>
            )}
          </label>
          {control.labels ? (
            <div className="flex gap-1">
              {control.labels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => onUpdateConfig(control.key, i)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all duration-200 ${
                    Math.round(control.value) === i
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 border border-white/5 hover:bg-white/10 hover:text-white/70'
                  }`}
                  style={Math.round(control.value) === i ? { borderColor: dominantColor, backgroundColor: `${dominantColor}33` } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : (
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
          )}
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
