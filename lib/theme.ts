/**
 * The page background behind the visualizer.
 *
 * In light mode this has to be the exact colour the visualizers clear their
 * canvas to, or the padding around the canvas reads as a frame instead of
 * blending into it. The same value backs recordings and screenshots.
 */
export const LIGHT_BG = '#e8ebed';
export const DARK_BG = '#000000';

export const pageBackground = (darkMode: boolean) => (darkMode ? DARK_BG : LIGHT_BG);
