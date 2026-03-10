import { LivenessChallenge } from "@smartattend/shared";


const CHALLENGE_POOL: LivenessChallenge[] = [
  LivenessChallenge.BLINK_TWICE,
  LivenessChallenge.TURN_HEAD_RIGHT,
  LivenessChallenge.TURN_HEAD_LEFT,
  LivenessChallenge.SMILE,
  LivenessChallenge.NOD,
  LivenessChallenge.OPEN_MOUTH,
];

// Randomly pick N unique challenges for a session
export function generateChallenges(count: number = 2): LivenessChallenge[] {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Human-readable instructions for each challenge (shown on student screen)
export const CHALLENGE_INSTRUCTIONS: Record<LivenessChallenge, string> = {
  BLINK_TWICE:      'Blink twice slowly',
  TURN_HEAD_RIGHT:  'Turn your head to the right',
  TURN_HEAD_LEFT:   'Turn your head to the left',
  SMILE:            'Give a big smile',
  NOD:              'Nod your head up and down',
  OPEN_MOUTH:       'Open your mouth wide'
};

// Timeout per challenge in seconds
export const CHALLENGE_TIMEOUTS: Record<LivenessChallenge, number> = {
  BLINK_TWICE:      5,
  TURN_HEAD_RIGHT:  5,
  TURN_HEAD_LEFT:   5,
  SMILE:            5,
  NOD:              6,
  OPEN_MOUTH:       4
};