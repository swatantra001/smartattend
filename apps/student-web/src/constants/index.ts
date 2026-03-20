export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const WS_URL =
  import.meta.env.VITE_WS_URL || 'http://localhost:4000';

export const CHALLENGE_CONFIG: Record<string, { instruction: string; icon: string; duration: number }> = {
  BLINK_TWICE:     { instruction: 'Blink twice slowly',          icon: '👁️',   duration: 5 },
  TURN_HEAD_RIGHT: { instruction: 'Turn your head to the right', icon: '➡️',   duration: 5 },
  TURN_HEAD_LEFT:  { instruction: 'Turn your head to the left',  icon: '⬅️',   duration: 5 },
  SMILE:           { instruction: 'Give a big smile',            icon: '😊',   duration: 5 },
  NOD:             { instruction: 'Nod your head up and down',   icon: '⬆️⬇️', duration: 6 },
  OPEN_MOUTH:      { instruction: 'Open your mouth wide',        icon: '😮',   duration: 4 },
};