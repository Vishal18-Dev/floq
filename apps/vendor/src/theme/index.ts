/**
 * FLOQ design tokens — "v3 new skin" (design fb2b0536, Onboarding v3 / Retail v3).
 *
 * Character: cool mist ground (#F4F5F1), ink text (#101317), lime as the
 * signature highlight / primary action (#C9F158, ink text on it), cobalt for
 * links and structure (#2B4BEB, white text on it), green for success (#0E7A55),
 * red reserved for errors (#C2261B). Cool slate neutrals. Rounded cards (18) and
 * chips (12) with a soft lift, Anek typeface.
 */

export const palette = {
  bg: '#F4F5F1', // mist
  surface: '#ECEEE8', // segment / track / inset surface
  ink: '#101317',
  accent: '#2B4BEB', // cobalt — structure / secondary action (takes white text)
  accent2: '#0E7A55', // FLOQ green — positive / success
  highlight: '#C9F158', // lime — signature highlight / primary CTA (takes ink text)
  onHighlight: '#101317',

  // divider = ink at alpha (warm)
  divider: 'rgba(16,19,23,0.22)',
  dividerFaint: 'rgba(16,19,23,0.08)',

  // Cool slate neutral scale
  neutral: {
    100: '#F7F8F5',
    200: '#ECEEE8',
    300: '#DADDD4',
    400: '#AEB4BD',
    500: '#8A919B',
    600: '#5B626C', // slate
    700: '#3F454D',
    800: '#262A30',
    900: '#101317',
  },

  // Alert/danger ramp (red #C2261B). Errors, "running late", delete and
  // warnings stay red regardless of branding.
  accentRamp: {
    100: '#FEE6E2',
    200: '#FBCFC7',
    300: '#F3A79B',
    400: '#E8711F',
    500: '#D9452F',
    600: '#C2261B', // error
    700: '#8E1C13',
    800: '#6A160F',
    900: '#45130E',
  },

  white: '#ffffff',
  onAccent: '#ffffff', // text on cobalt

  // Retail surfaces. The shop screens sit white cards on the paper ground (per
  // the floq Retail design), and use a softer green pair for positive states
  // (stock received, paid, UPI confirmed) than the signature accent2.
  card: '#FFFFFF',
  success: '#0E7A55',
  successBg: '#DDF6EA',
  link: '#2B4BEB', // cobalt link/affordance
} as const;

/**
 * Back-compat semantic aliases. Existing screens import { colors } — keep the
 * same keys so nothing breaks, but repoint them at the Modernist palette.
 */
export const colors = {
  primary: palette.accent,
  primaryDark: palette.accentRamp[700],
  primaryLight: palette.accentRamp[100],
  primaryMuted: palette.accentRamp[100],

  background: palette.bg,
  surface: palette.surface,
  surfaceSubtle: palette.neutral[100],
  border: palette.divider,
  borderDark: palette.neutral[700],

  textPrimary: palette.ink,
  textSecondary: palette.neutral[700],
  textMuted: palette.neutral[600],
  textWhite: palette.white,

  accent: palette.accent,
  onAccent: palette.onAccent,

  // Payment channels: keep cash/UPI legible but within the single-accent system.
  upi: palette.accent,
  upiBg: palette.accentRamp[100],
  upiDark: palette.accentRamp[700],
  cash: palette.ink,
  cashBg: palette.neutral[200],

  // Order lifecycle. The design signals state with ink vs accent + fill, not a
  // rainbow: outlined = waiting, accent = live/ready, red text = late.
  status: {
    new: palette.ink,
    newBg: palette.bg,
    newBorder: palette.divider,
    preparing: palette.ink,
    preparingBg: palette.surface,
    preparingBorder: palette.divider,
    ready: palette.accent,
    readyBg: palette.accentRamp[100],
    readyBorder: palette.accent,
    completed: palette.neutral[600],
    completedBg: palette.neutral[100],
    completedBorder: palette.divider,
    delayed: palette.accentRamp[700],
    delayedBg: palette.accentRamp[100],
    delayedBorder: palette.accent,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// v3 skin: chips/segments 12, cards/buttons/fields 18, sheet tops 28.
export const radius = {
  sm: 4,
  md: 12,
  lg: 18,
  xl: 28,
  full: 9999,
} as const;

export const borders = {
  hair: 1,
  rule: 2, // the signature 2px ink divider
  ruleColor: palette.divider,
  hairColor: palette.dividerFaint,
} as const;

// Anek Latin is loaded via expo-font (see theme/fonts.ts). Falls back to the
// platform sans if the face hasn't loaded yet.
export const fonts = {
  heading: 'AnekLatin_800ExtraBold',
  body: 'AnekLatin_400Regular',
  semibold: 'AnekLatin_600SemiBold',
} as const;

export const typography = {
  display: { fontFamily: fonts.heading, fontSize: 52, fontWeight: '800' as const, letterSpacing: -1.5, color: palette.ink },
  header: { fontFamily: fonts.heading, fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.4, color: palette.ink },
  subHeader: { fontFamily: fonts.heading, fontSize: 20, fontWeight: '800' as const, color: palette.ink },
  title: { fontFamily: fonts.heading, fontSize: 16, fontWeight: '800' as const, color: palette.ink },
  amount: { fontFamily: fonts.heading, fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6, color: palette.ink },
  body: { fontFamily: fonts.body, fontSize: 14, fontWeight: '400' as const, color: palette.neutral[700] },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, fontWeight: '600' as const, color: palette.ink },
  // The all-caps tracked kicker used above section headers everywhere in the design.
  kicker: { fontFamily: fonts.heading, fontSize: 11, fontWeight: '800' as const, letterSpacing: 1.5, color: palette.neutral[700] },
  caption: { fontFamily: fonts.body, fontSize: 12, fontWeight: '400' as const, color: palette.neutral[600] },
} as const;

// v3 lifts cards off the mist ground with a soft shadow.
export const shadow = {
  card: { shadowColor: '#101317', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 1 },
  cta: { shadowColor: '#96BE1E', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 4 },
  sm: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  lg: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
} as const;
