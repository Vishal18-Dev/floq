import { OrderItem } from '@floq/types';

/**
 * Format an amount in Indian Rupees (₹)
 */
export function formatINR(amount: number): string {
  if (isNaN(amount)) return '₹0';
  const hasDecimals = amount % 1 !== 0;
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format ticket numbers (e.g. 143 -> "#143")
 */
export function formatTicketNumber(seq: number, prefix: string = '#'): string {
  const padded = seq.toString().padStart(3, '0');
  return `${prefix}${padded}`;
}

/**
 * Calculate elapsed minutes from a timestamp
 */
export function getElapsedMinutes(isoString: string): number {
  if (!isoString) return 0;
  const start = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - start);
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Format elapsed time for display (e.g. "2m", "45s", "12m")
 */
export function formatElapsedTime(isoString: string): string {
  if (!isoString) return '0m';
  const start = new Date(isoString).getTime();
  const now = Date.now();
  const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s`;
  }
  const minutes = Math.floor(diffSeconds / 60);
  return `${minutes}m`;
}

/**
 * Check if an order has exceeded the store's typical preparation threshold
 */
export function isOrderDelayed(
  createdAt: string,
  preparingAt?: string | null,
  typicalMinutes: number = 6
): boolean {
  const baseTime = preparingAt || createdAt;
  const elapsed = getElapsedMinutes(baseTime);
  return elapsed >= typicalMinutes;
}

/**
 * Generate a spoken summary string of items in an order
 * e.g. "Two Special Masala Chai and one Indori Poha"
 */
export function generateItemsSpokenSummary(items: OrderItem[]): string {
  if (!items || items.length === 0) return 'No items';
  const numberWords: Record<number, string> = {
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
  };

  const parts = items.map((item) => {
    const qtyWord = numberWords[item.quantity] || `${item.quantity}`;
    return `${qtyWord} ${item.productNameSnapshot}`;
  });

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/**
 * Synthesize chimes & tones using the Web Audio API without external mp3 files
 */
export class WebAudioSynthesizer {
  private static ctx: AudioContext | null = null;

  private static getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!WebAudioSynthesizer.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        WebAudioSynthesizer.ctx = new AudioCtx();
      }
    }
    if (WebAudioSynthesizer.ctx && WebAudioSynthesizer.ctx.state === 'suspended') {
      WebAudioSynthesizer.ctx.resume().catch(() => {});
    }
    return WebAudioSynthesizer.ctx;
  }

  /**
   * Pleasant double-chime for incoming customer QR orders
   */
  public static playNewOrderChime(): void {
    const ctx = WebAudioSynthesizer.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.15); // A5
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Crisp bell for ready orders
   */
  public static playReadyChime(): void {
    const ctx = WebAudioSynthesizer.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046.5, now); // C6
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Ignore
    }
  }

  /**
   * Cash register / payment success chirp
   */
  public static playPaymentSuccessChirp(): void {
    const ctx = WebAudioSynthesizer.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.15); // C6
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }
}
