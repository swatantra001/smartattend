
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Vibration, StatusBar, Easing, Platform,
} from 'react-native';
import {
  Camera, useCameraPermission, useCameraDevice,
  useFrameProcessor, runAtTargetFps,
} from 'react-native-vision-camera';
import { Face, useFaceDetector, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { Worklets } from 'react-native-worklets-core';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttendanceAPI } from '../src/services/api';

const { width: SW, height: SH } = Dimensions.get('window');
const OVAL_W = SW * 0.68;
const OVAL_H = OVAL_W * 1.35;
const OVAL_TOP = SH * 0.12;
const FONTS = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

// ─────────────────────────────────────────────────────────────
// ENHANCED COLOR PALETTE – deep space / holographic
// ─────────────────────────────────────────────────────────────
const C = {
  bg: '#010A12',
  border: 'rgba(0,240,255,0.18)',
  cyan: '#00F0FF',
  green: '#00FF88',
  yellow: '#FFE200',
  red: '#FF1744',
  purple: '#D000FF',
  orange: '#FF6D00',
  teal: '#00E5C8',
  white: '#E8F8FF',
  dim: 'rgba(180,240,255,0.5)',
  dimmer: 'rgba(120,200,230,0.22)',
  card: 'rgba(0,8,18,0.97)',
  accent1: '#0AF',
  accent2: '#05FFD8',
  panelBg: 'rgba(0,18,32,0.88)',
  gridLine: 'rgba(0,200,255,0.07)',
};

interface ChallengeDef {
  icon: string; label: string; instruction: string;
  hint: string; color: string; duration: number;
}
const DEFS: Record<string, ChallengeDef> = {
  BLINK_TWICE: { icon: '◉', label: 'SYS_BLINK', color: C.purple, duration: 12, instruction: 'EXECUTE DOUBLE BLINK', hint: 'CLOSE EYES FULLY TWICE' },
  TURN_HEAD_LEFT: { icon: '◁', label: 'YAW_LEFT', color: C.yellow, duration: 12, instruction: 'YAW ROTATE: LEFT', hint: 'ALIGN VECTORS TO LEFT' },
  TURN_HEAD_RIGHT: { icon: '▷', label: 'YAW_RIGHT', color: C.yellow, duration: 12, instruction: 'YAW ROTATE: RIGHT', hint: 'ALIGN VECTORS TO RIGHT' },
  NOD: { icon: '⬍', label: 'PITCH_NOD', color: C.green, duration: 12, instruction: 'PITCH ROTATE: DOWN/UP', hint: 'EXECUTE VERTICAL NOD' },
  SMILE: { icon: '◡', label: 'EXP_SMILE', color: C.orange, duration: 10, instruction: 'TRIGGER EXPRESSION: SMILE', hint: 'MAXIMIZE MOUTH WIDTH' },
  OPEN_MOUTH: { icon: '⊙', label: 'EXP_OPEN', color: C.cyan, duration: 10, instruction: 'TRIGGER EXPRESSION: OPEN', hint: 'MAXIMIZE MOUTH HEIGHT' },
};

type Phase = 'INIT' | 'READY' | 'LIVENESS_CHECK' | 'CHALLENGE' | 'CAPTURING' | 'SUBMITTING' | 'SUCCESS' | 'SUSPICIOUS' | 'FAILED' | 'EXPIRED';
type ChallengeStatus = 'ALIGNING' | 'ACTION' | 'PASSED' | 'FAILED_RETRY';

interface ChState {
  idx: number; key: string; status: ChallengeStatus;
  progress: number; timeLeft: number; feedback: string; liveInfo: string;
  leftEAR?: number; rightEAR?: number;
}

interface FaceData {
  detected: boolean; tooSmall?: boolean; tooBig?: boolean;
  yaw: number; pitch: number; roll: number;
  leftEAR: number; rightEAR: number;
  leftIrisRatio: number; rightIrisRatio: number;
  smileScore: number; mouthOpen: number; noseTipY: number;
  zIQR: number; flowPoints: [number, number][];
}

function earDist(a: [number, number], b: [number, number]): number {
  'worklet';
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}
function computeEAR(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number], p5: [number, number], p6: [number, number]): number {
  'worklet';
  return (earDist(p2, p6) + earDist(p3, p5)) / (2 * earDist(p1, p4) + 0.001);
}

function buildFaceData(face: Face, fw: number, fh: number): FaceData {
  'worklet';
  const b = face.bounds;
  const fa = (b.width * b.height) / (fw * fh);
  const yaw = (face as any).yawAngle ?? 0, pitch = (face as any).pitchAngle ?? 0, roll = (face as any).rollAngle ?? 0;
  const mesh = (face as any).contours as Record<string, Array<{ x: number; y: number; z?: number }>> | undefined;
  const cp = (c: string, i: number): [number, number] | null => { const p = mesh?.[c]; return (!p || !p[i]) ? null : [p[i].x / fw, p[i].y / fh]; };
  let leftEAR = (face as any).leftEyeOpenProbability;
  let rightEAR = (face as any).rightEyeOpenProbability;
  const le = mesh?.['LEFT_EYE'], re = mesh?.['RIGHT_EYE'];
  if (leftEAR === undefined || rightEAR === undefined) {
    leftEAR = 1; rightEAR = 1;
    if (le && le.length >= 16) { const n = (i: number): [number, number] => [le[i].x / fw, le[i].y / fh]; leftEAR = computeEAR(n(0), n(4), n(3), n(8), n(12), n(13)); }
    if (re && re.length >= 16) { const n = (i: number): [number, number] => [re[i].x / fw, re[i].y / fh]; rightEAR = computeEAR(n(0), n(4), n(3), n(8), n(12), n(13)); }
  }
  const li = mesh?.['LEFT_IRIS'], ri = mesh?.['RIGHT_IRIS'];
  let leftIrisRatio = 0.5, rightIrisRatio = 0.5;
  if (li && le && le.length >= 9) { const ix = li[0].x / fw, ox = le[0].x / fw, nx = le[8].x / fw, ew = Math.abs(nx - ox); if (ew > 0.001) leftIrisRatio = (ix - Math.min(ox, nx)) / ew; }
  if (ri && re && re.length >= 9) { const ix = ri[0].x / fw, ox = re[0].x / fw, nx = re[8].x / fw, ew = Math.abs(nx - ox); if (ew > 0.001) rightIrisRatio = (ix - Math.min(ox, nx)) / ew; }
  const smileScore = (face as any).smilingProbability ?? 0;
  const ul = cp('UPPER_LIP_TOP', 0), ll = cp('LOWER_LIP_BOTTOM', 0);
  const mouthOpen = (ul && ll && b.height > 0) ? Math.abs(ll[1] - ul[1]) / (b.height / fh) : 0;
  const nb = mesh?.['NOSE_BRIDGE'];
  const noseTipY = nb && nb.length > 0 ? nb[nb.length - 1].y / fh : (b.y + b.height * 0.5) / fh;
  let zIQR = 0;
  if (mesh) {
    const zv: number[] = []; for (const k of Object.keys(mesh)) { const pts = mesh[k]; for (let i = 0; i < pts.length; i += 2)if (pts[i]?.z !== undefined) zv.push(pts[i].z!); }
    if (zv.length >= 8) { zv.sort((a, b) => a - b); zIQR = Math.abs(zv[Math.floor(zv.length * 0.75)] - zv[Math.floor(zv.length * 0.25)]); }
  }
  const fp1 = cp('NOSE_BRIDGE', 0) ?? [0.5, 0.45], fp2 = cp('LEFT_CHEEK', 0) ?? [0.3, 0.55],
    fp3 = cp('RIGHT_CHEEK', 0) ?? [0.7, 0.55], fp4 = cp('LEFT_EYE', 0) ?? [0.33, 0.4], fp5 = cp('RIGHT_EYE', 0) ?? [0.67, 0.4];
  return {
    detected: true, tooSmall: fa < 0.12, tooBig: fa > 0.65, yaw, pitch, roll, leftEAR, rightEAR,
    leftIrisRatio, rightIrisRatio, smileScore, mouthOpen, noseTipY, zIQR,
    flowPoints: [fp1, fp2, fp3, fp4, fp5] as [number, number][]
  };
}

// ─────────────────────────────────────────────────────────────
// ALGORITHM THRESHOLDS & CONSTANTS  (unchanged)
// ─────────────────────────────────────────────────────────────
const MIN_EAR_VARIANCE = 0.0004;
const MIN_IRIS_JITTER = 0.00015;
const MIN_FLOW_AVG = 0.00015;
const MIN_Z_VAR = 0.000004;
const LIVENESS_SCORE_TARGET = 100;
const ALIGN_FRAMES = 6;
const ALIGN_YAW_MAX = 12;
const ALIGN_PITCH_MAX = 12;
const ALIGN_ROLL_MAX = 10;
const SMILE_THRESHOLD = 0.55;
const SMILE_HOLD = 4;
const MOUTH_OPEN_THRESHOLD = 0.06;
const MOUTH_HOLD = 4;
const ACTION_HOLD_FRAMES = 3;

function vibSound(type: 'tick' | 'lock' | 'pass' | 'fail' | 'beep' | 'alert') {
  if (type === 'tick') Vibration.vibrate(5);
  if (type === 'lock') Vibration.vibrate([0, 10, 10, 10]);
  if (type === 'pass') Vibration.vibrate([0, 40, 30, 80]);
  if (type === 'fail') Vibration.vibrate([0, 80, 50, 80]);
  if (type === 'beep') Vibration.vibrate(20);
  if (type === 'alert') Vibration.vibrate([0, 100, 50, 100, 50, 100]);
}

// ═══════════════════════════════════════════════════════════════
// UI COMPONENTS – Enhanced Sci-Fi
// ═══════════════════════════════════════════════════════════════

