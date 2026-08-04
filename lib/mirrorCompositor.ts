/**
 * Mirror Compositor
 *
 * Shared mirror/kaleidoscope tiling used by both the live overlay and the
 * exporters. The transform always runs on the *destination* frame, so a
 * 9:16 export mirrors across the 9:16 frame rather than cropping a window
 * out of a mirrored browser-shaped frame (which could land inside a single
 * un-flipped tile and look unmirrored).
 */

export interface MirrorState {
  /** 0 = off, 1 = mirror X, 2 = mirror Y, 3 = both (kaleidoscope) */
  mode: number;
  /** Seam position as a fraction of the frame; 0.5 is a plain centre mirror */
  offset: number;
}

/**
 * Centre-anchored mirror tiling: a strip is sampled from the middle of the
 * frame, drawn in place, and mirrored copies tile outward symmetrically so
 * the original stays centred and reflections extend both ways.
 */
function tileAxis(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  w: number,
  h: number,
  axis: 'x' | 'y',
  offset: number
): void {
  const total = axis === 'x' ? w : h;
  const strip = Math.max(1, Math.round(total * offset));
  const start = (total - strip) / 2;

  const kMin = -Math.ceil(start / strip);
  const kMax = Math.floor((total - start) / strip);

  for (let k = kMin; k <= kMax; k++) {
    const pos = start + k * strip;
    const flipped = ((k % 2) + 2) % 2 === 1;
    ctx.save();
    if (axis === 'x') {
      if (flipped) {
        ctx.translate(pos + strip, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(pos, 0);
      }
      ctx.drawImage(source, start, 0, strip, h, 0, 0, strip, h);
    } else {
      if (flipped) {
        ctx.translate(0, pos + strip);
        ctx.scale(1, -1);
      } else {
        ctx.translate(0, pos);
      }
      ctx.drawImage(source, 0, start, w, strip, 0, 0, w, strip);
    }
    ctx.restore();
  }
}

/** Reusable scratch canvases so per-frame compositing allocates nothing */
export function createMirrorScratch(): { base: HTMLCanvasElement; pass: HTMLCanvasElement } {
  return { base: document.createElement('canvas'), pass: document.createElement('canvas') };
}

function sized(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return canvas.getContext('2d')!;
}

/**
 * Draw `source` (cropped to sx/sy/sw/sh) into `ctx` at outW x outH, applying
 * the mirror transform across the destination frame.
 */
export function drawMirrored(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  outW: number,
  outH: number,
  mirror: MirrorState,
  scratch: { base: HTMLCanvasElement; pass: HTMLCanvasElement }
): void {
  const mode = Math.max(0, Math.min(3, Math.round(mirror.mode)));

  if (mode === 0) {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
    return;
  }

  const offset = Math.max(0.1, Math.min(0.9, mirror.offset));

  // The un-mirrored destination frame the transform operates on. When the
  // crop is the identity we can mirror straight from the source.
  let base: HTMLCanvasElement = source;
  const isIdentity = sx === 0 && sy === 0 && sw === source.width && sh === source.height && outW === sw && outH === sh;
  if (!isIdentity) {
    const bctx = sized(scratch.base, outW, outH);
    bctx.clearRect(0, 0, outW, outH);
    bctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
    base = scratch.base;
  }

  if (mode === 1) {
    tileAxis(ctx, base, outW, outH, 'x', offset);
  } else if (mode === 2) {
    tileAxis(ctx, base, outW, outH, 'y', offset);
  } else {
    // Both axes: mirror X into a scratch pass, then mirror that in Y
    const pctx = sized(scratch.pass, outW, outH);
    pctx.clearRect(0, 0, outW, outH);
    tileAxis(pctx, base, outW, outH, 'x', offset);
    tileAxis(ctx, scratch.pass, outW, outH, 'y', offset);
  }
}
