import { useStoreStore } from '../store/useStoreStore';
import { STRINGS, StringKey, SecondaryLanguage } from './strings';

export type { SecondaryLanguage } from './strings';
export { SECONDARY_LANGUAGE_LABELS } from './strings';

/** English label for a key (always defined). */
export function t(key: StringKey): string {
  return STRINGS[key].en;
}

/**
 * Secondary-language label for a key, or '' when the store is English-only or
 * the translation is missing. Screens render this as a smaller line under the
 * English label.
 */
export function tl(key: StringKey, lang: SecondaryLanguage): string {
  if (lang === 'none') return '';
  const row = STRINGS[key] as Record<string, string | undefined>;
  return row[lang] || '';
}

/**
 * Hook bound to the current store's configured secondary language. Returns
 * both helpers plus the active language so components can decide layout.
 */
export function useT() {
  const lang = (useStoreStore((s) => s.settings?.secondaryLanguage) as SecondaryLanguage) || 'none';
  return {
    lang,
    t,
    tl: (key: StringKey) => tl(key, lang),
    /** Primary + secondary as one object, convenient for <BiLabel>. */
    bi: (key: StringKey) => ({ primary: t(key), secondary: tl(key, lang) }),
  };
}
