export interface ExtractedColors {
  dominant: string;
  accent: string;
}

const DEFAULT_COLORS: ExtractedColors = {
  dominant: 'rgb(115, 115, 115)',
  accent: 'rgb(45, 185, 185)',
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

// Ensures the accent color is vibrant enough to be visible on both light and dark backgrounds.
// Boosts saturation to at least 65% and clamps lightness to 52–62%.
function vibrantAccent(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  // Too desaturated to extract a meaningful hue — use default teal
  if (s < 20) return DEFAULT_COLORS.accent;
  const boostedS = Math.max(s, 65);
  const clampedL = Math.min(Math.max(l, 52), 62);
  const [nr, ng, nb] = hslToRgb(h, boostedS, clampedL);
  return `rgb(${nr}, ${ng}, ${nb})`;
}

export function extractColors(imgSrc: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(DEFAULT_COLORS); return; }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;
        let r2 = 0, g2 = 0, b2 = 0, count2 = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

          if (brightness > 40 && brightness < 180) {
            r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count++;
          }
          if (brightness > 100 && brightness < 220) {
            r2 += pixels[i]; g2 += pixels[i + 1]; b2 += pixels[i + 2]; count2++;
          }
        }

        const dominant = count > 0
          ? `rgb(${Math.floor(r / count)}, ${Math.floor(g / count)}, ${Math.floor(b / count)})`
          : DEFAULT_COLORS.dominant;

        const accent = count2 > 0
          ? vibrantAccent(Math.floor(r2 / count2), Math.floor(g2 / count2), Math.floor(b2 / count2))
          : DEFAULT_COLORS.accent;

        resolve({ dominant, accent });
      } catch {
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => resolve(DEFAULT_COLORS);
  });
}
