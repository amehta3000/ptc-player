/**
 * Export Manager
 * Handles screenshot and video+audio recording from the visualizer canvas
 */

export type AspectRatio = 'browser' | '9:16' | '4:5' | '1:1';

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
  return { sx, sy, sw, sh, outW: sw, outH: sh };
}

export function captureScreenshot(canvas: HTMLCanvasElement, filename: string = 'visualizer.png', ratio: AspectRatio = 'browser'): void {
  const { sx, sy, sw, sh, outW, outH } = getExportDimensions(canvas, ratio);

  if (ratio === 'browser') {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
    return;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = outW;
  offscreen.height = outH;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return;
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
  const dataUrl = offscreen.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private durationInterval: number | null = null;
  private onStateChange: (state: RecordingState) => void;
  private cropAnimationId: number | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;

  constructor(onStateChange: (state: RecordingState) => void) {
    this.onStateChange = onStateChange;
  }

  start(canvas: HTMLCanvasElement, audioContext: AudioContext, analyserNode: AnalyserNode, ratio: AspectRatio = 'browser'): boolean {
    if (this.mediaRecorder?.state === 'recording') return false;

    let streamCanvas: HTMLCanvasElement;

    if (ratio === 'browser') {
      streamCanvas = canvas;
    } else {
      // Create offscreen canvas at cropped dimensions and continuously blit
      const { sx, sy, sw, sh, outW, outH } = getExportDimensions(canvas, ratio);
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = outW;
      this.offscreenCanvas.height = outH;
      const ctx = this.offscreenCanvas.getContext('2d')!;

      const drawFrame = () => {
        const dims = getExportDimensions(canvas, ratio);
        ctx.drawImage(canvas, dims.sx, dims.sy, dims.sw, dims.sh, 0, 0, dims.outW, dims.outH);
        this.cropAnimationId = requestAnimationFrame(drawFrame);
      };
      drawFrame();
      streamCanvas = this.offscreenCanvas;
    }

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
      const blob = new Blob(this.chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `visualizer-${Date.now()}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      // Disconnect the extra audio destination
      try { analyserNode.disconnect(audioDest); } catch {}

      this.cleanup();
    };

    this.mediaRecorder.start(100);
    this.startTime = Date.now();

    this.durationInterval = window.setInterval(() => {
      this.onStateChange({
        isRecording: true,
        duration: Math.floor((Date.now() - this.startTime) / 1000),
      });
    }, 500);

    this.onStateChange({ isRecording: true, duration: 0 });
    return true;
  }

  stop(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
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
    this.onStateChange({ isRecording: false, duration: 0 });
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
