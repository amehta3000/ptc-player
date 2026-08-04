/**
 * Export Manager
 * Handles screenshot and video+audio recording from the visualizer canvas.
 *
 * MP4 strategy:
 *  1. If the browser can record H.264 + AAC directly (Chrome 130+, Safari),
 *     the MediaRecorder output is already a social-ready MP4 and downloads
 *     with no transcode at all.
 *  2. Otherwise record WebM and transcode with FFmpeg.wasm. Transcodes run
 *     in a background queue so a new take can start immediately.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';
import { drawMirrored, createMirrorScratch, MirrorState } from './mirrorCompositor';

export type AspectRatio = 'browser' | '9:16' | '4:5' | '1:1' | '16:9';
export type OverlayDrawerFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
export type ExportFormat = 'webm' | 'mp4';

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  'browser': 'Browser',
  '9:16': '9:16',
  '4:5': '4:5',
  '1:1': '1:1',
  '16:9': '16:9',
};

// Platform presets: each one bundles the crop + container a network expects.
// MP4 here is H.264 + AAC, accepted by all major socials.
export interface ExportPreset {
  id: string;
  label: string;
  ratio: AspectRatio;
  format: ExportFormat;
}

export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'tiktok',    label: 'TikTok / Reels · 9:16 MP4',      ratio: '9:16',    format: 'mp4'  },
  { id: 'ig-post',   label: 'Instagram Post · 1:1 MP4',       ratio: '1:1',     format: 'mp4'  },
  { id: 'ig-tall',   label: 'Instagram Portrait · 4:5 MP4',   ratio: '4:5',     format: 'mp4'  },
  { id: 'youtube',   label: 'YouTube · 16:9 MP4',             ratio: '16:9',    format: 'mp4'  },
  { id: 'screen',    label: 'This Screen · WebM (fast)',      ratio: 'browser', format: 'webm' },
];

export function getExportPreset(id: string): ExportPreset {
  return EXPORT_PRESETS.find((p) => p.id === id) ?? EXPORT_PRESETS[0];
}

// 1080p on the long edge is the delivery target for every social platform;
// encoding beyond it costs time and bitrate for no visible gain.
const MAX_EXPORT_LONG_EDGE = 1920;

/**
 * MediaRecorder types that guarantee H.264 video + AAC audio.
 *
 * Bare 'video/mp4' is deliberately excluded: some builds report it as
 * supported and then mux VP9 + Opus into the MP4 container, which socials
 * do not reliably accept. Only explicit avc1 + mp4a strings are trusted.
 */
const NATIVE_MP4_TYPES = [
  'video/mp4;codecs=avc1.640029,mp4a.40.2', // High profile, level 4.1
  'video/mp4;codecs=avc1.4D402A,mp4a.40.2', // Main profile
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Baseline profile
];

/** The best native H.264+AAC recording type, or null if none is available. */
export function getNativeMp4Type(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return NATIVE_MP4_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function pickWebmType(): string {
  return (
    ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m)
    ) || 'video/webm'
  );
}

function getExportDimensions(
  canvas: HTMLCanvasElement,
  ratio: AspectRatio,
  capLongEdge?: number
): { sx: number; sy: number; sw: number; sh: number; outW: number; outH: number } {
  const cw = canvas.width;
  const ch = canvas.height;

  let sx: number, sy: number, sw: number, sh: number;

  if (ratio === 'browser') {
    sx = 0; sy = 0; sw = cw; sh = ch;
  } else {
    const ratioMap: Record<string, number> = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1, '16:9': 16 / 9 };
    const target = ratioMap[ratio];
    const current = cw / ch;

    if (current > target) {
      // Canvas is wider, crop sides
      sh = ch;
      sw = Math.round(ch * target);
    } else {
      // Canvas is taller, crop top/bottom
      sw = cw;
      sh = Math.round(cw / target);
    }
    // Ensure even dimensions (required by VP9/VP8/H.264 video codecs)
    sw = sw & ~1;
    sh = sh & ~1;
    sx = Math.round((cw - sw) / 2);
    sy = Math.round((ch - sh) / 2);
  }

  let outW = sw;
  let outH = sh;
  if (capLongEdge) {
    const longEdge = Math.max(outW, outH);
    if (longEdge > capLongEdge) {
      const scale = capLongEdge / longEdge;
      outW = Math.max(2, Math.round(outW * scale) & ~1);
      outH = Math.max(2, Math.round(outH * scale) & ~1);
    }
  }

  return { sx, sy, sw, sh, outW, outH };
}

