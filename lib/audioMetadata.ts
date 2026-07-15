/**
 * Minimal, dependency-free ID3v2 tag reader.
 *
 * Extracts the title (TIT2/TT2), artist (TPE1/TP1) and the first embedded
 * album-art picture (APIC/PIC) from an uploaded audio file. Everything runs in
 * the browser on the file's bytes — no network, no external library — so the
 * static export stays lean and build-safe.
 *
 * Only the subset of the spec needed for common MP3s is implemented. Anything
 * unrecognised is skipped and parsing degrades gracefully to `{}`, letting the
 * UI fall back to manual color pickers.
 */

export interface AudioMetadata {
  title?: string;
  artist?: string;
  /** Object URL for the embedded cover image, or undefined if none. */
  coverUrl?: string;
}

/** Decode a synchsafe 28-bit integer (7 bits per byte), used by ID3 sizes. */
function readSynchsafe(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

function readUint32(view: DataView, offset: number): number {
  return view.getUint32(offset, false);
}

/** Decode an ID3 text payload given its leading encoding byte. */
function decodeText(bytes: Uint8Array): string {
  if (bytes.length === 0) return '';
  const encoding = bytes[0];
  const body = bytes.subarray(1);
  let label = 'iso-8859-1';
  if (encoding === 1) label = 'utf-16';
  else if (encoding === 2) label = 'utf-16be';
  else if (encoding === 3) label = 'utf-8';
  try {
    return new TextDecoder(label).decode(body).replace(/\0+$/, '').trim();
  } catch {
    return new TextDecoder('utf-8').decode(body).replace(/\0+$/, '').trim();
  }
}

/**
 * Parse an APIC (v2.3/2.4) or PIC (v2.2) frame body into a {mime, data} pair.
 * Returns null if the picture data can't be located.
 */
function parsePicture(
  body: Uint8Array,
  version: number
): { mime: string; data: Uint8Array } | null {
  if (body.length < 4) return null;
  const encoding = body[0];
  let offset = 1;
  let mime: string;

  if (version === 2) {
    // v2.2 PIC: 3-char image format code (e.g. "JPG", "PNG")
    const fmt = new TextDecoder('iso-8859-1').decode(body.subarray(1, 4)).toUpperCase();
    mime = fmt === 'PNG' ? 'image/png' : 'image/jpeg';
    offset = 4;
  } else {
    // v2.3/2.4 APIC: null-terminated MIME string
    let end = offset;
    while (end < body.length && body[end] !== 0) end++;
    mime = new TextDecoder('iso-8859-1').decode(body.subarray(offset, end)) || 'image/jpeg';
    offset = end + 1;
  }

  // Picture type byte
  offset += 1;

  // Description: null-terminated, terminator width depends on text encoding
  if (encoding === 1 || encoding === 2) {
    // UTF-16 → 2-byte terminator on an even boundary
    while (offset + 1 < body.length && !(body[offset] === 0 && body[offset + 1] === 0)) {
      offset += 2;
    }
    offset += 2;
  } else {
    while (offset < body.length && body[offset] !== 0) offset++;
    offset += 1;
  }

  if (offset >= body.length) return null;
  return { mime, data: body.subarray(offset) };
}

export async function readAudioMetadata(file: Blob): Promise<AudioMetadata> {
  const result: AudioMetadata = {};
  try {
    // The ID3v2 tag sits at the very start of the file; reading the first
    // ~1.5MB covers the tag (and any embedded art) without loading everything.
    const headerSlice = file.slice(0, Math.min(file.size, 1_500_000));
    const buffer = await headerSlice.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
      return result; // No "ID3" magic
    }

    const version = view.getUint8(3); // major version (2, 3 or 4)
    const tagSize = readSynchsafe(view, 6);
    const tagEnd = Math.min(10 + tagSize, bytes.length);

    // v2.2 uses 3-byte frame IDs + 3-byte sizes; v2.3/2.4 use 4-byte.
    const idLen = version === 2 ? 3 : 4;
    const sizeLen = version === 2 ? 3 : 4;
    const flagsLen = version === 2 ? 0 : 2;
    const headerLen = idLen + sizeLen + flagsLen;

    let offset = 10;
    while (offset + headerLen <= tagEnd) {
      const frameId = new TextDecoder('iso-8859-1').decode(bytes.subarray(offset, offset + idLen));
      if (!/^[A-Z0-9]+$/.test(frameId)) break; // padding / end of frames

      let frameSize: number;
      if (version === 2) {
        frameSize =
          (view.getUint8(offset + 3) << 16) |
          (view.getUint8(offset + 4) << 8) |
          view.getUint8(offset + 5);
      } else if (version === 4) {
        frameSize = readSynchsafe(view, offset + 4);
      } else {
        frameSize = readUint32(view, offset + 4);
      }

      const bodyStart = offset + headerLen;
      const bodyEnd = bodyStart + frameSize;
      if (frameSize <= 0 || bodyEnd > tagEnd) break;
      const body = bytes.subarray(bodyStart, bodyEnd);

      if (frameId === 'TIT2' || frameId === 'TT2') {
        result.title = decodeText(body);
      } else if (frameId === 'TPE1' || frameId === 'TP1') {
        result.artist = decodeText(body);
      } else if ((frameId === 'APIC' || frameId === 'PIC') && !result.coverUrl) {
        const pic = parsePicture(body, version);
        if (pic && pic.data.length > 0) {
          // Copy out of the shared buffer before making a Blob
          const blob = new Blob([pic.data.slice()], { type: pic.mime });
          result.coverUrl = URL.createObjectURL(blob);
        }
      }

      offset = bodyEnd;
    }
  } catch {
    // Malformed tag — return whatever we managed to read
  }
  return result;
}
