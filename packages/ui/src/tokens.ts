export const tokens = {
  colors: {
    primary: {
      50: '#f0fdf4',
      100: '#dcfce7',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      900: '#14532d',
    },
    brand: {
      black: '#0f172a',
      surface: '#ffffff',
      muted: '#f8fafc',
      border: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#64748b',
      textMuted: '#94a3b8',
    },
    upi: {
      brand: '#005f73',
      bg: '#e0f2fe',
      accent: '#0284c7',
    },
    cash: {
      brand: '#15803d',
      bg: '#dcfce7',
      accent: '#16a34a',
    },
    status: {
      new: '#2563eb',
      preparing: '#d97706',
      ready: '#16a34a',
      completed: '#475569',
      delayed: '#dc2626',
    },
  },
  touchTarget: {
    minHeight: '48px',
    minWidth: '48px',
  },
  radius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
} as const;
