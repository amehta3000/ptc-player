/**
 * Analytics wrapper
 * Centralizes Clarity + GA4 event tracking
 */

declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(name: string, data?: string): void {
  if (typeof window !== 'undefined' && window.clarity) {
    if (data) {
      window.clarity('event', name, data);
    } else {
      window.clarity('event', name);
    }
  }
}

/**
 * Send a GA4 event. Pass `useBeacon` for events fired while the page is going
 * away (pagehide, tab hidden): it switches gtag to navigator.sendBeacon, which
 * survives unload where a normal request would be cancelled. This is what makes
 * the numbers show up on mobile Safari, where unload-time XHRs are dropped.
 */
export function trackGAEvent(
  name: string,
  params: Record<string, string | number>,
  useBeacon = false
): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, useBeacon ? { ...params, transport_type: 'beacon' } : params);
  }
}
