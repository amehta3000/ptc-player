/** Strip a file extension and tidy an on-disk name into a display title. */
export function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '').replace(/[_]+/g, ' ').trim() || 'Untitled';
}
