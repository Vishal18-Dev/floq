import * as Speech from 'expo-speech';
import { Order, VoiceLanguage, VoiceVerbosity } from '@floq/types';
import { VOICE_TEMPLATES } from '@floq/constants';
import { generateItemsSpokenSummary } from '@floq/utils';
import { HapticFeedback } from './haptics';

export interface VoiceConfig {
  enabled: boolean;
  language: VoiceLanguage;
  volume: number;
  rate: number;
  verbosity: VoiceVerbosity;
}

export class NativeVoiceService {
  private config: VoiceConfig = {
    enabled: true,
    language: 'en-IN',
    volume: 1.0,
    rate: 0.95,
    verbosity: 'BRIEF',
  };

  public updateConfig(newConfig: Partial<VoiceConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  public speak(text: string, lang?: VoiceLanguage) {
    if (!this.config.enabled) return;

    try {
      Speech.stop();
      Speech.speak(text, {
        language: lang || this.config.language,
        pitch: 1.0,
        rate: this.config.rate,
      });
    } catch {
      // Fallback
    }
  }

  public announceNewOrder(order: Order) {
    if (!this.config.enabled) return;

    HapticFeedback.success();

    const cleanTicket = order.ticketNumber.replace('#', '');
    const itemsSummary =
      this.config.verbosity === 'DETAILED'
        ? generateItemsSpokenSummary(order.items)
        : `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'}`;

    const lang = this.config.language;
    const template = VOICE_TEMPLATES[lang] || VOICE_TEMPLATES['en-IN'];
    const phrase = template.newOrder(cleanTicket, itemsSummary);

    this.speak(phrase, lang);
  }

  public announceOrderReady(ticketNumber: string) {
    if (!this.config.enabled) return;

    HapticFeedback.medium();

    const cleanTicket = ticketNumber.replace('#', '');
    const lang = this.config.language;
    const template = VOICE_TEMPLATES[lang] || VOICE_TEMPLATES['en-IN'];
    const phrase = template.ready(cleanTicket);

    this.speak(phrase, lang);
  }

  public announceDelayedOrder(ticketNumber: string, minutes: number) {
    if (!this.config.enabled) return;

    HapticFeedback.error();

    const cleanTicket = ticketNumber.replace('#', '');
    const lang = this.config.language;
    const template = VOICE_TEMPLATES[lang] || VOICE_TEMPLATES['en-IN'];
    const phrase = template.delayed(cleanTicket, minutes);

    this.speak(phrase, lang);
  }
}

export const voiceService = new NativeVoiceService();
