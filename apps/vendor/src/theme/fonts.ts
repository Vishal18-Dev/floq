import {
  useFonts,
  AnekLatin_400Regular,
  AnekLatin_600SemiBold,
  AnekLatin_800ExtraBold,
} from '@expo-google-fonts/anek-latin';
import {
  AnekDevanagari_400Regular,
  AnekDevanagari_600SemiBold,
  AnekDevanagari_700Bold,
} from '@expo-google-fonts/anek-devanagari';
import {
  AnekTamil_400Regular,
  AnekTamil_600SemiBold,
  AnekTamil_700Bold,
} from '@expo-google-fonts/anek-tamil';

/**
 * Loads the Anek faces the FLOQ brand uses (Anek by Ek Type) — Latin for the
 * UI, plus Devanagari (Hindi/Marathi) and Tamil for the merchant's local-
 * language text. Falls back to the platform sans if a face hasn't cached yet.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    AnekLatin_400Regular,
    AnekLatin_600SemiBold,
    AnekLatin_800ExtraBold,
    AnekDevanagari_400Regular,
    AnekDevanagari_600SemiBold,
    AnekDevanagari_700Bold,
    AnekTamil_400Regular,
    AnekTamil_600SemiBold,
    AnekTamil_700Bold,
  });
  return loaded || Boolean(error);
}
