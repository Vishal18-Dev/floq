export const colors = {
  primary: '#16a34a',
  primaryDark: '#15803d',
  primaryLight: '#dcfce7',
  primaryMuted: '#f0fdf4',

  background: '#f8fafc',
  surface: '#ffffff',
  surfaceSubtle: '#f1f5f9',
  border: '#e2e8f0',
  borderDark: '#cbd5e1',

  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textWhite: '#ffffff',

  upi: '#0284c7',
  upiBg: '#e0f2fe',
  upiDark: '#0369a1',

  cash: '#16a34a',
  cashBg: '#dcfce7',

  status: {
    new: '#2563eb',
    newBg: '#eff6ff',
    newBorder: '#bfdbfe',
    preparing: '#d97706',
    preparingBg: '#fffbeb',
    preparingBorder: '#fde68a',
    ready: '#16a34a',
    readyBg: '#f0fdf4',
    readyBorder: '#bbf7d0',
    completed: '#475569',
    completedBg: '#f8fafc',
    completedBorder: '#e2e8f0',
    delayed: '#dc2626',
    delayedBg: '#fef2f2',
    delayedBorder: '#fecaca',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  header: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.textPrimary,
  },
  subHeader: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.textMuted,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
};

export const shadow = {
  sm: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
};
