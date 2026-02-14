/**
 * Color Extractor
 * Extracts dominant and accent colors from album art images
 */

export interface ExtractedColors {
  dominant: string;
  accent: string;
}

const DEFAULT_COLORS: ExtractedColors = {
  dominant: 'rgb(115, 115, 115)',
  accent: 'rgb(163, 163, 163)',
};

export function extractColors(imgSrc: string): Promise<ExtractedColors> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imgSrc;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_COLORS);
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;
        let r2 = 0, g2 = 0, b2 = 0, count2 = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

          // Dominant color (mid-brightness)
          if (brightness > 40 && brightness < 180) {
            r += pixels[i];
            g += pixels[i + 1];
            b += pixels[i + 2];
            count++;
          }

          // Accent color (brighter)
          if (brightness > 100 && brightness < 220) {
            r2 += pixels[i];
            g2 += pixels[i + 1];
            b2 += pixels[i + 2];
            count2++;
          }
        }

        const dominant = count > 0
          ? `rgb(${Math.floor(r / count)}, ${Math.floor(g / count)}, ${Math.floor(b / count)})`
          : DEFAULT_COLORS.dominant;

        const accent = count2 > 0
          ? `rgb(${Math.floor(r2 / count2)}, ${Math.floor(g2 / count2)}, ${Math.floor(b2 / count2)})`
          : DEFAULT_COLORS.accent;

        resolve({ dominant, accent });
      } catch (error) {
        console.log('Color extraction failed:', error);
        resolve(DEFAULT_COLORS);
      }
    };

    img.onerror = () => resolve(DEFAULT_COLORS);
  });
}
