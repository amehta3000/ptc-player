/**
 * A user-uploaded audio track.
 *
 * Replaces the fixed CDN catalog (`Mix`) from the original PartTimeChiller
 * player. An uploaded file lives entirely in the browser: `audio` and `cover`
 * are object URLs created from the uploaded `File`/`Blob`, never remote URLs.
 */
export interface Track {
  /** Display title (from ID3 tag, or the filename). */
  title: string;
  /** Artist (from ID3 tag) — may be empty. */
  artist: string;
  /** Object URL for the audio blob. */
  audio: string;
  /** Object URL for embedded album art, or null if none was found. */
  cover: string | null;
}

/** Strip a file extension and tidy an on-disk name into a display title. */
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled';
}
