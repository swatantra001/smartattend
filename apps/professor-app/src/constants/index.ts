export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:4000';

export const COLORS = {
  primary:        '#1E7145',
  primaryLight:   '#2E9D60',
  primaryDark:    '#145230',
  accent:         '#1F4E79',
  success:        '#1E7145',
  successLight:   '#E2EFDA',
  danger:         '#C00000',
  dangerLight:    '#FFE7E7',
  warning:        '#C55A11',
  warningLight:   '#FCE4D6',
  suspicious:     '#F4A900',
  suspiciousLight:'#FFF3CD',
  pending:        '#E8E8E8',
  white:          '#FFFFFF',
  background:     '#F5F7FA',
  card:           '#FFFFFF',
  border:         '#E0E0E0',
  textPrimary:    '#1A1A1A',
  textSecondary:  '#666666',
  textMuted:      '#999999',
};

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const RADIUS = {
  sm: 6, md: 12, lg: 20, xl: 32, full: 9999,
};