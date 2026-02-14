import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mix } from '../data/mixes';

interface TrackMenuProps {
  mix: Mix;
  position?: 'above' | 'below';
}

export default function TrackMenu({ mix, position = 'below' }: TrackMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const shareUrl = `https://parttimechiller.com/ptc-player/track/${mix.slug}`;

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${mix.title} — Part Time Chiller`,
          text: mix.description,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setOpen(false);
  }, [mix, shareUrl]);

  const handleDownload = useCallback(() => {
    window.open(mix.audio, '_blank');
    setOpen(false);
  }, [mix.audio]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
        aria-label="More options"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute right-0 z-50 w-40 rounded-lg backdrop-blur-xl bg-black/80 border border-white/15 shadow-xl overflow-hidden ${
            position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleShare}
            className="w-full px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {copied ? 'Link copied!' : 'Share'}
          </button>
          <button
            onClick={handleDownload}
            className="w-full px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10 transition-colors flex items-center gap-2 border-t border-white/10"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      )}
    </div>
  );
}
