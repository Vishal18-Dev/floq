import {
  useFonts,
  AnekLatin_400Regular,
  AnekLatin_600SemiBold,
  AnekLatin_800ExtraBold,
} from '@expo-google-fonts/anek-latin';

/**
 * Loads the Anek Latin faces the FLOQ brand uses (per Brand Guidelines v1.0 —
 * Anek by Ek Type). If loading fails (e.g. offline first launch before the face
 * is cached), the app still renders with the platform sans.
 *
 * ponytail: Latin only for now. Devanagari/Tamil local text falls back to the
 * system script font; add @expo-google-fonts/anek-devanagari + anek-tamil and
 * select per-script when the bilingual type polish is scheduled.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    AnekLatin_400Regular,
    AnekLatin_600SemiBold,
    AnekLatin_800ExtraBold,
  });
  return loaded || Boolean(error);
}