export function captureScreenshot(canvas: HTMLCanvasElement, filename: string = 'visualizer.png', ratio: AspectRatio = 'browser', darkMode: boolean = true, overlayDrawer?: OverlayDrawerFn, mirror?: MirrorState): void {
  // Screenshots keep full canvas resolution (no cap)
  const { sx, sy, sw, sh, outW, outH } = getExportDimensions(canvas, ratio);
  const bgColor = darkMode ? '#000000' : '#e8ebed';

  // Always use offscreen canvas to composite onto opaque background
  const offscreen = document.createElement('canvas');
  offscreen.width = outW;
  offscreen.height = outH;
  const ctx = offscreen.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outW, outH);
  drawMirrored(ctx, canvas, sx, sy, sw, sh, outW, outH, mirror ?? { mode: 0, offset: 0.5 }, createMirrorScratch());
  if (overlayDrawer) overlayDrawer(ctx, outW, outH);
  const dataUrl = offscreen.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export interface RecordingState {
  isRecording: boolean;
  isConverting: boolean;
  duration: number;
  /** MP4 transcode progress 0-1; undefined while FFmpeg is still loading */
  conversionProgress?: number;
  /** Number of takes queued or actively converting in the background */
  pendingCount: number;
}

export const MAX_RECORDING_SECONDS = Infinity;

// Lazy-loaded singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoading;
}

