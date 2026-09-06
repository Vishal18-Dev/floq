import {
  useFonts,
  Archivo_400Regular,
  Archivo_600SemiBold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';

/**
 * Loads the Archivo faces the Modernist theme references. If loading fails
 * (e.g. offline first launch before the face is cached), the app still renders
 * with the platform sans — weight/spacing carry most of the character.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  });
  return loaded || Boolean(error);
}
