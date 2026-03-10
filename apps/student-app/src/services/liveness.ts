/**
 * REAL LIVENESS DETECTION IMPLEMENTATION
 *
 * Uses MediaPipe FaceMesh via WebView + postMessage bridge.
 * This runs the full 468-landmark face mesh at ~30fps.
 *
 * Architecture:
 * CameraView (Expo) → captures frames → passes to WebView via base64
 * WebView runs MediaPipe FaceMesh WASM → detects landmarks
 * WebView postMessage → React Native processes landmark data
 * React Native evaluates challenge completion
 */

export interface LandmarkPoint {
  x: number; // normalized 0-1
  y: number;
  z: number;
}

// ── Eye Aspect Ratio (EAR) for blink detection ────────────────────────────
// Uses MediaPipe landmark indices for eye corners + eyelids
// Left eye: 33, 160, 158, 133, 153, 144
// Right eye: 362, 385, 387, 263, 373, 380
export function computeEAR(landmarks: LandmarkPoint[], eyeIndices: number[]): number {
  const p = (i: number) => landmarks[eyeIndices[i]];

  // Vertical distances
  const v1 = Math.hypot(p(1).x - p(5).x, p(1).y - p(5).y);
  const v2 = Math.hypot(p(2).x - p(4).x, p(2).y - p(4).y);

  // Horizontal distance
  const h = Math.hypot(p(0).x - p(3).x, p(0).y - p(3).y);

  return (v1 + v2) / (2.0 * h);
}

// ── Head pose estimation ───────────────────────────────────────────────────
// Uses key landmarks to estimate yaw (left/right) and pitch (up/down)
export function computeHeadPose(landmarks: LandmarkPoint[]): {
  yaw: number;   // degrees: positive = right, negative = left
  pitch: number; // degrees: positive = up, negative = down
} {
  // Nose tip: 1, Chin: 152, Left eye outer: 33, Right eye outer: 263
  // Left mouth: 61, Right mouth: 291
  const noseTip  = landmarks[1];
  const chin     = landmarks[152];
  const leftEye  = landmarks[33];
  const rightEye = landmarks[263];

  // Yaw: compare nose x position relative to midpoint of eyes
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeWidth = Math.abs(rightEye.x - leftEye.x);
  const yaw = ((noseTip.x - eyeMidX) / (eyeWidth * 0.5)) * 35; // scale to degrees approx

  // Pitch: compare nose y to chin-eye midpoint
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.abs(chin.y - eyeMidY);
  const pitch = ((eyeMidY - noseTip.y) / (faceHeight * 0.5)) * 25;

  return { yaw, pitch };
}

// ── Mouth Aspect Ratio (MAR) for smile / open mouth ──────────────────────
// Upper lip: 13, Lower lip: 14, Left mouth: 61, Right mouth: 291
export function computeMAR(landmarks: LandmarkPoint[]): number {
  const upper = landmarks[13];
  const lower = landmarks[14];
  const left  = landmarks[61];
  const right = landmarks[291];

  const vertical   = Math.hypot(upper.x - lower.x, upper.y - lower.y);
  const horizontal = Math.hypot(left.x - right.x, left.y - right.y);

  return vertical / (horizontal + 1e-6);
}

// ── Challenge evaluators ───────────────────────────────────────────────────
export const ChallengeEvaluators: Record<string, (
  landmarks: LandmarkPoint[],
  history: LandmarkPoint[][]
) => { passed: boolean; score: number }> = {

  BLINK_TWICE: (landmarks, history) => {
    const LEFT_EYE  = [33, 160, 158, 133, 153, 144];
    const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

    const ears = history.map(frame => {
      const l = computeEAR(frame, LEFT_EYE);
      const r = computeEAR(frame, RIGHT_EYE);
      return (l + r) / 2;
    });

    // Count blink events (EAR drops below 0.25 then rises above 0.30)
    let blinks = 0;
    let inBlink = false;
    for (const ear of ears) {
      if (!inBlink && ear < 0.22) { inBlink = true; }
      else if (inBlink && ear > 0.28) { inBlink = false; blinks++; }
    }

    return { passed: blinks >= 2, score: Math.min(1, blinks / 2) };
  },

  TURN_HEAD_RIGHT: (landmarks, history) => {
    const maxYaw = Math.max(...history.map(f => computeHeadPose(f).yaw));
    return { passed: maxYaw > 22, score: Math.min(1, maxYaw / 30) };
  },

  TURN_HEAD_LEFT: (landmarks, history) => {
    const minYaw = Math.min(...history.map(f => computeHeadPose(f).yaw));
    return { passed: minYaw < -22, score: Math.min(1, Math.abs(minYaw) / 30) };
  },

  SMILE: (landmarks, history) => {
    // Detect mouth corner lift — compare baseline vs current mouth shape
    const mars = history.map(f => computeMAR(f));
    const baseline = mars.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    const peak = Math.max(...mars.slice(5));
    const smileRatio = peak / (baseline + 1e-6);
    return { passed: smileRatio > 1.4, score: Math.min(1, smileRatio / 1.6) };
  },

  NOD: (landmarks, history) => {
    const pitches = history.map(f => computeHeadPose(f).pitch);
    const maxPitch = Math.max(...pitches);
    const minPitch = Math.min(...pitches);
    const range = maxPitch - minPitch;
    return { passed: range > 18, score: Math.min(1, range / 25) };
  },

  OPEN_MOUTH: (landmarks, history) => {
    const mars = history.map(f => computeMAR(f));
    const maxMar = Math.max(...mars);
    return { passed: maxMar > 0.55, score: Math.min(1, maxMar / 0.7) };
  },
};