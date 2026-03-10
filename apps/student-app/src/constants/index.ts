export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

export const COLORS = {
  primary:        '#1F4E79',
  primaryLight:   '#2E75B6',
  primaryDark:    '#152F47',
  success:        '#1E7145',
  successLight:   '#E2EFDA',
  danger:         '#C00000',
  dangerLight:    '#FFE7E7',
  warning:        '#C55A11',
  warningLight:   '#FCE4D6',
  suspicious:     '#F4A900',
  suspiciousLight:'#FFF3CD',
  white:          '#FFFFFF',
  background:     '#F5F7FA',
  card:           '#FFFFFF',
  border:         '#E0E0E0',
  textPrimary:    '#1A1A1A',
  textSecondary:  '#666666',
  textMuted:      '#999999',
  overlay:        'rgba(0,0,0,0.6)',
};

export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
};

export const SPACING = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const RADIUS = {
  sm:  6,
  md:  12,
  lg:  20,
  xl:  32,
  full: 9999,
};

// Liveness challenge display config
export const CHALLENGE_CONFIG: Record<string, {
  instruction: string;
  icon: string;
  duration: number; // seconds
}> = {
  BLINK_TWICE:     { instruction: 'Blink twice slowly',         icon: '👁️',  duration: 5 },
  TURN_HEAD_RIGHT: { instruction: 'Turn your head to the right', icon: '➡️',  duration: 5 },
  TURN_HEAD_LEFT:  { instruction: 'Turn your head to the left',  icon: '⬅️',  duration: 5 },
  SMILE:           { instruction: 'Give a big smile',            icon: '😊',  duration: 5 },
  NOD:             { instruction: 'Nod your head up and down',   icon: '⬆️⬇️', duration: 6 },
  OPEN_MOUTH:      { instruction: 'Open your mouth wide',        icon: '😮',  duration: 4 },
};