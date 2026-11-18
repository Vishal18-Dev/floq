/**
 * floq design tokens: floq Brand Guidelines v1.0 ("floq Monoline") applied to
 * the v3 screen designs (Onboarding v3 / Retail v3).
 *
 * Character: warm Milk ground (#FFF6E3), Charcoal text (#1C1B1A), Marigold as
 * the signature highlight / primary action (#FFB42E, charcoal text on it, 9.7:1),
 * Charcoal for structure / secondary action (Milk text on it), Marigold Deep for
 * links (#A15C00), Paid green (#1E7A46) and Late red (#B42318) for states, which
 * always carry a word. Warm stone neutrals. Rounded cards (14) and chips (8),
 * flat cards (no glows, no gradients), Anek typeface.
 */

export const palette = {
  bg: '#FFF6E3', // milk
  surface: '#F2E6CC', // sand: segment / track / inset surface
  ink: '#1C1B1A', // charcoal
  accent: '#1C1B1A', // charcoal: structure / secondary action (takes milk text)
  accent2: '#1E7A46', // paid green: positive / success
  highlight: '#FFB42E', // marigold: signature highlight / primary CTA (takes charcoal text)
  onHighlight: '#1C1B1A',

  // divider = charcoal at alpha
  divider: 'rgba(28,27,26,0.22)',
  dividerFaint: 'rgba(28,27,26,0.08)',

  // Warm "stone" neutral scale
  neutral: {
    100: '#FBF6EA',
    200: '#EFE6D2',
    300: '#D9CCB0',
    400: '#BDB4A4',
    500: '#8E887E',
    600: '#6B665E', // stone
    700: '#4A463F',
    800: '#322F2A',
    900: '#1C1B1A',
  },

  // Alert/danger ramp (late red #B42318). Errors, "running late", delete and
  // warnings stay red regardless of branding.
  accentRamp: {
    100: '#FDECEA',
    200: '#F8D2CD',
    300: '#F0ADA4',
    400: '#E07A6E',
    500: '#CF4436',
    600: '#B42318', // error
    700: '#8E1C13',
    800: '#6A160F',
    900: '#45130E',
  },

  white: '#ffffff',
  onAccent: '#FFF6E3', // milk text on charcoal

  // Retail surfaces: white cards on the milk ground, and the paid-green pair
  // for positive states (stock received, paid, UPI confirmed).
  card: '#FFFFFF',
  success: '#1E7A46',
  successBg: '#E7F4EC',
  link: '#A15C00', // marigold deep: links / text affordances on light grounds
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
    ready: palette.onHighlight, // v1.0: Ready = charcoal text on a marigold fill
    readyBg: palette.highlight,
    readyBorder: palette.highlight,
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

// floq v1.0: chips/segments 8, cards/buttons/fields 14, sheet tops 22.
export const radius = {
  sm: 4,
  md: 8,
  lg: 14,
  xl: 22,
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
  heading: 'AnekLatin_700Bold', // v1.0 headings are Anek Bold 700
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

// floq v1.0: cards are flat (separated by space, not shadow). Only floating
// bars, sheets and dialogs lift (sm / md / lg).
export const shadow = {
  card: { shadowColor: '#1C1B1A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  cta: { shadowColor: '#1C1B1A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  sm: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  lg: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
} as const;
