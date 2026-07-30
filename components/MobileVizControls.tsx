import React, { useEffect, useState } from 'react';
import { VisualizerControl, VisualizerPreset } from '../lib/visualizers/BaseVisualizer';
import { usePlayerStore, VISUALIZER_TYPES, VISUALIZER_NAMES, VisualizerType } from '../store/usePlayerStore';

/**
 * Mobile control sheet (feature-flagged): Apple-Photos-style editing.
 * A slim bottom sheet with a horizontal strip of control chips and one
 * large editor for the selected control, so the visualizer stays visible
 * and reacts live while you tweak.
 */

interface MobileVizControlsProps {
  controls: VisualizerControl[];
  presets: VisualizerPreset[];
  onUpdateConfig: (key: string, value: number) => void;
  onReset: () => void;
  onApplyPreset: (config: Record<string, number>) => void;
  onRandomizeControls: () => void;
  onRandomize: () => void;
  visualizerName: string;
  onChangeVisualizer: (type: VisualizerType) => void;
}

function formatValue(control: VisualizerControl): string {
  return control.step >= 1
    ? control.value.toLocaleString()
    : control.step >= 0.1
    ? control.value.toFixed(1)
    : control.step >= 0.01
    ? control.value.toFixed(2)
    : control.value.toFixed(4);
}

export default function MobileVizControls({
  controls,
  presets,
  onUpdateConfig,
  onReset,
  onApplyPreset,
  onRandomizeControls,
  visualizerName,
  onChangeVisualizer,
}: MobileVizControlsProps) {
  const dominantColor = usePlayerStore((s) => s.dominantColor);
  const visualizerType = usePlayerStore((s) => s.visualizerType);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const active = controls.find((c) => c.key === activeKey) ?? controls[0];

  // If the active control disappears (visualizer switch, conditional
  // control hidden), fall back to the first one
  useEffect(() => {
    if (activeKey && !controls.some((c) => c.key === activeKey)) {
      setActiveKey(controls[0]?.key ?? null);
    }
  }, [controls, activeKey]);

  return (
    <div className="absolute bottom-[84px] inset-x-2 z-20 rounded-2xl backdrop-blur-xl bg-black/55 border border-white/10 px-3 pt-2 pb-3 space-y-2 sm:hidden">
      {/* Row 1: visualizer picker, presets, randomize, reset */}
      <div className="flex items-center gap-1.5">
        <select
          value={visualizerType}
          onChange={(e) => onChangeVisualizer(e.target.value as VisualizerType)}
          className="flex-1 min-w-0 bg-white/10 text-white/90 text-xs font-medium rounded-lg px-2 py-1.5 border border-white/10 cursor-pointer focus:outline-none appearance-none"
        >
          {VISUALIZER_TYPES.map((type) => (
            <option key={type} value={type} className="bg-neutral-900 text-white">
              {VISUALIZER_NAMES[type]}
            </option>
          ))}
        </select>
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onApplyPreset(preset.config)}
            className="w-7 h-7 flex-shrink-0 rounded-lg text-[11px] font-medium bg-white/5 text-white/60 border border-white/10 active:bg-white/20"
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={onRandomizeControls}
          className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center bg-white/5 text-white/60 border border-white/10 active:bg-white/20"
          title="Randomize controls"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
        </button>
        <button
          onClick={onReset}
          className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center bg-white/5 text-white/60 border border-white/10 active:bg-white/20"
          title="Reset to defaults"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a8 8 0 0114-3M20 15a8 8 0 01-14 3" />
          </svg>
        </button>
      </div>

      {/* Row 2: control chips, horizontally scrollable */}
      <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {controls.map((control) => {
          const selected = active?.key === control.key;
          return (
            <button
              key={control.key}
              onClick={() => setActiveKey(control.key)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                selected
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/5 text-white/50 border border-white/5'
              }`}
              style={selected ? { borderColor: dominantColor, backgroundColor: `${dominantColor}33` } : undefined}
            >
              {control.name}
            </button>
          );
        })}
      </div>

      {/* Row 3: editor for the active control */}
      {active && (
        <div>
          <div className="flex justify-between items-center text-[11px] text-white/60 mb-1.5">
            <span>{visualizerName} · {active.name}</span>
            {!active.labels && active.key !== 'hue' && (
              <span className="font-mono text-white/80">{formatValue(active)}</span>
            )}
          </div>
          {active.labels ? (
            <div className="flex flex-wrap gap-1.5">
              {active.labels.map((label, i) => (
                <button
                  key={i}
                  onClick={() => onUpdateConfig(active.key, i)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                    Math.round(active.value) === i
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'bg-white/5 text-white/50 border border-white/5'
                  }`}
                  style={Math.round(active.value) === i ? { borderColor: dominantColor, backgroundColor: `${dominantColor}33` } : undefined}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : active.key === 'hue' ? (
            <div className="py-1">
              <input
                type="range"
                min={active.min}
                max={active.max}
                step={active.step}
                value={active.value}
                onChange={(e) => onUpdateConfig(active.key, parseFloat(e.target.value))}
                className="w-full viz-slider-hue"
              />
            </div>
          ) : (
            <div className="py-1">
              <input
                type="range"
                min={active.min}
                max={active.max}
                step={active.step}
                value={active.value}
                onChange={(e) => onUpdateConfig(active.key, parseFloat(e.target.value))}
                className="w-full viz-slider viz-slider-lg"
                style={{
                  '--fill-pct': `${((active.value - active.min) / (active.max - active.min)) * 100}%`,
                  '--slider-fill': dominantColor,
                } as React.CSSProperties}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