// Animated hexagonal grid + deep space background
const GridBackground = React.memo(() => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const shimmerOp = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.13] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base vignette */}
      <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,4,12,0.55)' }} />

      {/* Fine horizontal scan lines */}
      <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', opacity: shimmerOp }}>
        {[...Array(32)].map((_, i) => (
          <View key={`h${i}`} style={{
            position: 'absolute', top: i * (SH / 32),
            width: '100%', height: 0.5,
            backgroundColor: C.cyan,
          }} />
        ))}
      </Animated.View>

      {/* Vertical lines */}
      <Animated.View style={{ position: 'absolute', width: '100%', height: '100%', opacity: shimmerOp }}>
        {[...Array(14)].map((_, i) => (
          <View key={`v${i}`} style={{
            position: 'absolute', left: i * (SW / 13),
            width: 0.5, height: '100%',
            backgroundColor: C.cyan,
          }} />
        ))}
      </Animated.View>

      {/* Corner decorative brackets – top-left */}
      <View style={{ position: 'absolute', top: 52, left: 12 }}>
        <View style={{ width: 32, height: 2, backgroundColor: C.cyan, opacity: 0.6 }} />
        <View style={{ width: 2, height: 32, backgroundColor: C.cyan, opacity: 0.6, marginTop: -2 }} />
      </View>
      {/* top-right */}
      <View style={{ position: 'absolute', top: 52, right: 12, alignItems: 'flex-end' }}>
        <View style={{ width: 32, height: 2, backgroundColor: C.cyan, opacity: 0.6 }} />
        <View style={{ width: 2, height: 32, backgroundColor: C.cyan, opacity: 0.6, alignSelf: 'flex-end', marginTop: -2 }} />
      </View>
      {/* bottom-left */}
      <View style={{ position: 'absolute', bottom: 12, left: 12 }}>
        <View style={{ width: 2, height: 32, backgroundColor: C.teal, opacity: 0.5 }} />
        <View style={{ width: 32, height: 2, backgroundColor: C.teal, opacity: 0.5 }} />
      </View>
      {/* bottom-right */}
      <View style={{ position: 'absolute', bottom: 12, right: 12, alignItems: 'flex-end' }}>
        <View style={{ width: 2, height: 32, backgroundColor: C.teal, opacity: 0.5, alignSelf: 'flex-end' }} />
        <View style={{ width: 32, height: 2, backgroundColor: C.teal, opacity: 0.5 }} />
      </View>

      {/* Subtle bottom gradient fade */}
      <View style={{ position: 'absolute', bottom: 0, width: '100%', height: 160, backgroundColor: 'rgba(0,5,18,0.7)' }} />
    </View>
  );
});

// Scrolling hex telemetry ticker
const TelemetryData = React.memo(() => {
  const [data, setData] = useState('');
  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const int = setInterval(() => {
      let str = '';
      for (let i = 0; i < 5; i++) str += Math.random().toString(16).substring(2, 6).toUpperCase() + ' ';
      setData(str);
    }, 120);
    Animated.loop(
      Animated.timing(slideAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    return () => clearInterval(int);
  }, []);
  return (
    <View style={{ overflow: 'hidden', width: 88, marginBottom: 4 }}>
      <Text style={tc.matrix} numberOfLines={1}>{data}</Text>
      <Text style={[tc.matrix, { color: C.teal, marginTop: 2 }]} numberOfLines={1}>
        {Math.random().toString(36).substring(2, 10).toUpperCase()}
      </Text>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────
// HUD Chip – holographic bar meter
// ─────────────────────────────────────────────────────────────
interface HUDChipProps {
  label: string; value: number; target: number; passed: boolean; color: string; displayVal: string; alignLeft?: boolean;
}
const HUDChip = React.memo(({ label, value, target, passed, color, displayVal, alignLeft }: HUDChipProps) => {
  const barAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { Animated.spring(barAnim, { toValue: Math.min(1, Math.max(0, value)), friction: 8, tension: 80, useNativeDriver: false }).start(); }, [value]);
  useEffect(() => {
    Animated.timing(glowAnim, { toValue: passed ? 1 : 0, duration: 300, useNativeDriver: false }).start();
    if (passed) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.97, duration: 600, useNativeDriver: true }),
      ])).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [passed]);

  const barW = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const barColor = barAnim.interpolate({ inputRange: [0, target * 0.5, target, 1], outputRange: [C.red, C.yellow, color, color], extrapolate: 'clamp' });
  const borderC = passed ? color : color + '30';
  const bgC = passed ? color + '18' : 'rgba(0,12,24,0.75)';

  return (
    <Animated.View style={[hc.chip, { borderColor: borderC, backgroundColor: bgC, transform: [{ scale: pulseAnim }] }]}>
      {/* Top accent line */}
      <Animated.View style={[hc.topAccent, { backgroundColor: color, opacity: glowAnim }]} />

      <View style={[hc.row, alignLeft ? { flexDirection: 'row' } : { flexDirection: 'row-reverse' }]}>
        <Text style={[hc.lbl, { color: passed ? color : C.dim }]}>{label}</Text>
        <Text style={[hc.val, { color: passed ? color : C.dimmer }]}>{displayVal}</Text>
      </View>

      {/* Segmented bar */}
      <View style={hc.track}>
        {[...Array(10)].map((_, i) => (
          <View key={i} style={[hc.seg, { backgroundColor: C.dimmer }]} />
        ))}
        <View style={[hc.tmark, { left: `${target * 100}%` as any }]} />
        <Animated.View style={[hc.fill, {
          width: barW, backgroundColor: barColor,
          shadowColor: color, shadowOpacity: glowAnim, shadowRadius: 10, elevation: 6,
        }]} />
      </View>

      {/* Passed checkmark indicator */}
      {passed && (
        <View style={[hc.passedDot, { backgroundColor: color }]} />
      )}
    </Animated.View>
  );
});

const hc = StyleSheet.create({
  chip: { width: 88, borderWidth: 1, borderRadius: 3, padding: 7, paddingBottom: 6, marginBottom: 9, overflow: 'hidden', position: 'relative' },
  topAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  row: { justifyContent: 'space-between', marginBottom: 5 },
  lbl: { fontFamily: FONTS, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  val: { fontFamily: FONTS, fontSize: 10.5, fontWeight: '900' },
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.04)', position: 'relative', flexDirection: 'row', gap: 1 },
  seg: { flex: 1, height: '100%', borderRadius: 1 },
  fill: { position: 'absolute', top: 0, left: 0, height: 4, borderRadius: 2 },
  tmark: { position: 'absolute', top: -3, width: 1.5, height: 10, backgroundColor: 'rgba(255,255,255,0.5)', zIndex: 3 },
  passedDot: { position: 'absolute', bottom: 5, right: 6, width: 4, height: 4, borderRadius: 2 },
});

