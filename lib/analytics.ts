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

export function trackGAEvent(name: string, params: Record<string, string | number>): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, params);
  }
}
