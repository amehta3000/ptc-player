/**
 * Analytics wrapper
 * Centralizes Clarity event tracking
 */

declare global {
  interface Window {
    clarity?: (action: string, ...args: any[]) => void;
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
