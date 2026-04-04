/**
 * Export Manager
 * Handles screenshot and video+audio recording from the visualizer canvas
 * Records as WebM, then transcodes to MP4 via FFmpeg.wasm
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export type AspectRatio = 'browser' | '9:16' | '4:5' | '1:1';
export type ExportFormat = 'webm' | 'mp4';

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  'browser': 'Browser',
  '9:16': '9:16',
  '4:5': '4:5',
  '1:1': '1:1',
};

function getExportDimensions(canvas: HTMLCanvasElement, ratio: AspectRatio): { sx: number; sy: number; sw: number; sh: number; outW: number; outH: number } {
  const cw = canvas.width;
  const ch = canvas.height;

  if (ratio === 'browser') {
    return { sx: 0, sy: 0, sw: cw, sh: ch, outW: cw, outH: ch };
  }

  const ratioMap: Record<string, number> = { '9:16': 9 / 16, '4:5': 4 / 5, '1:1': 1 };
  const target = ratioMap[ratio];
  const current = cw / ch;

  let sw: number, sh: number, sx: number, sy: number;
  if (current > target) {
    // Canvas is wider — crop sides
    sh = ch;
    sw = Math.round(ch * target);
    sx = Math.round((cw - sw) / 2);
    sy = 0;
  } else {
    // Canvas is taller — crop top/bottom
    sw = cw;
    sh = Math.round(cw / target);
    sx = 0;
    sy = Math.round((ch - sh) / 2);
  }
  // Ensure even dimensions (required by VP9/VP8 video codecs)
  sw = sw & ~1;
  sh = sh & ~1;
  sx = Math.round((cw - sw) / 2);
  sy = Math.round((ch - sh) / 2);
  return { sx, sy, sw, sh, outW: sw, outH: sh };
}

export function captureScreenshot(canvas: HTMLCanvasElement, filename: string = 'visualizer.png', ratio: AspectRatio = 'browser', darkMode: boolean = true): void {
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
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
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
}

export const MAX_RECORDING_SECONDS = 30;

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

async function transcodToMp4(webmBlob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const inputData = await fetchFile(webmBlob);
  await ffmpeg.writeFile('input.webm', inputData);
  await ffmpeg.exec(['-i', 'input.webm', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', 'output.mp4']);
  const output = await ffmpeg.readFile('output.mp4');
  // Clean up
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.mp4');
  return new Blob([new Uint8Array(output as Uint8Array)], { type: 'video/mp4' });
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private durationInterval: number | null = null;
  private maxDurationTimeout: number | null = null;
  private onStateChange: (state: RecordingState) => void;
  private cropAnimationId: number | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private conversionCancelled: boolean = false;

  constructor(onStateChange: (state: RecordingState) => void) {
    this.onStateChange = onStateChange;
  }

  start(canvas: HTMLCanvasElement, audioContext: AudioContext, analyserNode: AnalyserNode, ratio: AspectRatio = 'browser', darkMode: boolean = true, format: ExportFormat = 'webm'): boolean {
    if (this.mediaRecorder?.state === 'recording') return false;

    // Always use an offscreen canvas to composite onto an opaque background
    // (WebGL canvases with alpha:true produce washed-out video otherwise)
    const { sx, sy, sw, sh, outW, outH } = getExportDimensions(canvas, ratio);
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = outW;
    this.offscreenCanvas.height = outH;
    const ctx = this.offscreenCanvas.getContext('2d', { alpha: false })!;
    const bgColor = darkMode ? '#000000' : '#e8ebed';

    const drawFrame = () => {
      const dims = getExportDimensions(canvas, ratio);
      // Fill opaque background first
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, dims.outW, dims.outH);
      // Composite the visualizer canvas on top
      ctx.drawImage(canvas, dims.sx, dims.sy, dims.sw, dims.sh, 0, 0, dims.outW, dims.outH);
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

    // Capture audio from the audio context destination
    const audioDest = audioContext.createMediaStreamDestination();
    analyserNode.connect(audioDest);
    const audioTrack = audioDest.stream.getAudioTracks()[0];

    // Merge video + audio into one stream
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(audioTrack ? [audioTrack] : []),
    ]);

    // Pick best supported codec
    const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      const webmBlob = new Blob(this.chunks, { type: mimeType });

      // Disconnect the extra audio destination
      try { analyserNode.disconnect(audioDest); } catch {}

      // Stop the crop animation and clear timers, but keep "converting" state
      if (this.cropAnimationId !== null) {
        cancelAnimationFrame(this.cropAnimationId);
        this.cropAnimationId = null;
      }
      if (this.maxDurationTimeout !== null) {
        clearTimeout(this.maxDurationTimeout);
        this.maxDurationTimeout = null;
      }
      if (this.durationInterval !== null) {
        clearInterval(this.durationInterval);
        this.durationInterval = null;
      }
      this.offscreenCanvas = null;
      this.mediaRecorder = null;

      if (format === 'mp4') {
        // Transcode WebM → MP4
        this.conversionCancelled = false;
        this.onStateChange({ isRecording: false, isConverting: true, duration: 0 });
        transcodToMp4(webmBlob)
          .then((mp4Blob) => {
            if (this.conversionCancelled) return;
            const url = URL.createObjectURL(mp4Blob);
            const link = document.createElement('a');
            link.download = `visualizer-${Date.now()}.mp4`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          })
          .catch((err) => {
            if (this.conversionCancelled) return;
            console.error('MP4 conversion failed, falling back to WebM:', err);
            const url = URL.createObjectURL(webmBlob);
            const link = document.createElement('a');
            link.download = `visualizer-${Date.now()}.webm`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
          })
          .finally(() => {
            this.onStateChange({ isRecording: false, isConverting: false, duration: 0 });
          });
      } else {
        // Direct WebM download — no transcoding
        const url = URL.createObjectURL(webmBlob);
        const link = document.createElement('a');
        link.download = `visualizer-${Date.now()}.webm`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        this.onStateChange({ isRecording: false, isConverting: false, duration: 0 });
      }
    };

    this.mediaRecorder.start(100);
    this.startTime = Date.now();

    // Auto-stop after max duration
    this.maxDurationTimeout = window.setTimeout(() => this.stop(), MAX_RECORDING_SECONDS * 1000);

    this.durationInterval = window.setInterval(() => {
      this.onStateChange({
        isRecording: true,
        isConverting: false,
        duration: Math.floor((Date.now() - this.startTime) / 1000),
      });
    }, 500);

    this.onStateChange({ isRecording: true, isConverting: false, duration: 0 });
    return true;
  }

  stop(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  cancelConversion(): void {
    this.conversionCancelled = true;
    // Terminate any running FFmpeg operation
    if (ffmpegInstance) {
      try { ffmpegInstance.terminate(); } catch {}
      ffmpegInstance = null;
      ffmpegLoading = null;
    }
    this.onStateChange({ isRecording: false, isConverting: false, duration: 0 });
  }

  private cleanup(): void {
    if (this.maxDurationTimeout !== null) {
      clearTimeout(this.maxDurationTimeout);
      this.maxDurationTimeout = null;
    }
    if (this.durationInterval !== null) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
    if (this.cropAnimationId !== null) {
      cancelAnimationFrame(this.cropAnimationId);
      this.cropAnimationId = null;
    }
    this.offscreenCanvas = null;
    this.onStateChange({ isRecording: false, isConverting: false, duration: 0 });
    this.mediaRecorder = null;
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  destroy(): void {
    this.stop();
    this.cleanup();
  }
}
