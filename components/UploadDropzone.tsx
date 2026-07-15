import React, { useCallback, useRef, useState } from 'react';

interface UploadDropzoneProps {
  onFile: (file: File) => void;
  processing?: boolean;
  error?: string | null;
}

const ACCEPT = 'audio/mpeg,audio/mp3,audio/*';

export default function UploadDropzone({ onFile, processing, error }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
        return;
      }
      onFile(file);
    },
    [onFile]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-10">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">Visualize your sound</h1>
        <p className="mt-4 text-white/60 text-base sm:text-lg max-w-xl mx-auto">
          Drop in a track, watch it come alive, and export a video for social — all in your browser.
        </p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        disabled={processing}
        className={`w-full max-w-xl rounded-2xl border-2 border-dashed px-8 py-16 transition-colors ${
          dragging ? 'border-white bg-white/10' : 'border-white/25 hover:border-white/50 hover:bg-white/5'
        } ${processing ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
      >
        {processing ? (
          <span className="text-white/80">Analyzing your track…</span>
        ) : (
          <span className="flex flex-col items-center gap-3">
            <svg className="w-10 h-10 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V3m0 0L7.5 7.5M12 3l4.5 4.5M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5" />
            </svg>
            <span className="text-lg font-medium">Drop an audio file or click to browse</span>
            <span className="text-white/50 text-sm">MP3, WAV, M4A, OGG, FLAC</span>
          </span>
        )}
      </button>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}

      <p className="mt-8 text-white/40 text-xs max-w-md">
        Your file never leaves your device — everything runs locally in the browser.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