// ─────────────────────────────────────────────────────────────
// TargetingReticle – multi-ring holographic
// ─────────────────────────────────────────────────────────────
const TargetingReticle = React.memo(({ color, detected, progress, allPass }: {
  color: string; detected: boolean; progress: number; allPass: boolean;
}) => {
  const r1 = useRef(new Animated.Value(0)).current;
  const r2 = useRef(new Animated.Value(0)).current;
  const r3 = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(r1, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(r2, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(r3, { toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);

  useEffect(() => {
    if (allPass) {
      Animated.timing(glowOp, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.025, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.975, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    } else {
      Animated.timing(glowOp, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      pulse.stopAnimation(); pulse.setValue(1);
    }
  }, [allPass]);

  const spin1 = r1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = r2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const spin3 = r3.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const gc = allPass ? C.green : detected ? color : C.red;
  const cw = OVAL_W + 20; const ch = OVAL_H + 20;

  // Progress arc – 4 quadrants lit based on progress
  const q1 = progress > 0;
  const q2 = progress > 0.25;
  const q3 = progress > 0.5;
  const q4 = progress > 0.75;

  return (
    <Animated.View style={[ri.wrap, { transform: [{ scale: pulse }] }]} pointerEvents="none">

      {/* Glow halo when allPass */}
      <Animated.View style={[ri.glow, { borderColor: gc, opacity: glowOp, shadowColor: gc }]} />

      {/* Corner L-brackets */}
      {[
        { top: -20, left: -20, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
        { top: -20, right: -20, borderTopWidth: 2.5, borderRightWidth: 2.5 },
        { bottom: -20, left: -20, borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
        { bottom: -20, right: -20, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
      ].map((s, i) => (
        <View key={i} style={[ri.bracket, s, { borderColor: gc }]} />
      ))}

      {/* Tiny corner dots */}
      {[
        { top: -24, left: -24 }, { top: -24, right: -24 },
        { bottom: -24, left: -24 }, { bottom: -24, right: -24 },
      ].map((s, i) => (
        <View key={`dot${i}`} style={[ri.cornerDot, s, { backgroundColor: gc }]} />
      ))}

      {/* Outer dashed rotating ring */}
      <Animated.View style={[ri.arc, { width: cw + 28, height: ch + 28, transform: [{ rotate: spin2 }] }]}>
        <View style={{
          width: cw + 28, height: ch + 28, borderRadius: (cw + 28) / 2,
          borderWidth: 1, borderColor: 'transparent',
          borderTopColor: gc + '55', borderBottomColor: gc + '33',
          borderStyle: 'dashed', position: 'absolute',
        }} />
      </Animated.View>

      {/* Middle spinning arc */}
      <Animated.View style={[ri.arc, { width: cw, height: ch, transform: [{ rotate: spin1 }] }]}>
        <View style={{
          width: cw, height: ch, borderRadius: cw / 2,
          borderWidth: 2, borderColor: 'transparent',
          borderTopColor: gc + 'CC', borderRightColor: gc + '44',
          position: 'absolute',
        }} />
      </Animated.View>

      {/* Inner fast spin – thin tick marks */}
      <Animated.View style={[ri.arc, { width: cw - 20, height: ch - 20, transform: [{ rotate: spin3 }] }]}>
        <View style={{
          width: cw - 20, height: ch - 20, borderRadius: (cw - 20) / 2,
          borderWidth: 1, borderColor: 'transparent',
          borderLeftColor: gc + '88', borderRightColor: gc + '44',
          position: 'absolute',
        }} />
      </Animated.View>

      {/* Progress arc ring – 4 quadrant fill */}
      <View style={[ri.arc, { width: OVAL_W - 12, height: OVAL_H - 12 }]}>
        <View style={{
          width: OVAL_W - 12, height: OVAL_H - 12, borderRadius: (OVAL_W - 12) / 2,
          borderWidth: 3.5, borderColor: 'transparent',
          borderTopColor: q1 ? gc : gc + '22',
          borderRightColor: q2 ? gc : gc + '22',
          borderBottomColor: q3 ? gc : gc + '22',
          borderLeftColor: q4 ? gc : gc + '22',
          position: 'absolute',
          shadowColor: gc, shadowRadius: 8, shadowOpacity: progress > 0.5 ? 0.8 : 0,
        }} />
      </View>

      {/* Data tick marks on oval edge */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const rx = (OVAL_W / 2 + 4);
        const ry = (OVAL_H / 2 + 4);
        const x = rx * Math.sin(rad);
        const y = -ry * Math.cos(rad);
        return (
          <View key={`tick${i}`} style={{
            position: 'absolute',
            width: i % 2 === 0 ? 6 : 4,
            height: 1.5,
            backgroundColor: gc,
            opacity: 0.6,
            transform: [{ translateX: x }, { translateY: y }, { rotate: `${deg}deg` }],
          }} />
        );
      })}
    </Animated.View>
  );
});

const ri = StyleSheet.create({
  wrap: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  bracket: { position: 'absolute', width: 28, height: 28 },
  cornerDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
  arc: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  glow: {
    position: 'absolute',
    width: OVAL_W + 60, height: OVAL_H + 60,
    borderRadius: (OVAL_W + 60) / 2,
    borderWidth: 1.5,
    shadowRadius: 24, shadowOpacity: 0.9, elevation: 20,
  },
});

// ─────────────────────────────────────────────────────────────
// Crosshair – precision targeting
// ─────────────────────────────────────────────────────────────
const Crosshair = ({ color, visible }: { color: string; visible: boolean }) => {
  const sc = useRef(new Animated.Value(1.8)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ro = useRef(new Animated.Value(0)).current;
  const innerPulse = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      Animated.loop(Animated.timing(ro, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([
        Animated.timing(innerPulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(innerPulse, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    } else {
      Animated.timing(op, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    }
  }, [visible]);
  const rotate = ro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const S = 88;
  return (
    <Animated.View style={{ position: 'absolute', width: S, height: S, justifyContent: 'center', alignItems: 'center', opacity: op, transform: [{ scale: sc }] }} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', width: S, height: S, borderRadius: S / 2, borderWidth: 1.5, borderColor: color + '77', transform: [{ rotate }], borderStyle: 'dashed' }} />
      <Animated.View style={{ position: 'absolute', width: S * 0.28, height: S * 0.28, borderWidth: 2, borderColor: color, opacity: innerPulse }} />
      {/* Cross hairs */}
      <View style={{ position: 'absolute', height: 1.5, width: S * 0.9, backgroundColor: color + '66' }} />
      <View style={{ position: 'absolute', width: 1.5, height: S * 0.9, backgroundColor: color + '66' }} />
      {/* Center dot */}
      <Animated.View style={{ position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: innerPulse }} />
      {/* Diamond corners */}
      {[{ t: -S * 0.44, l: 0 }, { b: -S * 0.44, l: 0 }, { l: -S * 0.44, t: 0 }, { r: -S * 0.44, t: 0 }].map((pos, i) => (
        <View key={i} style={[{ position: 'absolute', width: 4, height: 4, backgroundColor: color }, pos as any]} />
      ))}
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// GuidanceOverlay – holographic banner
// ─────────────────────────────────────────────────────────────
const GuidanceOverlay = ({ feedback, color, alert }: { feedback: string; color: string; alert: boolean }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const slideY = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    if (alert) {
      Animated.loop(Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.25, duration: 120, useNativeDriver: true }),
      ])).start();
    } else {
      anim.stopAnimation(); anim.setValue(1);
      Animated.spring(slideY, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }).start();
    }
  }, [alert, feedback]);

  return (
    <Animated.View style={[tc.guideBox, {
      borderColor: color,
      opacity: anim,
      backgroundColor: alert ? 'rgba(255,20,60,0.15)' : 'rgba(0,12,28,0.92)',
      transform: [{ translateY: slideY }],
    }]}>
      {/* Left accent bar */}
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />

      {/* Tiny label */}
      <Text style={[tc.guideTag, { color: color + 'AA' }]}>BIOMETRIC_DIRECTIVE</Text>
      <Text style={[tc.guideTxt, { color }]}>{feedback}</Text>

      {/* Bottom shimmer line */}
      <View style={{ position: 'absolute', bottom: 0, left: 3, right: 3, height: 1, backgroundColor: color + '44' }} />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────────────────────
// ScanSweep – enhanced with gradient fade
// ─────────────────────────────────────────────────────────────
const ScanSweep = React.memo(({ color, active }: { color: string; active: boolean }) => {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) { Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }).start(); return; }
    op.setValue(0.9);
    Animated.loop(Animated.timing(y, { toValue: OVAL_H, duration: 2000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [active]);
  return (
    <Animated.View style={[{ position: 'absolute', width: OVAL_W, height: OVAL_H, top: 0, left: 0, overflow: 'hidden', opacity: op }]} pointerEvents="none">
      <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: OVAL_W, transform: [{ translateY: y }] }]}>
        {/* Gradient fade above */}
        <View style={{ width: '100%', height: 40, backgroundColor: 'transparent' }} />
        {/* Main scan line */}
        <View style={{ width: '100%', height: 2, backgroundColor: color, shadowColor: color, shadowRadius: 8, shadowOpacity: 1 }} />
        {/* Glow below */}
        <View style={{ width: '100%', height: 16, backgroundColor: color + '18' }} />
      </Animated.View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────────
// CaptureBurst – radial explosion
// ─────────────────────────────────────────────────────────────
const CaptureBurst = ({ visible, color }: { visible: boolean; color: string }) => {
  const sc = useRef(new Animated.Value(0.3)).current;
  const op = useRef(new Animated.Value(0)).current;
  const sc2 = useRef(new Animated.Value(0.6)).current;
  const op2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      sc.setValue(0.3); op.setValue(1); sc2.setValue(0.6); op2.setValue(0.6);
      Animated.parallel([
        Animated.timing(sc, { toValue: 4, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(sc2, { toValue: 2.5, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(op2, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return (
    <>
      <Animated.View style={{ position: 'absolute', width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2, borderWidth: 5, borderColor: color, transform: [{ scale: sc }], opacity: op }} pointerEvents="none" />
      <Animated.View style={{ position: 'absolute', width: OVAL_W * 0.6, height: OVAL_H * 0.6, borderRadius: OVAL_W, borderWidth: 2, borderColor: color + '88', transform: [{ scale: sc2 }], opacity: op2 }} pointerEvents="none" />
    </>
  );
};

function AnimDot({ delay, color }: { delay: number; color: string }) {
  const op = useRef(new Animated.Value(0.15)).current;
  const sc = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(op, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(sc, { toValue: 1.2, duration: 350, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(op, { toValue: 0.15, duration: 350, useNativeDriver: true }),
        Animated.timing(sc, { toValue: 0.8, duration: 350, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: op, marginHorizontal: 7, transform: [{ scale: sc }] }} />;
}

function FlashOverlay({ trigRef }: { trigRef: React.MutableRefObject<(c: string) => void> }) {
  const op = useRef(new Animated.Value(0)).current;
  const clr = useRef(C.cyan);
  useEffect(() => {
    trigRef.current = (c: string) => {
      clr.current = c; op.setValue(0.55);
      Animated.timing(op, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    };
  }, []);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: clr.current, opacity: op, zIndex: 998 }]} />;
}

// ─────────────────────────────────────────────────────────────
// SideDataStream – vertical scrolling hex values on each side
// ─────────────────────────────────────────────────────────────
const SideDataStream = React.memo(({ right }: { right?: boolean }) => {
  const [lines, setLines] = useState<string[]>([]);
  const scrollY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const gen = () => {
      const arr: string[] = [];
      for (let i = 0; i < 12; i++) arr.push(Math.random().toString(16).substring(2, 8).toUpperCase());
      setLines(arr);
    };
    gen();
    const int = setInterval(gen, 600);
    Animated.loop(
      Animated.timing(scrollY, { toValue: -240, duration: 8000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    return () => clearInterval(int);
  }, []);
  return (
    <View style={{ position: 'absolute', top: OVAL_TOP + OVAL_H / 4, [right ? 'right' : 'left']: 4, height: OVAL_H / 2, overflow: 'hidden', width: 28, opacity: 0.25 }} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY: scrollY }] }}>
        {lines.map((l, i) => (
          <Text key={i} style={{ fontFamily: FONTS, fontSize: 6.5, color: C.cyan, lineHeight: 20, letterSpacing: 1, textAlign: right ? 'right' : 'left' }}>{l}</Text>
        ))}
      </Animated.View>
    </View>
  );
});

// ═══════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════
export default function VerifyScreen() {
  const params = useLocalSearchParams<{
    session_id: string; course_name: string; professor_name: string; expires_at: string; challenges: string;
  }>();

  const rawChallenges = useMemo(() => {
    try { return JSON.parse(params.challenges || '[]'); }
    catch { return []; }
  }, []);

  const challengeKeys: string[] = useMemo(() => {
    return (rawChallenges as string[]).map(c => DEFS[c] ? c : 'BLINK_TWICE');
  }, [rawChallenges]);

  const expiresAt = useMemo(() => params.expires_at ? new Date(params.expires_at) : new Date(Date.now() + 5 * 60_000), []);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  const fdOpts = useRef<FrameFaceDetectionOptions>({
    performanceMode: 'fast', landmarkMode: 'all', contourMode: 'all', classificationMode: 'all', minFaceSize: 0.1, trackingEnabled: true,
  }).current;
  const { detectFaces, stopListeners } = useFaceDetector(fdOpts);

  const [phase, setPhase] = useState<Phase>('INIT');
  const [sessTimeLeft, setSessTime] = useState(300);
  const [faceDetected, setFaceDetected] = useState(false);
  const [completedList, setCompleted] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [livenessBlocked, setLivenessBlocked] = useState(false);
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [livSignals, setLivSignals] = useState({ ear: 0, iris: 0, flow: 0, z: 0 });
  const [showBurst, setShowBurst] = useState(false);
  const [chState, setChState] = useState<ChState>({
    idx: 0, key: challengeKeys[0] || 'BLINK_TWICE', status: 'ALIGNING', progress: 0, timeLeft: 0, feedback: '[ AWAITING SUBJECT ]', liveInfo: '',
  });

  const cameraRef = useRef<Camera>(null);
  const phaseRef = useRef<Phase>('INIT');
  const lockRef = useRef(false);
  const captureRef = useRef(false);
  const scoresRef = useRef<Record<string, number>>({});
  const completedRef = useRef<string[]>([]);
  const curKeyRef = useRef(challengeKeys[0] || 'BLINK_TWICE');
  const curIdxRef = useRef(0);
  const sessionTimerR = useRef<ReturnType<typeof setInterval>>();
  const challengeTimerR = useRef<ReturnType<typeof setInterval>>();
  const flashTrig = useRef<(c: string) => void>(() => { });

  const drawerSlide = useRef(new Animated.Value(0)).current;
  const drawerFade = useRef(new Animated.Value(1)).current;
  const animDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerFade, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(drawerSlide, { toValue: -10, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      drawerSlide.setValue(10);
      Animated.parallel([
        Animated.timing(drawerFade, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(drawerSlide, { toValue: 0, duration: 200, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const livRef = useRef({
    earHistory: [] as number[], irisHistory: [] as number[],
    flowDisp: [] as number[], zHistory: [] as number[],
    prevFlowPts: null as [number, number][] | null,
    smoothProgress: 0, livenessScore: 0,
  });

  const engRef = useRef({
    stage: 0 as 0 | 1, alignFrames: 0, baseEAR: 0, baseIris: 0.5, baseNoseY: 0.5, baseYaw: 0, basePitch: 0,
    blinkCount: 0, inBlink: false, holdFrames: 0, nodPhase: 0 as 0 | 1, holdSmile: 0, holdMouth: 0, progress: 0,
  });

  useEffect(() => { return () => { stopListeners(); clearInterval(sessionTimerR.current); clearInterval(challengeTimerR.current); }; }, []);

  const onFaceData = Worklets.createRunOnJS((data: FaceData) => { handleFaceData(data); });

  const onNoFace = Worklets.createRunOnJS(() => {
    setFaceDetected(false);
    if (phaseRef.current === 'LIVENESS_CHECK') {
      livRef.current.earHistory = []; livRef.current.irisHistory = [];
      livRef.current.flowDisp = []; livRef.current.zHistory = [];
      livRef.current.prevFlowPts = null; livRef.current.smoothProgress = 0; livRef.current.livenessScore = 0;
      setLivenessProgress(0); setLivSignals({ ear: 0, iris: 0, flow: 0, z: 0 });
    }
    if (phaseRef.current === 'CHALLENGE' && !lockRef.current) {
      engRef.current.progress = 0; engRef.current.stage = 0; engRef.current.alignFrames = 0;
      engRef.current.baseEAR = 0; engRef.current.baseYaw = 0; engRef.current.basePitch = 0;
      engRef.current.holdFrames = 0; engRef.current.blinkCount = 0; engRef.current.holdSmile = 0;
      engRef.current.holdMouth = 0; engRef.current.nodPhase = 0;
      setChState(p => ({ ...p, progress: 0, feedback: '[ ERR: TARGET LOST ]', liveInfo: '', leftEAR: 0, rightEAR: 0 }));
    }
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    runAtTargetFps(30, () => {
      'worklet';
      const faces = detectFaces(frame);
      if (!faces || faces.length === 0) { onNoFace(); return; }
      let best = faces[0];
      for (let i = 1; i < faces.length; i++) if (faces[i].bounds.width > best.bounds.width) best = faces[i];
      onFaceData(buildFaceData(best, frame.width, frame.height));
    });
  }, [detectFaces, onFaceData, onNoFace]);

  const setPhaseSync = useCallback((p: Phase) => { phaseRef.current = p; setPhase(p); }, []);
  const variance = (arr: number[]) => {
    if (arr.length < 2) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  };

  useEffect(() => {
    (async () => {
      if (hasPermission) {
        if (challengeKeys.length === 0) { setSubmitError('NO PAYLOAD'); setPhaseSync('FAILED'); return; }
        setPhaseSync('READY'); return;
      }
      const ok = await requestPermission();
      if (ok && challengeKeys.length > 0) setPhaseSync('READY'); else router.back();
    })();
  }, [hasPermission, challengeKeys]);

  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setSessTime(rem);
      if (rem === 0) { clearInterval(sessionTimerR.current); setPhaseSync('EXPIRED'); }
    };
    tick(); sessionTimerR.current = setInterval(tick, 1000);
    return () => clearInterval(sessionTimerR.current);
  }, []);

  const handleFaceData = useCallback((f: FaceData) => {
    const p = phaseRef.current;
    if (p !== 'LIVENESS_CHECK' && p !== 'CHALLENGE') return;

    if (!f.detected || f.tooSmall || f.tooBig) {
      setFaceDetected(false);
      if (p === 'LIVENESS_CHECK') {
        livRef.current.earHistory = []; livRef.current.irisHistory = [];
        livRef.current.flowDisp = []; livRef.current.zHistory = [];
        livRef.current.prevFlowPts = null;
        livRef.current.livenessScore = Math.max(0, livRef.current.livenessScore - 10);
        livRef.current.smoothProgress = livRef.current.livenessScore / LIVENESS_SCORE_TARGET;
        setLivenessProgress(livRef.current.smoothProgress);
      }
      if (p === 'CHALLENGE' && !lockRef.current) {
        engRef.current.progress = 0; engRef.current.stage = 0; engRef.current.alignFrames = 0;
        engRef.current.holdFrames = 0; engRef.current.blinkCount = 0; engRef.current.holdSmile = 0;
        engRef.current.holdMouth = 0; engRef.current.nodPhase = 0;
        const fb = f.detected && f.tooSmall ? '[ Z-AXIS: APPROACH ]' : f.detected && f.tooBig ? '[ Z-AXIS: RETRACT ]' : '[ ERR: TARGET LOST ]';
        setChState(s => ({ ...s, progress: 0, feedback: fb, liveInfo: '', leftEAR: 0, rightEAR: 0 }));
      }
      return;
    }
    setFaceDetected(true);

    const lv = livRef.current;
    const avgEAR = (f.leftEAR + f.rightEAR) / 2;
    const avgIris = (f.leftIrisRatio + f.rightIrisRatio) / 2;

    if (f.flowPoints && lv.prevFlowPts) {
      let dist = 0;
      for (let i = 0; i < f.flowPoints.length; i++) {
        const dx = f.flowPoints[i][0] - lv.prevFlowPts[i][0];
        const dy = f.flowPoints[i][1] - lv.prevFlowPts[i][1];
        dist += (dx * dx + dy * dy);
      }
      lv.flowDisp.push(dist);
      if (lv.flowDisp.length > 25) lv.flowDisp.shift();
    }
    lv.prevFlowPts = f.flowPoints;

    lv.earHistory.push(avgEAR); if (lv.earHistory.length > 25) lv.earHistory.shift();
    lv.irisHistory.push(avgIris); if (lv.irisHistory.length > 25) lv.irisHistory.shift();
    lv.zHistory.push(f.zIQR); if (lv.zHistory.length > 25) lv.zHistory.shift();

    if (p === 'LIVENESS_CHECK') {
      const aligned = Math.abs(f.yaw) < ALIGN_YAW_MAX && Math.abs(f.pitch) < ALIGN_PITCH_MAX && Math.abs(f.roll) < ALIGN_ROLL_MAX;
      const earVar = variance(lv.earHistory);
      const irisVar = variance(lv.irisHistory);
      const flowAvg = lv.flowDisp.length > 0 ? lv.flowDisp.reduce((a, b) => a + b, 0) / lv.flowDisp.length : 0;
      const zVar = variance(lv.zHistory);

      setLivSignals({ ear: earVar, iris: irisVar, flow: flowAvg, z: zVar });

      if (!aligned) {
        let msg = '[ ALIGN VECTORS ]';
        if (f.yaw > ALIGN_YAW_MAX) msg = '[ YAW OFFSET: TURN LEFT ]';
        if (f.yaw < -ALIGN_YAW_MAX) msg = '[ YAW OFFSET: TURN RIGHT ]';
        if (f.pitch > ALIGN_PITCH_MAX) msg = '[ PITCH OFFSET: TILT DOWN ]';
        if (f.pitch < -ALIGN_PITCH_MAX) msg = '[ PITCH OFFSET: TILT UP ]';
        setChState(s => ({ ...s, feedback: msg }));
        lv.livenessScore = Math.max(0, lv.livenessScore - 2);
        lv.smoothProgress = lv.livenessScore / LIVENESS_SCORE_TARGET;
        setLivenessProgress(lv.smoothProgress);
        return;
      } else {
        setChState(s => ({ ...s, feedback: '[ CALIBRATING: EXHIBIT MICRO-MOTIONS ]' }));
      }

      if (lv.earHistory.length < 10) return;

      let framePoints = 0;
      if (earVar > MIN_EAR_VARIANCE) framePoints += 25;
      else if (earVar > MIN_EAR_VARIANCE * 0.3) framePoints += 3;
      if (irisVar > MIN_IRIS_JITTER) framePoints += 10;
      else if (irisVar > MIN_IRIS_JITTER * 0.3) framePoints += 2;
      if (flowAvg > MIN_FLOW_AVG) framePoints += 10;
      else if (flowAvg > MIN_FLOW_AVG * 0.3) framePoints += 2;
      if (zVar > MIN_Z_VAR) framePoints += 8;
      else if (zVar > MIN_Z_VAR * 0.3) framePoints += 2;

      if (framePoints > 0) {
        lv.livenessScore = Math.min(LIVENESS_SCORE_TARGET, lv.livenessScore + framePoints);
      } else {
        lv.livenessScore = Math.max(0, lv.livenessScore - 3);
      }

      const targetBar = lv.livenessScore / LIVENESS_SCORE_TARGET;
      lv.smoothProgress += (targetBar - lv.smoothProgress) * 0.3;
      setLivenessProgress(lv.smoothProgress);

      if (lv.smoothProgress >= 0.98 || lv.livenessScore >= LIVENESS_SCORE_TARGET) {
        setPhaseSync('CHALLENGE');
        startChallenge(0);
      }
      else if (lv.earHistory.length === 25 && lv.livenessScore === 0 && !livenessBlocked) {
        setLivenessBlocked(true);
        lv.earHistory = []; lv.irisHistory = []; lv.flowDisp = []; lv.zHistory = []; lv.prevFlowPts = null;
        lv.livenessScore = 0; lv.smoothProgress = 0;
        setLivenessProgress(0);
        vibSound('alert');
        setChState(s => ({ ...s, feedback: '[ CRITICAL: STATIC ENTITY DETECTED ]' }));
        setTimeout(() => setLivenessBlocked(false), 3000);
      }
      return;
    }

    if (lockRef.current) return;
    const e = engRef.current;
    const key = curKeyRef.current;
    const def = DEFS[key];
    if (!def) return;

    if (e.stage === 0) {
      const aligned = Math.abs(f.yaw) < ALIGN_YAW_MAX && Math.abs(f.roll) < ALIGN_ROLL_MAX && Math.abs(f.pitch) < ALIGN_PITCH_MAX;
      if (aligned) {
        e.baseEAR = Math.max(e.baseEAR, avgEAR);
        e.baseYaw += f.yaw; e.basePitch += f.pitch;
        e.alignFrames++;
        if (e.alignFrames >= ALIGN_FRAMES) {
          e.baseYaw /= ALIGN_FRAMES; e.basePitch /= ALIGN_FRAMES;
          e.stage = 1; e.baseIris = avgIris; e.baseNoseY = f.noseTipY; e.progress = 0.05;
          vibSound('beep');
          setChState(s => ({ ...s, status: 'ACTION', progress: 0.05, feedback: `[ ${def.instruction} ]`, liveInfo: `YAW:${e.baseYaw.toFixed(1)}°` }));
        } else {
          setChState(s => ({ ...s, progress: (e.alignFrames / ALIGN_FRAMES) * 0.1, feedback: `[ ACQUIRING BASELINE... (${e.alignFrames}/${ALIGN_FRAMES}) ]`, liveInfo: `YAW:${f.yaw.toFixed(1)}°` }));
        }
      } else {
        e.alignFrames = Math.max(0, e.alignFrames - 1);
        e.baseEAR = 0; e.baseYaw = 0; e.basePitch = 0;
        let msg = '[ ALIGN VECTORS TO CENTER ]';
        if (Math.abs(f.yaw) > ALIGN_YAW_MAX) msg = f.yaw > 0 ? '[ YAW OFFSET: TURN LEFT ]' : '[ YAW OFFSET: TURN RIGHT ]';
        else if (Math.abs(f.pitch) > ALIGN_PITCH_MAX) msg = f.pitch > 0 ? '[ PITCH OFFSET: TILT DOWN ]' : '[ PITCH OFFSET: TILT UP ]';
        setChState(s => ({ ...s, progress: 0, feedback: msg, liveInfo: `YAW:${f.yaw.toFixed(1)}° PITCH:${f.pitch.toFixed(1)}°` }));
      }
      return;
    }

    let passed = false, feedback = `[ ${def.instruction} ]`, liveInfo = '';

    switch (key) {
      case 'BLINK_TWICE': {
        const currentEAR = avgEAR;
        e.baseEAR = Math.max(e.baseEAR, currentEAR);
        const dropThreshold = e.baseEAR * 0.65;
        const recoverThreshold = e.baseEAR * 0.85;
        if (!e.inBlink && currentEAR < dropThreshold) {
          e.inBlink = true;
          feedback = '[ BLINK DETECTED: OPEN EYES ]';
        }
        else if (e.inBlink && currentEAR > recoverThreshold) {
          e.inBlink = false; e.blinkCount++; vibSound('tick');
          feedback = `[ BLINK COUNT: ${e.blinkCount}/2 ]`;
        } else {
          if (e.inBlink) feedback = '[ KEEP OPENING EYES ]';
          else feedback = e.blinkCount === 1 ? '[ EXECUTE SECOND BLINK ]' : '[ AWAITING BLINK PROTOCOL ]';
        }
        e.progress = Math.min(1, e.blinkCount / 2);
        if (e.blinkCount >= 2) { passed = true; feedback = '[ VERIFIED: DOUBLE BLINK ]'; }
        liveInfo = `EAR:${currentEAR.toFixed(3)} BLK:${e.blinkCount}/2`;
        break;
      }
      case 'TURN_HEAD_LEFT':
      case 'TURN_HEAD_RIGHT': {
        const targetYaw = key === 'TURN_HEAD_LEFT' ? 18 : -18;
        const currentYaw = f.yaw;
        const wantPos = key === 'TURN_HEAD_LEFT';
        e.progress = Math.min(1, Math.max(0, wantPos ? (currentYaw / targetYaw) : (currentYaw / targetYaw)));
        liveInfo = `YAW:${currentYaw.toFixed(1)}°`;
        const correct = wantPos ? currentYaw >= targetYaw : currentYaw <= targetYaw;
        const wrong = wantPos ? currentYaw < -10 : currentYaw > 10;
        if (correct) {
          e.holdFrames++;
          if (e.holdFrames >= ACTION_HOLD_FRAMES) { passed = true; feedback = '[ VERIFIED: YAW ROTATION ]'; e.progress = 1; }
          else feedback = `[ STABILIZE... (${e.holdFrames}/${ACTION_HOLD_FRAMES}) ]`;
        } else if (wrong) {
          e.holdFrames = Math.max(0, e.holdFrames - 1);
          feedback = wantPos ? '[ ERR: WRONG DIRECTION. TURN LEFT ]' : '[ ERR: WRONG DIRECTION. TURN RIGHT ]';
        } else {
          e.holdFrames = Math.max(0, e.holdFrames - 1);
          feedback = `[ ${wantPos ? 'ROTATE LEFT' : 'ROTATE RIGHT'}: ${Math.round(e.progress * 100)}% ]`;
        }
        break;
      }
      case 'NOD': {
        if (Math.abs(f.yaw) > 15) { feedback = '[ ERR: YAW DETECTED. KEEP STRAIGHT ]'; break; }
        const currentPitch = f.pitch;
        liveInfo = `PITCH:${currentPitch.toFixed(1)}°`;
        if (e.nodPhase === 0) {
          e.progress = Math.min(0.48, Math.max(0, currentPitch / 12) * 0.48);
          if (currentPitch > 12) { e.nodPhase = 1; e.progress = 0.5; feedback = '[ REVERT PITCH TO CENTER ]'; }
          else feedback = `[ EXECUTE DOWNWARD PITCH: ${Math.round(Math.max(0, currentPitch / 12) * 100)}% ]`;
        } else {
          e.progress = 0.5 + (1 - Math.min(1, Math.max(0, currentPitch / 12))) * 0.5;
          if (currentPitch < 4) { passed = true; feedback = '[ VERIFIED: PITCH NOD ]'; e.progress = 1; }
          else feedback = '[ REVERT TO CENTER ]';
        }
        break;
      }
      case 'SMILE': {
        e.progress = Math.min(1, f.smileScore / SMILE_THRESHOLD);
        if (f.smileScore >= SMILE_THRESHOLD) {
          e.holdSmile++;
          if (e.holdSmile >= SMILE_HOLD) { passed = true; feedback = '[ VERIFIED: EXPRESSION (SMILE) ]'; e.progress = 1; }
          else feedback = `[ STABILIZE... (${e.holdSmile}/${SMILE_HOLD}) ]`;
        } else {
          e.holdSmile = Math.max(0, e.holdSmile - 1);
          feedback = `[ ACTIVATE SMILE ${Math.round(f.smileScore * 100)}% ]`;
        }
        liveInfo = `SML:${Math.round(f.smileScore * 100)}%`;
        break;
      }
      case 'OPEN_MOUTH': {
        e.progress = Math.min(1, f.mouthOpen / MOUTH_OPEN_THRESHOLD);
        if (f.mouthOpen >= MOUTH_OPEN_THRESHOLD) {
          e.holdMouth++;
          if (e.holdMouth >= MOUTH_HOLD) { passed = true; feedback = '[ VERIFIED: EXPRESSION (OPEN) ]'; e.progress = 1; }
          else feedback = `[ STABILIZE... (${e.holdMouth}/${MOUTH_HOLD}) ]`;
        } else {
          e.holdMouth = Math.max(0, e.holdMouth - 1);
          feedback = '[ MAXIMIZE MOUTH APERTURE ]';
        }
        liveInfo = `APT:${(f.mouthOpen * 100).toFixed(1)}%`;
        break;
      }
    }

    setChState(s => ({ ...s, progress: e.progress, feedback, liveInfo, leftEAR: f.leftEAR, rightEAR: f.rightEAR }));
    if (passed && !lockRef.current) {
      lockRef.current = true;
      handlePass(curIdxRef.current, key, e.progress);
    }
  }, [challengeKeys]);

  const startChallenge = useCallback((idx: number) => {
    if (idx >= challengeKeys.length) return;
    const key = challengeKeys[idx];
    const def = DEFS[key];
    if (!def) return;
    engRef.current = {
      stage: 0, alignFrames: 0, baseEAR: 0, baseIris: 0.5, baseNoseY: 0.5, baseYaw: 0, basePitch: 0,
      blinkCount: 0, inBlink: false, holdFrames: 0, nodPhase: 0, holdSmile: 0, holdMouth: 0, progress: 0
    };
    lockRef.current = false;
    curKeyRef.current = key;
    curIdxRef.current = idx;
    setChState(s => ({ ...s, idx, key, status: 'ALIGNING', progress: 0, timeLeft: def.duration, feedback: '[ AWAITING ALIGNMENT ]', liveInfo: '' }));
    clearInterval(challengeTimerR.current);
    let rem = def.duration;
    challengeTimerR.current = setInterval(() => {
      rem--;
      setChState(s => ({ ...s, timeLeft: rem }));
      if (rem <= 0) {
        clearInterval(challengeTimerR.current);
        if (lockRef.current) return;
        lockRef.current = true;
        const prog = engRef.current.progress;
        if (prog >= 0.5) { handlePass(idx, key, prog); }
        else {
          vibSound('fail');
          setChState(s => ({ ...s, status: 'FAILED_RETRY', feedback: '[ TIMEOUT: RESTARTING SEQUENCE ]', progress: 0 }));
          engRef.current.progress = 0;
          setTimeout(() => startChallenge(idx), 2000);
        }
      }
    }, 1000);
  }, [challengeKeys]);

  const handlePass = useCallback((idx: number, key: string, score: number) => {
    clearInterval(challengeTimerR.current);
    const def = DEFS[key];
    if (def) flashTrig.current(def.color);
    vibSound('pass');
    setShowBurst(true); setTimeout(() => setShowBurst(false), 700);
    animDrawer();
    scoresRef.current[key] = score;
    completedRef.current = [...completedRef.current, key];
    setCompleted([...completedRef.current]);
    setChState(s => ({ ...s, status: 'PASSED', progress: 1, feedback: '[ SEQUENCE ACCEPTED ]', liveInfo: '' }));
    setTimeout(() => {
      const next = idx + 1;
      if (next < challengeKeys.length) startChallenge(next);
      else doCaptureAndSubmit();
    }, 1500);
  }, [challengeKeys]);

  // const doCaptureAndSubmit=useCallback(async()=>{
  //   if(captureRef.current) return;
  //   captureRef.current=true;
  //   setPhaseSync('CAPTURING');
  //   if(!cameraRef.current){setSubmitError('HW_ERR: CAMERA_OFFLINE');setPhaseSync('FAILED');return;}
  //   try{
  //     const photo=await cameraRef.current.takePhoto({flash:'off'});
  //     if(!photo?.path) throw new Error('HW_ERR: NULL_BUFFER');
  //     setPhaseSync('SUBMITTING');
  //     const uri=Platform.OS==='android'?`file://${photo.path}`:photo.path;
  //     const m=await ImageManipulator.manipulateAsync(uri,[{resize:{width:640}}],
  //       {compress:0.85,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  //     const sv=Object.values(scoresRef.current);
  //     const composite=sv.length?sv.reduce((a,b)=>a+b,0)/sv.length:0.8;
  //     const res=await AttendanceAPI.verify({
  //       session_id:params.session_id,
  //       face_frame_base64:m.base64!,
  //       liveness_result:{challenges_completed:completedRef.current,scores:scoresRef.current,
  //         composite_score:composite},
  //     });
  //     const status=res?.data?.data?.verification_status??'FAILED';
  //     if(status==='VERIFIED')        setPhaseSync('SUCCESS');
  //     else if(status==='SUSPICIOUS') setPhaseSync('SUSPICIOUS');
  //     else{setSubmitError(res?.data?.data?.message||'AUTH_DECLINED');setPhaseSync('FAILED');}
  //   }catch(err:any){
  //     setSubmitError(err?.response?.data?.error||err?.message||'SYS_ERR: FATAL');
  //     setPhaseSync('FAILED');
  //   }
  // },[params.session_id]);

  const doCaptureAndSubmit = useCallback(async () => {
    if (captureRef.current) return;
    captureRef.current = true;
    setPhaseSync('CAPTURING');
    if (!cameraRef.current) { setSubmitError('HW_ERR: CAMERA_OFFLINE'); setPhaseSync('FAILED'); return; }
    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      if (!photo?.path) throw new Error('HW_ERR: NULL_BUFFER');
      setPhaseSync('SUBMITTING');

      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      // ─────────────────────────────────────────────────────────────
      // THE PRODUCTION EXIF BYPASS & AFFINE TRANSFORMATION ENGINE
      // ─────────────────────────────────────────────────────────────
      // const actions: any[] = [];

      // if (Platform.OS === 'android') {
      //   // 1. Dynamic Hardware Sensor Analysis
      //   // Mobile camera sensors are physical matrices mounted sideways. 
      //   // We dynamically read the sensor's orientation flag and apply the inverse rotation.
      //   const sensorOrientation = photo.orientation;

      //   if (sensorOrientation === 'landscape-right') {
      //     actions.push({ rotate: 90 });
      //   } else if (sensorOrientation === 'landscape-left') {
      //     actions.push({ rotate: 270 });
      //   } else if (sensorOrientation === 'portrait-upside-down') {
      //     actions.push({ rotate: 180 });
      //   } else if (!sensorOrientation && photo.width > photo.height) {
      //     // Fallback geometric constraint: If EXIF is stripped but the matrix is clearly transposed
      //     actions.push({ rotate: 270 });
      //   }

      //   // 2. Geometric Mirror Correction
      //   // Front cameras act as mirrors. InsightFace embeddings require true spatial alignment.
      //   actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      // }

      // // 3. Dimensionality Reduction (Maintain aspect ratio, compress efficiently)
      // actions.push({ resize: { width: 640 } });

      // const m = await ImageManipulator.manipulateAsync(
      //   uri,
      //   actions,
      //   { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      // );
      // ─────────────────────────────────────────────────────────────
      // THE PRODUCTION EXIF BYPASS & AFFINE TRANSFORMATION ENGINE
      // ─────────────────────────────────────────────────────────────
      const actions: any[] = [];

      if (Platform.OS === 'android') {
        // 1. Dynamic Hardware Sensor Analysis (Fixes the sideways bug)
        const sensorOrientation = photo.orientation;

        if (sensorOrientation === 'landscape-right') {
          actions.push({ rotate: 90 });
        } else if (sensorOrientation === 'landscape-left') {
          actions.push({ rotate: 270 });
        } else if (sensorOrientation === 'portrait-upside-down') {
          actions.push({ rotate: 180 });
        } else if (!sensorOrientation && photo.width > photo.height) {
          actions.push({ rotate: 270 });
        }

        // 2. Geometric Mirror Correction (Front camera is a mirror)
        actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      }

      // 🛑 NO CROPPING: We must preserve the outer matrix for Scene Consensus!

      // 3. Dimensionality Reduction (Bumped to 800px to maintain face detail within the wider scene)
      actions.push({ resize: { width: 800 } });

      const m = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      const sv = Object.values(scoresRef.current);
      const composite = sv.length ? sv.reduce((a, b) => a + b, 0) / sv.length : 0.8;

      const res = await AttendanceAPI.verify({
        session_id: params.session_id,
        face_frame_base64: m.base64!,
        liveness_result: {
          challenges_completed: completedRef.current,
          scores: scoresRef.current,
          composite_score: composite
        },
      });

      const status = res?.data?.data?.verification_status ?? 'FAILED';
      if (status === 'VERIFIED') setPhaseSync('SUCCESS');
      else if (status === 'SUSPICIOUS') setPhaseSync('SUSPICIOUS');
      else { setSubmitError(res?.data?.data?.message || 'AUTH_DECLINED'); setPhaseSync('FAILED'); }

    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || err?.message || 'SYS_ERR: FATAL');
      setPhaseSync('FAILED');
    }
  }, [params.session_id]);

  function beginVerification() {
    completedRef.current = []; scoresRef.current = {}; captureRef.current = false;
    setCompleted([]); setSubmitError('');
    const lv = livRef.current;
    lv.earHistory = []; lv.irisHistory = []; lv.flowDisp = []; lv.zHistory = []; lv.prevFlowPts = null;
    lv.smoothProgress = 0; lv.livenessScore = 0;
    setLivenessProgress(0); setLivenessBlocked(false); setLivSignals({ ear: 0, iris: 0, flow: 0, z: 0 });
    setPhaseSync('LIVENESS_CHECK');
  }

  function retryAll() {
    clearInterval(challengeTimerR.current);
    completedRef.current = []; scoresRef.current = {}; captureRef.current = false;
    setCompleted([]); setSubmitError('');
    setPhaseSync('READY');
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const urgent = sessTimeLeft > 0 && sessTimeLeft <= 60;
  const curDef = DEFS[chState.key] || DEFS['BLINK_TWICE'];
  const oColor = livenessBlocked ? C.red : chState.status === 'PASSED' ? C.green : curDef?.color || C.cyan;
  const livColor = C.cyan;
  const active = phase === 'LIVENESS_CHECK' || phase === 'CHALLENGE';
  const allPass = faceDetected && !livenessBlocked && (phase === 'LIVENESS_CHECK' ? livenessProgress >= 0.95 : chState.progress >= 1);
  const isAction = chState.status === 'ACTION';
  const isLiveness = phase === 'LIVENESS_CHECK';
  const chipColor = isLiveness ? livColor : oColor;

  const leftChips = isLiveness
    ? [
      { label: 'EAR VAR', value: faceDetected ? livSignals.ear : 0, target: MIN_EAR_VARIANCE, passed: faceDetected && livSignals.ear >= MIN_EAR_VARIANCE, displayVal: faceDetected ? `${(livSignals.ear * 1000).toFixed(2)}` : '0.00' },
      { label: 'EYE JIT', value: faceDetected ? livSignals.iris : 0, target: MIN_IRIS_JITTER, passed: faceDetected && livSignals.iris >= MIN_IRIS_JITTER, displayVal: faceDetected ? `${(livSignals.iris * 1000).toFixed(2)}` : '0.00' },
    ]
    : [
      { label: 'EAR', value: faceDetected ? ((chState.leftEAR ?? 0) + (chState.rightEAR ?? 0)) / 2 || 0 : 0, target: 0.25, passed: faceDetected && isAction, displayVal: faceDetected && chState.liveInfo.includes('EAR:') ? chState.liveInfo.split('EAR:')[1]?.split(' ')[0] ?? '–' : '–' },
      { label: 'PROG', value: faceDetected ? chState.progress : 0, target: 0.5, passed: faceDetected && chState.progress >= 0.5, displayVal: faceDetected ? `${Math.round(chState.progress * 100)}%` : '0%' },
    ];

  const rightChips = isLiveness
    ? [
      { label: 'FLOW', value: faceDetected ? livSignals.flow : 0, target: MIN_FLOW_AVG, passed: faceDetected && livSignals.flow >= MIN_FLOW_AVG, displayVal: faceDetected ? `${(livSignals.flow * 1000).toFixed(2)}` : '0.00' },
      { label: 'DEPTH', value: faceDetected ? livSignals.z : 0, target: MIN_Z_VAR, passed: faceDetected && livSignals.z >= MIN_Z_VAR, displayVal: faceDetected ? `${(livSignals.z * 100000).toFixed(1)}` : '0.00' },
    ]
    : [
      { label: 'POSE', value: faceDetected ? (isAction ? 1 : 0) : 0, target: 0.5, passed: faceDetected && (isAction || chState.status === 'PASSED'), displayVal: faceDetected ? (chState.status === 'ALIGNING' ? 'ALIGN' : isAction ? 'READY' : '–') : '–' },
      { label: 'TIME', value: Math.max(0, ((curDef?.duration || 10) - chState.timeLeft) / (curDef?.duration || 10)), target: 0.5, passed: chState.status === 'PASSED', displayVal: `${chState.timeLeft}s` },
    ];

  if (phase === 'EXPIRED') return <ResultScreen icon="⏱" title="SYS_TIMEOUT" sub="AUTH WINDOW CLOSED" color={C.yellow} onHome />;
  if (phase === 'SUSPICIOUS') return <ResultScreen icon="⚠" title="SYS_REVIEW" sub="MANUAL CLEARANCE REQUIRED" color={C.yellow} onHome />;
  if (phase === 'FAILED') return <ResultScreen icon="✕" title="SYS_FAILED" sub={submitError || 'VERIFICATION ABORTED'} color={C.red} onRetry={retryAll} onHome />;
  if (phase === 'SUCCESS') return (
    <View style={[tc.fill, { backgroundColor: C.card }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.card} />
      <SuccessView courseName={params.course_name} profName={params.professor_name} challenges={completedList.length} />
    </View>
  );
  if (!device) return <View style={tc.fill}><Text style={{ color: C.red, fontFamily: FONTS }}>HW_ERR: NO SENSOR</Text></View>;

  return (
    <View style={tc.fill}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={['READY', 'LIVENESS_CHECK', 'CHALLENGE', 'CAPTURING'].includes(phase)}
        frameProcessor={frameProcessor}
        photo={true}
        enableFpsGraph={false}
        photoQualityBalance='quality'
      />

      <GridBackground />
      <SideDataStream />
      <SideDataStream right />

      {/* Floating HUD chips */}
      <View style={[StyleSheet.absoluteFill, { paddingTop: OVAL_TOP, paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between' }]} pointerEvents="none">
        <View style={{ width: 92 }}>
          <TelemetryData />
          <View style={{ height: 14 }} />
          {leftChips.map((m, i) => (<HUDChip key={i} {...m} color={chipColor} alignLeft />))}
        </View>
        <View style={{ width: 92, alignItems: 'flex-end' }}>
          <Text style={[tc.matrix, { textAlign: 'right', color: C.accent2, letterSpacing: 1 }]}>SYS_OP_NORM</Text>
          <Text style={[tc.matrix, { textAlign: 'right', color: C.teal, marginTop: 2 }]}>BIOM_SCAN_V9</Text>
          <View style={{ height: 14 }} />
          {rightChips.map((m, i) => (<HUDChip key={i} {...m} color={chipColor} />))}
        </View>
      </View>

      <View style={[tc.ovalZone, { top: OVAL_TOP, left: (SW - OVAL_W) / 2 }]} pointerEvents="none">
        <TargetingReticle color={chipColor} detected={faceDetected} progress={isLiveness ? livenessProgress : chState.progress} allPass={allPass} />
        <ScanSweep color={chipColor} active={faceDetected && !allPass && !livenessBlocked} />
        <Crosshair color={chipColor} visible={allPass} />
        <CaptureBurst visible={showBurst} color={oColor} />

        <View style={{ position: 'absolute', bottom: -200, width: SW - 32, alignItems: 'center' }}>
          <GuidanceOverlay
            feedback={livenessBlocked ? '[ CRITICAL: STATIC ENTITY ]' : chState.feedback}
            color={livenessBlocked ? C.red : (faceDetected ? (allPass ? C.green : chipColor) : C.orange)}
            alert={livenessBlocked || (!faceDetected && active) || chState.feedback.includes('OFFSET') || chState.feedback.includes('ERR')}
          />
        </View>
      </View>

      {(phase === 'CAPTURING' || phase === 'SUBMITTING') && (
        <View style={tc.procOverlay}>
          <View style={tc.procBox}>
            {/* Animated ring behind spinner */}
            <View style={tc.procRing}>
              <ActivityIndicator size="large" color={C.cyan} />
            </View>
            <Text style={tc.procTitle}>{phase === 'CAPTURING' ? 'ACQUIRING BIOMETRICS' : 'VERIFYING SIGNATURE'}</Text>
            <View style={tc.procDivider} />
            <Text style={tc.procSub}>MAINTAIN POSITION · DO NOT MOVE</Text>
            <View style={{ flexDirection: 'row', marginTop: 20 }}>
              {[0, 1, 2, 3].map(i => <AnimDot key={i} delay={i * 180} color={C.cyan} />)}
            </View>
          </View>
        </View>
      )}

      <FlashOverlay trigRef={flashTrig} />

      <SafeAreaView style={tc.safe} pointerEvents={['CAPTURING', 'SUBMITTING'].includes(phase) ? 'none' : 'box-none'}>

        {/* Top bar */}
        <View style={tc.topBar}>
          <TouchableOpacity style={tc.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={tc.backTxt}>ABORT</Text>
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            {/* Decorative top accent */}
            <View style={tc.titleAccentRow}>
              <View style={tc.titleAccentLine} />
              <View style={tc.titleAccentDot} />
              <View style={tc.titleAccentLine} />
            </View>
            <Text style={tc.topTitle} numberOfLines={1}>{params.course_name || 'SECURE_AUTH'}</Text>
            <Text style={[tc.topSub, { color: chipColor }]}>
              {phase === 'CHALLENGE' ? `SEQ ${completedList.length}/${challengeKeys.length} · BIOMETRIC LOCK` : 'SYSTEM ONLINE'}
            </Text>
          </View>

          <View style={[tc.timerPill, urgent && tc.timerUrgent]}>
            {urgent && <View style={tc.timerDot} />}
            <Text style={[tc.timerTxt, { color: urgent ? C.red : C.cyan }]}>{fmt(sessTimeLeft)}</Text>
          </View>
        </View>

        {/* Sequence progress dots */}
        {(phase === 'CHALLENGE' || phase === 'LIVENESS_CHECK') && (
          <View style={tc.seqDotsRow}>
            {challengeKeys.map((k, i) => {
              const done = completedList.includes(k);
              const active = i === chState.idx && phase === 'CHALLENGE';
              const def = DEFS[k] || DEFS['BLINK_TWICE'];
              return (
                <View key={i} style={[tc.seqDot, {
                  backgroundColor: done ? def.color : active ? def.color + '44' : C.dimmer,
                  borderColor: done || active ? def.color : C.dimmer,
                  width: active ? 28 : 8,
                }]} />
              );
            })}
          </View>
        )}

        <View style={{ flex: 1 }} />

        {/* READY console */}
        {phase === 'READY' && (
          <View style={tc.bottomConsole}>
            <View style={tc.consoleHeader2Row}>
              <View style={tc.consoleLine} />
              <Text style={[tc.consoleHeader, { color: C.cyan }]}>BIOMETRIC_HANDSHAKE</Text>
              <View style={tc.consoleLine} />
            </View>
            <Text style={[tc.consoleBody, { color: C.dim, textAlign: 'center', marginBottom: 4 }]}>
              {challengeKeys.length} CHALLENGE SEQUENCES LOADED
            </Text>
            <View style={tc.seqRow}>
              {challengeKeys.map((k, i) => {
                const d = DEFS[k] || DEFS['BLINK_TWICE'];
                return (
                  <View key={i} style={[tc.seqItem, { borderColor: d.color + '66', backgroundColor: d.color + '0D' }]}>
                    {/* Top accent */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: d.color }} />
                    <Text style={{ fontSize: 18, color: d.color, marginBottom: 5 }}>{d.icon}</Text>
                    <Text style={[tc.seqLabel, { color: d.color }]}>{d.label}</Text>
                    <Text style={{ fontFamily: FONTS, fontSize: 7, color: d.color + '77', marginTop: 2 }}>{d.hint}</Text>
                  </View>
                );
              })}
            </View>
            <TouchableOpacity style={tc.execBtn} onPress={beginVerification} activeOpacity={0.85}>
              <View style={tc.execBtnInner}>
                <Text style={tc.execTxt}>EXECUTE SEQUENCE</Text>
                <Text style={{ fontFamily: FONTS, fontSize: 8, color: C.cyan + '77', marginTop: 3, letterSpacing: 2 }}>TAP TO INITIALIZE</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ACTIVE console */}
        {(phase === 'LIVENESS_CHECK' || phase === 'CHALLENGE') && (
          <Animated.View style={[tc.bottomConsole, { opacity: drawerFade, transform: [{ translateY: drawerSlide }] }]}>
            {/* Console top accent */}
            <View style={[tc.consoleTopAccent, { backgroundColor: chipColor }]} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[tc.consolePulse, { backgroundColor: chipColor }]} />
                <Text style={[tc.consoleHeader, { color: chipColor, marginBottom: 0 }]}>
                  {isLiveness ? 'LIVENESS_ANALYSIS' : `CHALLENGE ${chState.idx + 1}/${challengeKeys.length}`}
                </Text>
              </View>
              <Text style={[tc.consoleHeader, { color: chipColor, marginBottom: 0, fontSize: 13 }]}>
                {isLiveness ? `${(livenessProgress * 100).toFixed(0)}%` : `${(chState.progress * 100).toFixed(0)}%`}
              </Text>
            </View>

            {/* Segmented progress bar */}
            <View style={tc.progressBarOuter}>
              {[...Array(20)].map((_, i) => {
                const prog = isLiveness ? livenessProgress : chState.progress;
                const filled = i / 20 < prog;
                return (
                  <View key={i} style={[tc.progressSeg, {
                    backgroundColor: filled ? chipColor : chipColor + '18',
                    shadowColor: filled ? chipColor : 'transparent',
                    shadowRadius: filled ? 4 : 0,
                    shadowOpacity: filled ? 0.8 : 0,
                  }]} />
                );
              })}
            </View>

            <Text style={[tc.consoleBody, { color: C.white, marginBottom: 2 }]}>
              ▸ {isLiveness ? 'LIVENESS CONFIRMATION PENDING' : curDef?.instruction}
            </Text>
            <Text style={[tc.consoleBody, { color: C.dimmer, marginBottom: 0 }]}>
              ▸ {isLiveness ? 'REMAIN CENTERED IN FRAME' : curDef?.hint}
            </Text>

            {phase === 'CHALLENGE' && (
              <View style={[tc.statusRow, {
                borderColor:
                  chState.status === 'PASSED' ? C.green : chState.timeLeft <= 3 ? C.red : oColor
              }]}>
                <View style={[tc.statusAccent, {
                  backgroundColor:
                    chState.status === 'PASSED' ? C.green : chState.timeLeft <= 3 ? C.red : oColor
                }]} />
                <Text style={[tc.statusTxt, {
                  color:
                    chState.status === 'PASSED' ? C.green : chState.timeLeft <= 3 ? C.red : oColor
                }]}>
                  {chState.status === 'PASSED' ? '● VERIFIED' :
                    chState.status === 'ALIGNING' ? '◌ ALIGNING' :
                      chState.status === 'FAILED_RETRY' ? '✕ RESTARTING' :
                        `◷ T−${chState.timeLeft}s`}
                </Text>
              </View>
            )}
          </Animated.View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUCCESS & RESULT SCREENS
// ═══════════════════════════════════════════════════════════════
function SuccessView({ courseName, profName, challenges }: { courseName?: string; profName?: string; challenges: number }) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.timing(ringAnim, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: true })
    ).start();
    vibSound('pass');
  }, []);
  const spin = ringAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale }], opacity: op, padding: 32, backgroundColor: C.card }}>
      <GridBackground />

      <View style={sr.ringWrap}>
        <Animated.View style={[sr.spinRing, { transform: [{ rotate: spin }] }]} />
        <View style={sr.ring}>
          <Text style={{ fontSize: 32, color: C.green }}>✓</Text>
        </View>
      </View>

      <Text style={[sr.title, { color: C.green, marginTop: 28, letterSpacing: 4 }]}>AUTH_SUCCESS</Text>
      <View style={sr.titleUnderline} />

      <Text style={sr.sub}>
        ATTENDANCE RECORDED FOR{'\n'}
        <Text style={{ color: C.white, fontWeight: '800', letterSpacing: 1 }}>{courseName || 'TARGET SESSION'}</Text>
      </Text>

      <View style={sr.meta}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Text style={sr.metaLabel}>CHALLENGES</Text>
          <Text style={[sr.metaVal, { color: C.green }]}>{challenges} PASSED</Text>
        </View>
        <View style={sr.metaDivider} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Text style={sr.metaLabel}>TIMESTAMP</Text>
          <Text style={sr.metaVal}>{new Date().toISOString().split('T')[1].substring(0, 8)} UTC</Text>
        </View>
        <View style={sr.metaDivider} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
          <Text style={sr.metaLabel}>STATUS</Text>
          <Text style={[sr.metaVal, { color: C.green }]}>BIOMETRIC MATCH</Text>
        </View>
      </View>

      <TouchableOpacity style={sr.btn} onPress={() => router.replace('/(tabs)/home')} activeOpacity={0.85}>
        <Text style={sr.btnTxt}>TERMINATE SESSION</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ResultScreen({ icon, title, sub, color, onRetry, onHome }: {
  icon: string; title: string; sub: string; color: string; onRetry?: () => void; onHome?: boolean;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 50, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <View style={[tc.fill, { backgroundColor: C.card, justifyContent: 'center', alignItems: 'center', padding: 32 }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.card} />
      <GridBackground />
      <Animated.View style={{ alignItems: 'center', transform: [{ scale }], opacity: op }}>
        <View style={[sr.termRing, { borderColor: color, shadowColor: color }]}>
          <Text style={{ fontSize: 28, color }}>{icon}</Text>
        </View>
        <Text style={[sr.title, { color, marginTop: 22, letterSpacing: 4 }]}>{title}</Text>
        <View style={[sr.titleUnderline, { backgroundColor: color }]} />
        <Text style={sr.sub}>{sub}</Text>
        {onRetry && (
          <TouchableOpacity style={[sr.btn, { borderColor: color, backgroundColor: color + '11' }]} onPress={onRetry} activeOpacity={0.85}>
            <Text style={[sr.btnTxt, { color }]}>RETRY SEQUENCE</Text>
          </TouchableOpacity>
        )}
        {onHome && (
          <TouchableOpacity style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24 }} onPress={() => router.replace('/(tabs)/home')}>
            <Text style={{ color: C.dimmer, fontFamily: FONTS, fontSize: 9, letterSpacing: 2 }}>EXIT TO MAIN</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const tc = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  ovalZone: { position: 'absolute', width: OVAL_W, height: OVAL_H, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  matrix: { fontFamily: FONTS, fontSize: 7.5, color: C.dimmer, lineHeight: 12, letterSpacing: 0.5 },

  guideBox: {
    borderWidth: 1, paddingHorizontal: 18, paddingVertical: 13,
    borderLeftWidth: 3, borderRightWidth: 3, width: '100%',
    shadowOpacity: 0.7, shadowRadius: 14, elevation: 8,
    position: 'relative', overflow: 'hidden',
  },
  guideTag: { fontFamily: FONTS, fontSize: 7, letterSpacing: 2, marginBottom: 5, textTransform: 'uppercase' },
  guideTxt: { fontFamily: FONTS, fontSize: 11.5, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1.5 },

  procOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,5,15,0.93)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  procBox: { borderWidth: 1, borderColor: C.cyan + '55', padding: 36, alignItems: 'center', backgroundColor: 'rgba(0,240,255,0.04)', minWidth: 260 },
  procRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderColor: C.cyan + '33', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  procTitle: { color: C.cyan, fontFamily: FONTS, fontSize: 13, letterSpacing: 2.5, marginTop: 20, fontWeight: '800' },
  procDivider: { width: 60, height: 1, backgroundColor: C.cyan + '44', marginTop: 12, marginBottom: 8 },
  procSub: { color: C.dim, fontFamily: FONTS, fontSize: 9, letterSpacing: 1.5 },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: C.dimmer, backgroundColor: 'rgba(0,0,0,0.6)' },
  backTxt: { color: C.dim, fontFamily: FONTS, fontSize: 9, letterSpacing: 1.5 },
  titleAccentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  titleAccentLine: { flex: 1, height: 1, backgroundColor: C.cyan + '44', maxWidth: 20 },
  titleAccentDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.cyan },
  topTitle: { color: C.white, fontFamily: FONTS, fontSize: 11.5, letterSpacing: 2.5, maxWidth: 160, textAlign: 'center', fontWeight: '800' },
  topSub: { fontFamily: FONTS, fontSize: 8, letterSpacing: 1.5, marginTop: 3 },
  timerPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: C.cyan + '55', backgroundColor: 'rgba(0,0,0,0.7)' },
  timerUrgent: { borderColor: C.red + 'AA', backgroundColor: 'rgba(255,20,60,0.08)' },
  timerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: C.red },
  timerTxt: { color: C.cyan, fontFamily: FONTS, fontSize: 11, fontWeight: '900', letterSpacing: 1 },

  seqDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, paddingHorizontal: 20 },
  seqDot: { height: 4, borderRadius: 2, borderWidth: 1, /*transition: 'width 0.3s' as any*/ },

  bottomConsole: { backgroundColor: C.panelBg, borderTopWidth: 1, borderColor: C.cyan + '33', padding: 20, paddingBottom: 28, position: 'relative', overflow: 'hidden' },
  consoleTopAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 },
  consolePulse: { width: 6, height: 6, borderRadius: 3 },
  consoleHeader2Row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, justifyContent: 'center' },
  consoleLine: { flex: 1, height: 1, backgroundColor: C.cyan + '55' },
  consoleHeader: { fontFamily: FONTS, fontSize: 10, letterSpacing: 1.5, marginBottom: 0, fontWeight: '800', color: C.cyan },
  consoleBody: { fontFamily: FONTS, fontSize: 10.5, color: C.dim, marginBottom: 5, lineHeight: 16 },

  progressBarOuter: { flexDirection: 'row', gap: 2, marginBottom: 14, height: 5 },
  progressSeg: { flex: 1, height: '100%', borderRadius: 2 },

  seqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14, justifyContent: 'center' },
  seqItem: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 12, alignItems: 'center', minWidth: 86, position: 'relative', overflow: 'hidden' },
  seqLabel: { fontFamily: FONTS, fontSize: 8.5, marginTop: 4, fontWeight: '800', letterSpacing: 0.5 },

  execBtn: { borderWidth: 1, borderColor: C.cyan, backgroundColor: C.cyan + '0F', paddingVertical: 18, alignItems: 'center', marginTop: 6 },
  execBtnInner: { alignItems: 'center' },
  execTxt: { color: C.cyan, fontFamily: FONTS, fontSize: 11.5, letterSpacing: 3, fontWeight: 'bold' },

  statusRow: { borderWidth: 1, paddingVertical: 10, alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row', justifyContent: 'center', gap: 10, position: 'relative' },
  statusAccent: { width: 3, height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0 },
  statusTxt: { fontFamily: FONTS, fontSize: 11, letterSpacing: 1.5, fontWeight: 'bold' },
});

const sr = StyleSheet.create({
  ringWrap: { position: 'relative', width: 110, height: 110, justifyContent: 'center', alignItems: 'center' },
  spinRing: { position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 1.5, borderColor: 'transparent', borderTopColor: C.green + 'BB', borderRightColor: C.green + '44', borderStyle: 'dashed' },
  ring: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: C.green, shadowColor: C.green, shadowRadius: 24, shadowOpacity: 0.6, justifyContent: 'center', alignItems: 'center', backgroundColor: C.green + '0D' },
  termRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: 'center', alignItems: 'center', shadowRadius: 24, shadowOpacity: 0.6, backgroundColor: 'rgba(0,0,0,0.3)' },
  title: { fontFamily: FONTS, fontSize: 17, letterSpacing: 3, marginBottom: 8, textAlign: 'center', fontWeight: '900' },
  titleUnderline: { width: 60, height: 1.5, backgroundColor: C.green, marginBottom: 18, alignSelf: 'center' },
  sub: { fontFamily: FONTS, color: C.dim, fontSize: 10.5, textAlign: 'center', lineHeight: 19, marginBottom: 24, letterSpacing: 0.5 },
  meta: { width: '100%', borderWidth: 1, borderColor: C.green + '33', padding: 16, gap: 12, backgroundColor: C.green + '07', marginBottom: 8 },
  metaLabel: { fontFamily: FONTS, color: C.dimmer, fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase' },
  metaVal: { fontFamily: FONTS, color: C.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  metaDivider: { width: '100%', height: 1, backgroundColor: C.green + '20' },
  btn: { borderWidth: 1, borderColor: C.green, backgroundColor: C.green + '0F', paddingVertical: 16, width: '100%', alignItems: 'center', marginTop: 20 },
  btnTxt: { fontFamily: FONTS, fontSize: 11, letterSpacing: 3, color: C.green, fontWeight: 'bold' },
});