async function transcodeToMp4(
  webmBlob: Blob,
  durationSeconds?: number,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // MediaRecorder WebM has no duration header, so ffmpeg's own progress ratio
  // is unreliable. Derive it from the transcoded timestamp against the known
  // recording length instead.
  const progressHandler = ({ time }: { progress: number; time: number }) => {
    if (!durationSeconds || !onProgress) return;
    const seconds = time / 1_000_000; // time arrives in microseconds
    onProgress(Math.max(0, Math.min(1, seconds / durationSeconds)));
  };
  ffmpeg.on('progress', progressHandler);

  try {
    const inputData = await fetchFile(webmBlob);
    await ffmpeg.writeFile('input.webm', inputData);
    // veryfast preset at a near-visually-lossless CRF: the preset trades file
    // size for speed at the same quality, which is the right trade here.
    // yuv420p keeps the result playable everywhere (QuickTime, socials).
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '19',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      'output.mp4',
    ]);
    const output = await ffmpeg.readFile('output.mp4');
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');
    return new Blob([new Uint8Array(output as Uint8Array)], { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressHandler);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  // Give the browser a moment to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private durationInterval: number | null = null;
  private onStateChange: (state: RecordingState) => void;
  private cropAnimationId: number | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;

  // Background conversion queue: FFmpeg can only run one job at a time, but
  // recording is never blocked by it.
  private queue: Promise<void> = Promise.resolve();
  private pendingCount: number = 0;
  private conversionProgress: number | undefined = undefined;
  // Bumped by cancelConversion; jobs from an older generation abandon quietly,
  // while takes queued after the cancel still convert normally.
  private cancelGeneration: number = 0;

  constructor(onStateChange: (state: RecordingState) => void) {
    this.onStateChange = onStateChange;
  }

  private emit(): void {
    const recording = this.mediaRecorder?.state === 'recording';
    this.onStateChange({
      isRecording: recording,
      isConverting: this.pendingCount > 0,
      duration: recording ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      conversionProgress: this.conversionProgress,
      pendingCount: this.pendingCount,
    });
  }

  start(canvas: HTMLCanvasElement, audioContext: AudioContext, analyserNode: AnalyserNode, ratio: AspectRatio = 'browser', darkMode: boolean = true, format: ExportFormat = 'webm', getOverlay?: () => OverlayDrawerFn | null | undefined, getMirror?: () => MirrorState): boolean {
    if (this.mediaRecorder?.state === 'recording') return false;

    // Always use an offscreen canvas to composite onto an opaque background
    // (WebGL canvases with alpha:true produce washed-out video otherwise)
    const { outW, outH } = getExportDimensions(canvas, ratio, MAX_EXPORT_LONG_EDGE);
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = outW;
    this.offscreenCanvas.height = outH;
    const ctx = this.offscreenCanvas.getContext('2d', { alpha: false })!;
    const bgColor = darkMode ? '#000000' : '#e8ebed';
    const mirrorScratch = createMirrorScratch();

    const drawFrame = () => {
      const dims = getExportDimensions(canvas, ratio, MAX_EXPORT_LONG_EDGE);
      // Fill opaque background first
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dims.outW, dims.outH);
      // Composite the visualizer canvas on top, mirroring across the export
      // frame so a tall crop tiles within the video instead of slicing a
      // window out of the mirrored screen-shaped frame
      drawMirrored(
        ctx, canvas,
        dims.sx, dims.sy, dims.sw, dims.sh,
        dims.outW, dims.outH,
        getMirror?.() ?? { mode: 0, offset: 0.5 },
        mirrorScratch
      );
      // Draw HTML overlay (e.g. intro title card) if present
      const overlay = getOverlay?.();
      if (overlay) overlay(ctx, dims.outW, dims.outH);
      // Belt-and-suspenders: fill behind any remaining transparent areas
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dims.outW, dims.outH);
      ctx.globalCompositeOperation = 'source-over';
      this.cropAnimationId = requestAnimationFrame(drawFrame);
    };
    drawFrame();
    const streamCanvas = this.offscreenCanvas;

    // Capture canvas stream at 30fps
    const canvasStream = streamCanvas.captureStream(30);

    // Capture audio from the analyser (post-effects, pre-destination)
    const audioDest = audioContext.createMediaStreamDestination();
    analyserNode.connect(audioDest);
    const audioTrack = audioDest.stream.getAudioTracks()[0];

    // Merge video + audio into one stream
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioTrack ? [audioTrack] : []),
    ]);

    // Prefer recording H.264 + AAC straight to MP4 (no transcode needed)
    const nativeMp4 = format === 'mp4' ? getNativeMp4Type() : null;
    const mimeType = nativeMp4 ?? pickWebmType();
    const needsTranscode = format === 'mp4' && !nativeMp4;

    // ~0.15 bits per pixel per frame at 30fps keeps detail in the wireframes
    const videoBitsPerSecond = Math.min(16_000_000, Math.max(6_000_000, Math.round(outW * outH * 0.15 * 30)));

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond,
      audioBitsPerSecond: 192_000,
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: mimeType });
      const recordedSeconds = Math.max(0.1, (Date.now() - this.startTime) / 1000);

      // Disconnect the extra audio destination
      try { analyserNode.disconnect(audioDest); } catch {}

      // Tear down this take so a new one can start immediately
      if (this.cropAnimationId !== null) {
        cancelAnimationFrame(this.cropAnimationId);
        this.cropAnimationId = null;
      }
      if (this.durationInterval !== null) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
      this.offscreenCanvas = null;
      this.mediaRecorder = null;
      this.chunks = [];

      if (!needsTranscode) {
        // Already social-ready (native MP4) or a plain WebM export
        downloadBlob(blob, `ptc-visualizer-${Date.now()}.${format === 'mp4' ? 'mp4' : 'webm'}`);
        this.emit();
        return;
      }

      // Queue the transcode in the background; recording stays available
      this.enqueueConversion(blob, recordedSeconds);
    };

    this.mediaRecorder.start(100);
    this.startTime = Date.now();

    // No max duration; the user stops recording manually
    this.durationInterval = window.setInterval(() => this.emit(), 500);
    this.emit();
    return true;
  }

  /** Run a WebM to MP4 transcode behind the queue without blocking recording */
  private enqueueConversion(webmBlob: Blob, recordedSeconds: number): void {
    const generation = this.cancelGeneration;
    this.pendingCount++;
    this.emit();

    const cancelled = () => generation !== this.cancelGeneration;

    this.queue = this.queue.then(async () => {
      if (cancelled()) return;
      this.conversionProgress = undefined;
      this.emit();
      try {
        const mp4 = await transcodeToMp4(webmBlob, recordedSeconds, (p) => {
          if (cancelled()) return;
          this.conversionProgress = p;
          this.emit();
        });
        if (cancelled()) return;
        downloadBlob(mp4, `ptc-visualizer-${Date.now()}.mp4`);
      } catch (err) {
        if (cancelled()) return;
        console.error('MP4 conversion failed, falling back to WebM:', err);
        downloadBlob(webmBlob, `ptc-visualizer-${Date.now()}.webm`);
      } finally {
        if (!cancelled()) {
          this.pendingCount = Math.max(0, this.pendingCount - 1);
        }
        this.conversionProgress = undefined;
        this.emit();
      }
    });
  }

  stop(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  cancelConversion(): void {
    // Abandon every in-flight and queued job; later takes are unaffected
    this.cancelGeneration++;
    // Terminate any running FFmpeg operation
    if (ffmpegInstance) {
      try { ffmpegInstance.terminate(); } catch {}
      ffmpegInstance = null;
      ffmpegLoading = null;
    }
    this.pendingCount = 0;
    this.conversionProgress = undefined;
    this.queue = this.queue.catch(() => {});
    this.emit();
  }

  private cleanup(): void {
    if (this.durationInterval !== null) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.cropAnimationId !== null) {
      cancelAnimationFrame(this.cropAnimationId);
      this.cropAnimationId = null;
    }
    this.offscreenCanvas = null;
    this.mediaRecorder = null;
    this.emit();
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  destroy(): void {
    this.stop();
    this.cleanup();
  }
}
