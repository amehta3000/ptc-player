import React, { useCallback, useState } from 'react';
import { usePlayerStore, VisualizerType } from '../store/usePlayerStore';
import { VisualizerControl, VisualizerPreset } from '../lib/visualizers/BaseVisualizer';
import { RecordingState, AspectRatio, ExportFormat, ASPECT_RATIO_LABELS } from '../lib/exportManager';
import VisualizerControls from './VisualizerControls';
import VisualizerContainer from './VisualizerContainer';
import ColorPicker from './ColorPicker';

interface StudioViewProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  onTogglePlay: () => void;
  visualizerControls: VisualizerControl[];
  visualizerPresets: VisualizerPreset[];
  onUpdateConfig: (key: string, value: number) => void;
  onResetConfig: () => void;
  onRandomize: () => void;
  onApplyPreset: (config: Record<string, number>) => void;
  onRandomizeControls: () => void;
  visualizerName: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onScreenshot: (ratio: AspectRatio) => void;
  onToggleRecording: (ratio: AspectRatio, format: ExportFormat) => void;
  onCancelConversion: () => void;
  recordingState: RecordingState;
  onNewFile: () => void;
  hasEmbeddedCover: boolean;
}

function formatTime(seconds: number) {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function StudioView({
  audioRef,
  containerRef,
  onTogglePlay,
  visualizerControls,
  visualizerPresets,
  onUpdateConfig,
  onResetConfig,
  onRandomize,
  onApplyPreset,
  onRandomizeControls,
  visualizerName,
  darkMode,
  onToggleDarkMode,
  onScreenshot,
  onToggleRecording,
  onCancelConversion,
  recordingState,
  onNewFile,
  hasEmbeddedCover,
}: StudioViewProps) {
  const currentMix = usePlayerStore((s) => s.currentMix);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const showControls = usePlayerStore((s) => s.showControls);
  const setShowControls = usePlayerStore((s) => s.setShowControls);
  const setVisualizerType = usePlayerStore((s) => s.setVisualizerType);

  const [exportRatio, setExportRatio] = useState<AspectRatio>('9:16');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('mp4');
  const [exportOpen, setExportOpen] = useState(false);

  const seek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !audio.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    },
    [audioRef]
  );

  const { isRecording, isConverting } = recordingState;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Visualizer / cover fills the screen */}
      <div className="absolute inset-0 flex items-center justify-center">
        <VisualizerContainer containerRef={containerRef} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 sm:px-6 py-3 z-20">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-semibold truncate max-w-[50vw]">{currentMix?.title}</div>
          {currentMix?.artist && <div className="text-xs text-white/50 truncate max-w-[50vw]">{currentMix.artist}</div>}
        </div>
        <div className="flex items-center gap-2">
          {(isRecording || isConverting) && (
            <button
              onClick={() => (isRecording ? onToggleRecording(exportRatio, exportFormat) : onCancelConversion())}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isRecording ? 'bg-red-500/90 hover:bg-red-500' : 'bg-white/15 hover:bg-white/25'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-white/70'}`} />
              {isRecording
                ? `Stop · ${Math.floor(recordingState.duration / 60)}:${(recordingState.duration % 60).toString().padStart(2, '0')}`
                : 'Converting… cancel'}
            </button>
          )}
          <button onClick={onToggleDarkMode} title="Toggle background" className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setShowControls(!showControls)} title="Visualizer controls" className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
            🎛️
          </button>
          <div className="relative">
            <button onClick={() => setExportOpen((v) => !v)} className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium">
              Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-64 p-4 rounded-xl bg-black/85 backdrop-blur-xl border border-white/10 space-y-3 z-30">
                <div className="flex gap-2">
                  <label className="flex-1 text-xs text-white/60">
                    Format
                    <select
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                      className="mt-1 w-full bg-white/10 rounded px-2 py-1.5 text-sm border border-white/10"
                    >
                      <option value="mp4" className="bg-neutral-900">MP4</option>
                      <option value="webm" className="bg-neutral-900">WebM</option>
                    </select>
                  </label>
                  <label className="flex-1 text-xs text-white/60">
                    Aspect
                    <select
                      value={exportRatio}
                      onChange={(e) => setExportRatio(e.target.value as AspectRatio)}
                      className="mt-1 w-full bg-white/10 rounded px-2 py-1.5 text-sm border border-white/10"
                    >
                      {(Object.keys(ASPECT_RATIO_LABELS) as AspectRatio[]).map((r) => (
                        <option key={r} value={r} className="bg-neutral-900">
                          {ASPECT_RATIO_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  onClick={() => {
                    onToggleRecording(exportRatio, exportFormat);
                    setExportOpen(false);
                  }}
                  disabled={isConverting}
                  className="w-full py-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-sm font-medium disabled:opacity-50"
                >
                  {isRecording ? 'Stop recording' : 'Record video'}
                </button>
                <button
                  onClick={() => {
                    onScreenshot(exportRatio);
                    setExportOpen(false);
                  }}
                  className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium"
                >
                  Save screenshot (PNG)
                </button>
                <p className="text-[11px] text-white/40 leading-snug">
                  Recording captures the visualizer + audio in real time while the track plays. Press play, then record.
                </p>
              </div>
            )}
          </div>
          <button onClick={onNewFile} title="Upload a different track" className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium">
            New
          </button>
        </div>
      </div>

      {/* Visualizer controls panel (existing component) */}
      {showControls && (
        <VisualizerControls
          controls={visualizerControls}
          presets={visualizerPresets}
          onUpdateConfig={onUpdateConfig}
          onReset={onResetConfig}
          onApplyPreset={onApplyPreset}
          onRandomizeControls={onRandomizeControls}
          onRandomize={onRandomize}
          visualizerName={visualizerName}
          onChangeVisualizer={(t: VisualizerType) => setVisualizerType(t)}
        />
      )}

      {/* Color pickers — only when the track had no embedded art to theme from */}
      {showControls && !hasEmbeddedCover && (
        <div className="absolute top-16 sm:top-20 left-2 sm:left-6 w-64 p-4 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 z-20">
          <div className="text-sm font-medium text-white/90 mb-3">Colors</div>
          <ColorPicker />
        </div>
      )}

      {/* Bottom playback bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 sm:px-6 py-4 z-20 bg-gradient-to-t from-black/60 to-transparent">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <button onClick={onTogglePlay} className="w-11 h-11 flex-shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
          <span className="text-xs text-white/60 tabular-nums w-10 text-right">{formatTime(currentTime)}</span>
          <div onClick={seek} className="flex-1 h-2 rounded-full bg-white/15 cursor-pointer group">
            <div className="h-full rounded-full bg-white/80 group-hover:bg-white transition-colors" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-white/60 tabular-nums w-10">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
