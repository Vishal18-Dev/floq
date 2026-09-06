/**
 * FLOQ "Modernist" design tokens — ported from the Claude Design system
 * (_ds/modernist styles.css). Single source of truth for the app's look.
 *
 * Character: warm off-white ground, near-black ink, ONE vermillion accent
 * reserved for the primary action / splash / "ready" state. Zero border
 * radius (sharp corners), 2px ink dividers, Archivo 800 for almost all text.
 */

export const palette = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  ink: '#201e1d',
  accent: '#ec3013',
  accent2: '#e15b47',

  // divider = ink at 40% alpha (rgba of #201e1d)
  divider: 'rgba(32,30,29,0.4)',
  dividerFaint: 'rgba(32,30,29,0.14)',

  neutral: {
    100: '#f8f4f4',
    200: '#eae7e7',
    300: '#d7d3d3',
    400: '#bab6b6',
    500: '#9b9797',
    600: '#7d7979',
    700: '#605d5d',
    800: '#444141',
    900: '#2d2b2b',
  },

  accentRamp: {
    100: '#fff2ef',
    200: '#ffe0d9',
    300: '#ffc4b8',
    400: '#ff9783',
    500: '#ff563c',
    600: '#dd2b0f',
    700: '#ae1800',
    800: '#7c1405',
    900: '#4d170e',
  },

  white: '#ffffff',
  onAccent: '#ffffff',
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

// Modernist system: sharp corners everywhere. `full` kept only for the rare
// dot/pulse indicator; avoid it on containers.
export const radius = {
  sm: 0,
  md: 0,
  lg: 0,
  xl: 0,
  full: 9999,
} as const;

export const borders = {
  hair: 1,
  rule: 2, // the signature 2px ink divider
  ruleColor: palette.divider,
  hairColor: palette.dividerFaint,
} as const;

// Archivo is loaded via expo-font (see theme/fonts.ts). Falls back to the
// platform sans if the face hasn't loaded yet.
export const fonts = {
  heading: 'Archivo_800ExtraBold',
  body: 'Archivo_400Regular',
  semibold: 'Archivo_600SemiBold',
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

// Modernist relies on hard 2px rules, not soft shadows. Keep near-flat.
export const shadow = {
  sm: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  lg: { shadowColor: palette.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
} as const;
