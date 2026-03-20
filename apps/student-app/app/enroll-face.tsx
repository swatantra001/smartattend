/**
 * enroll-face.tsx — IRON MAN HUD BIOMETRIC ENROLLMENT
 * ══════════════════════════════════════════════════════════
 * Version: 7.0 — SCI-FI HUD Edition
 *
 * ⚡ ZERO logic changes from Version 5.0
 *
 * 🎨 KEY CHANGES from v6:
 *   - Camera is FULL SCREEN — face 100% visible
 *   - HUD chips float INSIDE the oval on left/right sides
 *     connected by thin scan lines (Iron Man / JARVIS style)
 *   - Bottom bar is COMPACT — only step instruction + hint
 *   - Scan sweep line animates across face
 *   - Rotating dual holographic arcs
 *   - Corner bracket reticle with blinking dots
 *   - Crosshair appears when locked on
 *   - Stability gauge floats BELOW the oval
 *   - Directional bounce arrows ABOVE oval
 *   - Vibration patterns as "sound" feedback
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, ScrollView, Dimensions,
  Animated, Vibration, Platform, Easing
} from 'react-native';
import {
  Camera, useCameraPermission, useCameraDevice,
  useFrameProcessor, runAtTargetFps,
} from 'react-native-vision-camera';
import { useFaceDetector, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';
import { useSharedValue, Worklets } from 'react-native-worklets-core';
import * as ImageManipulator from 'expo-image-manipulator';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StudentAPI } from '../src/services/api';
import { useAuthStore } from '../src/store/auth.store';
import { COLORS, SPACING, RADIUS } from '../src/constants';

// ════════════════════════════════════════════════════════════════════════════════
// 1. CONFIG  (logic UNCHANGED from v5)
// ════════════════════════════════════════════════════════════════════════════════

const { width: W, height: H } = Dimensions.get('window');

const OVAL_W = W * 0.80;
const OVAL_H = OVAL_W * 1.28;
// Position oval so there's room for the compact bottom bar
const OVAL_TOP = H * 0.13;       // how far from top of screen

const THRESHOLDS = {
  FACE_AREA_MIN: 0.12,
  FACE_AREA_MAX: 0.65,
  EAR_MIN: 0.20,
  ROLL_MAX: 15,
  STABLE_FRAMES_REQD: 10,
  PHANTOM_FACE_FRAMES: 4,
  MANUAL_BTN_DELAY_MS: 6000,
};

interface EnrollStep {
  id: number; label: string; icon: string; instruction: string; hint: string;
  yawMin: number | null; yawMax: number | null;
  pitchMin: number | null; pitchMax: number | null;
  smileMin: number | null;
  color: string;
}
const STEPS: EnrollStep[] = [
  {
    id: 0, label: 'FORWARD', icon: '😐', instruction: 'Look straight at the camera', hint: 'Head level · eyes open · neutral',
    yawMin: -12, yawMax: 12, pitchMin: -12, pitchMax: 12, smileMin: null, color: '#00FFEA'
  },
  {
    id: 1, label: 'TURN LEFT', icon: '↖️', instruction: 'Turn your head to YOUR LEFT', hint: '15–25° — not too far',
    yawMin: 12, yawMax: 35, pitchMin: -15, pitchMax: 15, smileMin: null, color: '#FFD200'
  },
  {
    id: 2, label: 'TURN RIGHT', icon: '↗️', instruction: 'Turn your head to YOUR RIGHT', hint: '15–25° — not too far',
    yawMin: -35, yawMax: -12, pitchMin: -15, pitchMax: 15, smileMin: null, color: '#FFD200'
  },
  {
    id: 3, label: 'LOOK UP', icon: '☝️', instruction: 'Tilt head slightly UPWARD', hint: 'A little — keep eyes visible',
    yawMin: -15, yawMax: 15, pitchMin: 10, pitchMax: 30, smileMin: null, color: '#BF5FFF'
  },
  {
    id: 4, label: 'SMILE', icon: '🙂', instruction: 'Give a natural smile', hint: 'Head level · keep it natural',
    yawMin: -15, yawMax: 15, pitchMin: -15, pitchMax: 15, smileMin: 0.45, color: '#FF5F3F'
  },
];

interface FaceMetrics {
  detected: boolean;
  yaw: number; pitch: number; roll: number;
  ear: number; smile: number; faceArea: number;
}

// Sound-via-vibration feedback
function vibSound(type: 'tick' | 'lock' | 'capture') {
  if (type === 'tick') Vibration.vibrate(8);
  if (type === 'lock') Vibration.vibrate([0, 12, 8, 12]);
  if (type === 'capture') Vibration.vibrate([0, 40, 30, 80]);
}

// ════════════════════════════════════════════════════════════════════════════════
// 2A.  HUD DATA CHIP  — floats inside oval, shows one metric
// ════════════════════════════════════════════════════════════════════════════════

interface HUDChipProps {
  label: string; value: number; target: number;
  passed: boolean; color: string; displayVal: string;
}

const HUDChip = React.memo(({ label, value, target, passed, color, displayVal }: HUDChipProps) => {
  const barAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(barAnim, { toValue: Math.min(1, Math.max(0, value)), friction: 8, tension: 60, useNativeDriver: false }).start();
  }, [value]);

  useEffect(() => {
    Animated.timing(glowAnim, { toValue: passed ? 1 : 0, duration: 300, useNativeDriver: false }).start();
  }, [passed]);

  const barW = barAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const barColor = barAnim.interpolate({
    inputRange: [0, target * 0.55, target, 1],
    outputRange: ['#FF3B30', '#FF9500', color, color],
    extrapolate: 'clamp',
  });

  return (
    <View style={[hc.chip, {
      borderColor: passed ? color + 'BB' : color + '33',
      backgroundColor: passed ? color + '18' : 'rgba(0,0,0,0.75)',
      shadowColor: color, shadowOpacity: passed ? 0.7 : 0.15, shadowRadius: 8, elevation: 8,
    }]}>
      <View style={hc.row}>
        <Text style={[hc.label, { color: passed ? color : 'rgba(255,255,255,0.45)' }]}>{label}</Text>
        <Text style={[hc.val, { color: passed ? color : '#666' }]}>{displayVal}</Text>
      </View>
      <View style={hc.track}>
        <View style={[hc.tmark, { left: `${target * 100}%` as any }]} />
        <Animated.View style={[hc.fill, {
          width: barW, backgroundColor: barColor,
          shadowColor: color, shadowOpacity: glowAnim, shadowRadius: 6, elevation: 4,
        }]} />
      </View>
      <View style={[hc.dot, { backgroundColor: passed ? color : 'rgba(255,255,255,0.12)' }]} />
    </View>
  );
});

const hc = StyleSheet.create({
  chip: { width: 114, borderWidth: 1, borderRadius: 7, padding: 7, paddingBottom: 5, position: 'relative' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  label: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  val: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3 },
  track: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 2 },
  fill: { height: 3, borderRadius: 2 },
  tmark: { position: 'absolute', top: -3, width: 1.5, height: 9, backgroundColor: 'rgba(255,255,255,0.28)', borderRadius: 1, zIndex: 3 },
  dot: { position: 'absolute', top: 5, right: 6, width: 5, height: 5, borderRadius: 2.5 },
});

// ════════════════════════════════════════════════════════════════════════════════
// 2B.  SCAN SWEEP  (horizontal glowing line sweeps through oval)
// ════════════════════════════════════════════════════════════════════════════════

const ScanSweep = React.memo(({ color, active }: { color: string; active: boolean }) => {
  const y = useRef(new Animated.Value(0)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { Animated.timing(op, { toValue: 0, duration: 300, useNativeDriver: true }).start(); return; }
    op.setValue(0.9);
    Animated.loop(
      Animated.timing(y, { toValue: OVAL_H, duration: 2000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [active]);

  return (
    <Animated.View style={[sw.container, { opacity: op }]} pointerEvents="none">
      <Animated.View style={[sw.line, { width: OVAL_W, transform: [{ translateY: y }] }]}>
        <View style={sw.glow1} />
        <View style={[sw.bright, { backgroundColor: color + 'CC' }]} />
        <View style={sw.glow2} />
      </Animated.View>
    </Animated.View>
  );
});

const sw = StyleSheet.create({
  container: { position: 'absolute', width: OVAL_W, height: OVAL_H, top: 0, left: 0, overflow: 'hidden' },
  line: { position: 'absolute', top: 0, left: 0 },
  glow1: { width: '100%', height: 22, backgroundColor: 'rgba(0,0,0,0)' },
  bright: { width: '100%', height: 1.5 },
  glow2: { width: '100%', height: 22, backgroundColor: 'rgba(0,0,0,0)', transform: [{ scaleY: -1 }] },
});

// ════════════════════════════════════════════════════════════════════════════════
// 2C.  SCAN RINGS  (dual counter-rotating arcs)
// ════════════════════════════════════════════════════════════════════════════════

const ScanRings = React.memo(({ color, detected, progress, allPass }: {
  color: string; detected: boolean; progress: number; allPass: boolean;
}) => {
  const r1 = useRef(new Animated.Value(0)).current, r2 = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current, pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(r1, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(r2, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
  }, []);
  useEffect(() => {
    Animated.timing(glow, { toValue: detected ? 1 : 0, duration: 400, useNativeDriver: false }).start();
    if (detected) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.98, duration: 1200, useNativeDriver: true }),
      ])).start();
    } else { pulse.stopAnimation(); pulse.setValue(1); }
  }, [detected]);

  const spin1 = r1.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spin2 = r2.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const R1 = OVAL_W + 32, R1H = OVAL_H + 32, R2 = OVAL_W + 54, R2H = OVAL_H + 54;
  const gc = allPass ? '#00FF88' : color;

  return (
    <Animated.View style={[srings.wrap, { transform: [{ scale: pulse }] }]} pointerEvents="none">
      {/* Glow border */}
      <Animated.View style={[srings.border, {
        width: OVAL_W + 6, height: OVAL_H + 6, borderRadius: (OVAL_W + 6) / 2,
        borderColor: allPass ? '#00FF88' : (glow.interpolate({ inputRange: [0, 1], outputRange: [color + '22', color + 'BB'] })),
        shadowColor: gc, shadowOpacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
        shadowRadius: 20, elevation: 16,
      }]} />
      {detected && (
        <Animated.View style={[srings.arc, { width: R1, height: R1H, transform: [{ rotate: spin1 }] }]}>
          <View style={{
            width: R1, height: R1H, borderRadius: R1 / 2, borderWidth: 1.5, borderColor: 'transparent',
            borderTopColor: color + 'CC', borderRightColor: color + '44', position: 'absolute'
          }} />
        </Animated.View>
      )}
      {detected && (
        <Animated.View style={[srings.arc, { width: R2, height: R2H, transform: [{ rotate: spin2 }] }]}>
          <View style={{
            width: R2, height: R2H, borderRadius: R2 / 2, borderWidth: 1, borderColor: 'transparent',
            borderBottomColor: color + '88', borderLeftColor: color + '33', position: 'absolute'
          }} />
        </Animated.View>
      )}
      {/* Progress arc */}
      {detected && progress > 0.05 && (
        <View style={[srings.arc, { width: OVAL_W + 14, height: OVAL_H + 14 }]}>
          <View style={{
            width: OVAL_W + 14, height: OVAL_H + 14, borderRadius: (OVAL_W + 14) / 2, borderWidth: 3,
            borderColor: 'transparent',
            borderTopColor: allPass ? '#00FF88' : color,
            borderRightColor: progress > 0.25 ? (allPass ? '#00FF88' : color) : 'transparent',
            borderBottomColor: progress > 0.50 ? (allPass ? '#00FF88' : color) : 'transparent',
            borderLeftColor: progress > 0.75 ? (allPass ? '#00FF88' : color) : 'transparent',
            position: 'absolute',
          }} />
        </View>
      )}
    </Animated.View>
  );
});
const srings = StyleSheet.create({
  wrap: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
  border: { position: 'absolute', borderWidth: 2 },
  arc: { position: 'absolute', justifyContent: 'center', alignItems: 'center' },
});

// ════════════════════════════════════════════════════════════════════════════════
// 2D.  CORNER BRACKETS  with blinking dots
// ════════════════════════════════════════════════════════════════════════════════

const CornerBrackets = React.memo(({ color, allPass }: { color: string; allPass: boolean }) => {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(blink, { toValue: 0.15, duration: 650, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 1, duration: 650, useNativeDriver: true }),
    ])).start();
  }, []);
  const L = 22, T = 3, PAD = 7, bc = allPass ? '#00FF88' : color;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {[
        { top: PAD, left: PAD }, { top: PAD, right: PAD },
        { bottom: PAD, left: PAD }, { bottom: PAD, right: PAD },
      ].map((pos, i) => {
        const isR = 'right' in pos, isB = 'bottom' in pos;
        return (
          <View key={i} style={[{ position: 'absolute' }, ...[pos as any]]}>
            <View style={{ width: L, height: T, backgroundColor: bc, borderRadius: 1.5, alignSelf: isR ? 'flex-end' : 'flex-start' }} />
            <View style={{ width: T, height: L, backgroundColor: bc, borderRadius: 1.5, marginLeft: isR ? L - T : 0, marginTop: isB ? -(L) : 0 }} />
            <Animated.View style={{
              position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: bc, opacity: blink,
              top: isB ? undefined : 0, bottom: isB ? 0 : undefined,
              left: isR ? undefined : 0, right: isR ? 0 : undefined,
            }} />
          </View>
        );
      })}
    </View>
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// 2E.  CROSSHAIR  (appears when locked on)
// ════════════════════════════════════════════════════════════════════════════════

const Crosshair = ({ color, visible }: { color: string; visible: boolean }) => {
  const sc = useRef(new Animated.Value(1.5)).current;
  const op = useRef(new Animated.Value(0)).current;
  const ro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(sc, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      Animated.loop(Animated.timing(ro, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
    } else {
      Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);
  const rotate = ro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const S = 56;
  return (
    <Animated.View style={{ position: 'absolute', width: S, height: S, justifyContent: 'center', alignItems: 'center', opacity: op, transform: [{ scale: sc }] }} pointerEvents="none">
      <Animated.View style={{ position: 'absolute', width: S, height: S, borderRadius: S / 2, borderWidth: 1, borderColor: color + '55', transform: [{ rotate }] }} />
      <View style={{ position: 'absolute', width: S * 0.5, height: S * 0.5, borderRadius: S * 0.25, borderWidth: 1.5, borderColor: color }} />
      <View style={{ position: 'absolute', height: 1, width: S * 0.75, backgroundColor: color + 'BB' }} />
      <View style={{ position: 'absolute', width: 1, height: S * 0.75, backgroundColor: color + 'BB' }} />
      <View style={{ position: 'absolute', width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
    </Animated.View>
  );
};

// ════════════════════════════════════════════════════════════════════════════════
// 2F.  STABILITY GAUGE  (circular, floats below oval)
// ════════════════════════════════════════════════════════════════════════════════

const StabilityGauge = React.memo(({ progress, color }: { progress: number; color: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: progress, friction: 6, tension: 70, useNativeDriver: false }).start();
    if (progress >= 1) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 360, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 360, useNativeDriver: true }),
      ])).start();
    } else { pulse.stopAnimation(); pulse.setValue(1); }
  }, [progress]);
  const SIZE = 76, gc = progress >= 1 ? '#00FF88' : color;
  const tc = gc, rc = progress > 0.25 ? gc : 'rgba(255,255,255,0.07)';
  const bc = progress > 0.50 ? gc : 'rgba(255,255,255,0.07)';
  const lc = progress > 0.75 ? gc : 'rgba(255,255,255,0.07)';
  return (
    <Animated.View style={{ width: SIZE, height: SIZE, justifyContent: 'center', alignItems: 'center', transform: [{ scale: pulse }] }}>
      <View style={{ position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 4, borderColor: 'rgba(255,255,255,0.06)' }} />
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 4,
        borderTopColor: tc, borderRightColor: rc, borderBottomColor: bc, borderLeftColor: lc,
        shadowColor: gc, shadowOpacity: progress > 0 ? 0.8 : 0, shadowRadius: 12, elevation: 12,
      }} />
      <Text style={{ color: progress >= 1 ? '#00FF88' : '#fff', fontWeight: '900', fontSize: 16, letterSpacing: -0.5 }}>{Math.round(progress * 100)}%</Text>
      <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 7, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 }}>{progress >= 1 ? 'LOCKED' : 'HOLD'}</Text>
    </Animated.View>
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// 2G.  STEP STEPPER
// ════════════════════════════════════════════════════════════════════════════════

const StepStepper = React.memo(({ currentStep, steps, capturedCount }: { currentStep: number; steps: EnrollStep[]; capturedCount: number; }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
    {steps.map((s, i) => {
      const done = i < capturedCount, active = i === currentStep;
      const scA = useRef(new Animated.Value(active ? 1.15 : 0.85)).current;
      useEffect(() => {
        Animated.spring(scA, { toValue: active ? 1.15 : done ? 1 : 0.8, friction: 6, tension: 80, useNativeDriver: true }).start();
      }, [active, done]);
      return (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Animated.View style={[{
            width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', transform: [{ scale: scA }],
            shadowColor: s.color, shadowOpacity: active ? 0.9 : 0, shadowRadius: 10, elevation: active ? 10 : 0
          },
          done ? { backgroundColor: s.color + '30', borderColor: s.color, borderWidth: 2 } :
            active ? { borderColor: s.color, borderWidth: 2.5 } :
              { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)', borderWidth: 1 },
          ]}>
            <Text style={{ fontSize: 15, color: '#fff' }}>{done ? '✓' : s.icon}</Text>
          </Animated.View>
          {i < steps.length - 1 && <View style={{ width: 16, height: 2, backgroundColor: done ? s.color : 'rgba(255,255,255,0.1)', marginHorizontal: 2, borderRadius: 1 }} />}
        </View>
      );
    })}
  </View>
));

// ════════════════════════════════════════════════════════════════════════════════
// 2H.  STATUS BADGE
// ════════════════════════════════════════════════════════════════════════════════

const StatusBadge = React.memo(({ detected, allPass, color }: { detected: boolean; allPass: boolean; color: string }) => {
  const sc = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (allPass) {
      Animated.loop(Animated.sequence([
        Animated.timing(sc, { toValue: 1.06, duration: 450, useNativeDriver: true }),
        Animated.timing(sc, { toValue: 1.00, duration: 450, useNativeDriver: true }),
      ])).start();
    } else { sc.stopAnimation(); sc.setValue(1); }
  }, [allPass]);
  const bg = !detected ? 'rgba(255,59,48,0.16)' : allPass ? 'rgba(0,255,136,0.16)' : 'rgba(255,210,0,0.13)';
  const bdr = !detected ? '#FF3B30' : allPass ? '#00FF88' : color;
  const tc = !detected ? '#FF3B30' : allPass ? '#00FF88' : color;
  const lbl = !detected ? '⚠  NO FACE DETECTED' : allPass ? '✓  LOCKED ON — HOLD STILL' : '●  ADJUST POSITION';
  return (
    <Animated.View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 24, borderWidth: 1, gap: 7, backgroundColor: bg, borderColor: bdr, transform: [{ scale: sc }] }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tc }} />
      <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: tc }}>{lbl}</Text>
    </Animated.View>
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// 2I.  DIRECTION ARROW
// ════════════════════════════════════════════════════════════════════════════════

const DirArrow = React.memo(({ stepId, color, show }: { stepId: number; color: string; show: boolean }) => {
  const op = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, { toValue: show ? 1 : 0, duration: 300, useNativeDriver: true }).start();
    if (show) {
      Animated.loop(Animated.sequence([
        Animated.timing(b, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(b, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])).start();
    } else b.setValue(0);
  }, [show]);
  if (stepId !== 1 && stepId !== 2 && stepId !== 3) return null;
  const c = stepId === 1 ? { ch: '◀', x: -1, y: 0 } : stepId === 2 ? { ch: '▶', x: 1, y: 0 } : { ch: '▲', x: 0, y: -1 };
  const tx = b.interpolate({ inputRange: [0, 1], outputRange: [0, c.x * 18] });
  const ty = b.interpolate({ inputRange: [0, 1], outputRange: [0, c.y * 18] });
  return (
    <Animated.View style={{ position: 'absolute', top: -66, alignSelf: 'center', alignItems: 'center', opacity: op }} pointerEvents="none">
      <Animated.Text style={{ fontSize: 42, color, shadowColor: color, shadowRadius: 14, shadowOpacity: 0.9, transform: [{ translateX: tx }, { translateY: ty }] }}>{c.ch}</Animated.Text>
    </Animated.View>
  );
});

// ════════════════════════════════════════════════════════════════════════════════
// 2J.  CAPTURE BURST RING
// ════════════════════════════════════════════════════════════════════════════════

const CaptureBurst = ({ visible, color }: { visible: boolean; color: string }) => {
  const sc = useRef(new Animated.Value(0.3)).current;
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      sc.setValue(0.3); op.setValue(1); Animated.parallel([
        Animated.timing(sc, { toValue: 3.5, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(op, { toValue: 0, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);
  return <Animated.View style={{ position: 'absolute', width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2, borderWidth: 3, borderColor: color, transform: [{ scale: sc }], opacity: op }} pointerEvents="none" />;
};

// ════════════════════════════════════════════════════════════════════════════════
// 2K.  LOADING DOT
// ════════════════════════════════════════════════════════════════════════════════

const AnimDot = ({ delay, color }: { delay: number; color: string }) => {
  const op = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(op, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(op, { toValue: 0.2, duration: 380, useNativeDriver: true }),
    ])).start();
  }, []);
  return <Animated.View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color, opacity: op, marginHorizontal: 5 }} />;
};

// ════════════════════════════════════════════════════════════════════════════════
// 3.  MAIN SCREEN
// ════════════════════════════════════════════════════════════════════════════════

export default function EnrollFaceScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const { updateFaceEnrolled } = useAuthStore();

  const [phase, setPhase] = useState<'guide' | 'camera' | 'submitting' | 'done'>('guide');
  const [currentStep, setCurrentStep] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [showManualBtn, setShowManualBtn] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const [stableProgress, setStableProgress] = useState(0);
  const [showBurst, setShowBurst] = useState(false);
  const [metrics, setMetrics] = useState<FaceMetrics>({ detected: false, yaw: 0, pitch: 0, roll: 0, ear: 0, smile: 0, faceArea: 0 });

  // Bottom bar slide animation on step change
  const drawerSlide = useRef(new Animated.Value(0)).current;
  const drawerFade = useRef(new Animated.Value(1)).current;
  const animDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerFade, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(drawerSlide, { toValue: -20, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      drawerSlide.setValue(20);
      Animated.parallel([
        Animated.timing(drawerFade, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(drawerSlide, { toValue: 0, duration: 260, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      ]).start();
    });
  }, []);

  // Refs
  const cameraRef = useRef<Camera>(null);
  const isCapturingRef = useRef(false);
  const isCapturingSV = useSharedValue(false);
  const stableRef = useRef(0);
  const phantomRef = useRef(0);
  const manualRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedRef = useRef<string[]>([]);
  const stepRef = useRef(0);
  const prevProgRef = useRef(0);

  // ML Kit
  const faceOpts = useMemo<FrameFaceDetectionOptions>(() => ({
    performanceMode: 'fast', landmarkMode: 'none', contourMode: 'none',
    classificationMode: 'all', minFaceSize: THRESHOLDS.FACE_AREA_MIN, trackingEnabled: true,
  }), []);
  const { detectFaces } = useFaceDetector(faceOpts);

  // ── JS BRIDGE (UNCHANGED LOGIC) ────────────────────────────────────────────
  const handleFaceData = useCallback((detected: boolean, area: number, yaw: number, pitch: number, roll: number, ear: number, smile: number) => {
    if (!detected || area < THRESHOLDS.FACE_AREA_MIN) {
      phantomRef.current = 0; stableRef.current = 0; setStableProgress(0);
      setMetrics(p => p.detected ? { ...p, detected: false } : p);
      setShowManualBtn(false);
      if (manualRef.current) { clearTimeout(manualRef.current); manualRef.current = null; }
      return;
    }
    phantomRef.current += 1;
    if (phantomRef.current < THRESHOLDS.PHANTOM_FACE_FRAMES) return;
    setMetrics({ detected: true, yaw, pitch, roll, ear, smile, faceArea: area });
    const step = STEPS[stepRef.current];
    if (!step || isCapturingRef.current) return;
    const areaOK = area <= THRESHOLDS.FACE_AREA_MAX, eyesOK = ear >= THRESHOLDS.EAR_MIN;
    const rollOK = Math.abs(roll) <= THRESHOLDS.ROLL_MAX;
    const yawOK = (step.yawMin === null || yaw >= step.yawMin) && (step.yawMax === null || yaw <= step.yawMax);
    const pitchOK = (step.pitchMin === null || pitch >= step.pitchMin) && (step.pitchMax === null || pitch <= step.pitchMax);
    const smileOK = step.smileMin === null || smile >= step.smileMin;
    const perfect = areaOK && eyesOK && rollOK && yawOK && pitchOK && smileOK;
    if (perfect) {
      stableRef.current += 1;
      const prog = Math.min(1, stableRef.current / THRESHOLDS.STABLE_FRAMES_REQD);
      setStableProgress(prog);
      if (Math.floor(prog * 4) > Math.floor(prevProgRef.current * 4)) vibSound('tick');
      prevProgRef.current = prog;
      if (!manualRef.current) manualRef.current = setTimeout(() => setShowManualBtn(true), THRESHOLDS.MANUAL_BTN_DELAY_MS);
      if (stableRef.current >= THRESHOLDS.STABLE_FRAMES_REQD) triggerCapture();
    } else {
      stableRef.current = Math.max(0, stableRef.current - 1);
      const prog = Math.min(1, stableRef.current / THRESHOLDS.STABLE_FRAMES_REQD);
      setStableProgress(prog); prevProgRef.current = prog;
    }
  }, []);

  const bridge = useMemo(() => Worklets.createRunOnJS(handleFaceData), [handleFaceData]);

  // ── FRAME PROCESSOR (UNCHANGED) ────────────────────────────────────────────
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (isCapturingSV.value) return;
    runAtTargetFps(15, () => {
      'worklet';
      const faces = detectFaces(frame);
      if (!faces || faces.length === 0) { bridge(false, 0, 0, 0, 0, 0, 0); return; }
      let best = faces[0];
      for (let i = 1; i < faces.length; i++) { if (faces[i].bounds.width > best.bounds.width) best = faces[i]; }
      const area = (best.bounds.width * best.bounds.height) / (frame.width * frame.height);
      const yaw = best.yawAngle ?? 0, pitch = best.pitchAngle ?? 0, roll = best.rollAngle ?? 0;
      const smile = best.smilingProbability ?? 0;
      const ear = ((best.leftEyeOpenProbability ?? 1) + (best.rightEyeOpenProbability ?? 1)) / 2;
      bridge(true, area, yaw, pitch, roll, ear, smile);
    });
  }, [detectFaces, bridge, isCapturingSV]);

  // // ── CAPTURE (UNCHANGED + burst) ────────────────────────────────────────────
  // const triggerCapture=useCallback(async()=>{
  //   if(isCapturingRef.current||!cameraRef.current) return;
  //   isCapturingRef.current=true; isCapturingSV.value=true;
  //   setCapturing(true); setShowManualBtn(false);
  //   if(manualRef.current){clearTimeout(manualRef.current);manualRef.current=null;}
  //   vibSound('capture'); setShowBurst(true); setTimeout(()=>setShowBurst(false),650);
  //   try{
  //     await new Promise(res=>setTimeout(res,50));
  //     const photo=await cameraRef.current.takePhoto({flash:'off'});
  //     const uri=Platform.OS==='android'?`file://${photo.path}`:photo.path;
  //     const c=await ImageManipulator.manipulateAsync(uri,[{resize:{width:640}}],{compress:0.85,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  //     if(!c.base64) throw new Error('No base64');
  //     capturedRef.current.push(c.base64); setCapturedCount(capturedRef.current.length);
  //     const next=stepRef.current+1;
  //     if(next<STEPS.length){
  //       animDrawer(); stepRef.current=next; setCurrentStep(next);
  //       stableRef.current=0; phantomRef.current=0; setStableProgress(0); prevProgRef.current=0;
  //       isCapturingRef.current=false; isCapturingSV.value=false; setCapturing(false);
  //     } else { await submitEnrollment(); }
  //   }catch{
  //     Alert.alert('Capture Failed','Please hold still and try again.');
  //     isCapturingRef.current=false; isCapturingSV.value=false; setCapturing(false);
  //   }
  // },[]);

  // ── CAPTURE (UNCHANGED + burst) ────────────────────────────────────────────
  // ── CAPTURE (UPDATED with Dynamic Hardware Alignment) ──────────────────────
  const triggerCapture = useCallback(async () => {
    if (isCapturingRef.current || !cameraRef.current) return;
    isCapturingRef.current = true; isCapturingSV.value = true;
    setCapturing(true); setShowManualBtn(false);

    if (manualRef.current) { clearTimeout(manualRef.current); manualRef.current = null; }
    vibSound('capture'); setShowBurst(true); setTimeout(() => setShowBurst(false), 650);

    try {
      await new Promise(res => setTimeout(res, 50));
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;

      // ─────────────────────────────────────────────────────────────
      // THE PRODUCTION EXIF BYPASS & AFFINE TRANSFORMATION ENGINE
      // ─────────────────────────────────────────────────────────────
      // const actions: any[] = [];

      // if (Platform.OS === 'android') {
      //   // 1. Dynamic Hardware Sensor Analysis
      //   const sensorOrientation = photo.orientation;

      //   if (sensorOrientation === 'landscape-right') {
      //     actions.push({ rotate: 90 });
      //   } else if (sensorOrientation === 'landscape-left') {
      //     actions.push({ rotate: 270 });
      //   } else if (sensorOrientation === 'portrait-upside-down') {
      //     actions.push({ rotate: 180 });
      //   } else if (!sensorOrientation && photo.width > photo.height) {
      //     // Fallback geometric constraint
      //     actions.push({ rotate: 270 });
      //   }

      //   // 2. Geometric Mirror Correction (Front camera is a mirror)
      //   actions.push({ flip: ImageManipulator.FlipType.Horizontal });
      // }

      // // 3. Dimensionality Reduction
      // actions.push({ resize: { width: 640 } });

      // const c = await ImageManipulator.manipulateAsync(
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

      const c = await ImageManipulator.manipulateAsync(
        uri,
        actions,
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      if (!c.base64) throw new Error('No base64');

      capturedRef.current.push(c.base64);
      setCapturedCount(capturedRef.current.length);

      const next = stepRef.current + 1;
      if (next < STEPS.length) {
        animDrawer(); stepRef.current = next; setCurrentStep(next);
        stableRef.current = 0; phantomRef.current = 0; setStableProgress(0); prevProgRef.current = 0;
        isCapturingRef.current = false; isCapturingSV.value = false; setCapturing(false);
      } else {
        await submitEnrollment();
      }
    } catch {
      Alert.alert('Capture Failed', 'Please hold still and try again.');
      isCapturingRef.current = false; isCapturingSV.value = false; setCapturing(false);
    }
  }, []);

  const submitEnrollment = async () => {
    setPhase('submitting');
    try { await StudentAPI.enrollFace(capturedRef.current); updateFaceEnrolled(new Date().toISOString()); setPhase('done'); }
    catch (err: any) { Alert.alert('Enrollment Failed', err.response?.data?.error || 'Enrollment failed.', [{ text: 'Retake', onPress: resetSession }]); }
  };

  const resetSession = () => {
    capturedRef.current = []; stepRef.current = 0; setCurrentStep(0);
    stableRef.current = 0; phantomRef.current = 0;
    isCapturingRef.current = false; isCapturingSV.value = false;
    setCapturing(false); setShowManualBtn(false); setStableProgress(0); setCapturedCount(0);
    prevProgRef.current = 0; setPhase('camera');
  };

  // ── DERIVED ────────────────────────────────────────────────────────────────
  const step = STEPS[currentStep] ?? STEPS[0];
  const areaOK = metrics.faceArea >= THRESHOLDS.FACE_AREA_MIN && metrics.faceArea <= THRESHOLDS.FACE_AREA_MAX;
  const eyesOK = metrics.ear >= THRESHOLDS.EAR_MIN;
  const rollOK = Math.abs(metrics.roll) <= THRESHOLDS.ROLL_MAX;
  const yawOK = (step.yawMin === null || metrics.yaw >= step.yawMin) && (step.yawMax === null || metrics.yaw <= step.yawMax);
  const pitchOK = (step.pitchMin === null || metrics.pitch >= step.pitchMin) && (step.pitchMax === null || metrics.pitch <= step.pitchMax);
  const smileOK = step.smileMin === null || metrics.smile >= step.smileMin;
  const poseOK = yawOK && pitchOK && rollOK;
  const allPass = metrics.detected && areaOK && eyesOK && poseOK && smileOK;

  const normArea = metrics.faceArea > 0 ? Math.min(1, (metrics.faceArea - THRESHOLDS.FACE_AREA_MIN) / (THRESHOLDS.FACE_AREA_MAX - THRESHOLDS.FACE_AREA_MIN)) : 0;
  const normEAR = Math.min(1, metrics.ear / 0.45);
  const normYaw = step.id === 1 ? Math.min(1, Math.max(0, metrics.yaw / 35)) : step.id === 2 ? Math.min(1, Math.max(0, -metrics.yaw / 35)) : Math.min(1, 1 - Math.abs(metrics.yaw) / 15);
  const normPitch = step.id === 3 ? Math.min(1, Math.max(0, metrics.pitch / 30)) : Math.min(1, 1 - Math.abs(metrics.pitch) / 15);
  const normSmile = metrics.smile;
  const normRoll = Math.min(1, 1 - Math.abs(metrics.roll) / THRESHOLDS.ROLL_MAX);

  // Left = always Face Size + Eye Openness
  const leftChips = [
    { label: 'Face Size', value: normArea, target: 0.45, passed: areaOK && metrics.detected, displayVal: `${Math.round(metrics.faceArea * 100)}%` },
    { label: 'Eye Open', value: normEAR, target: THRESHOLDS.EAR_MIN / 0.45, passed: eyesOK && metrics.detected, displayVal: `${Math.round(metrics.ear * 100)}%` },
  ];
  // Right = context metric + roll
  const rightChips = step.id === 4
    ? [{ label: 'Smile', value: normSmile, target: step.smileMin ?? 0.45, passed: smileOK && metrics.detected, displayVal: `${Math.round(metrics.smile * 100)}%` },
    { label: 'Roll', value: normRoll, target: 0.70, passed: rollOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.roll))}°` }]
    : step.id === 1 || step.id === 2
      ? [{ label: step.id === 1 ? 'L Rot' : 'R Rot', value: normYaw, target: 0.38, passed: yawOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.yaw))}°` },
      { label: 'Roll', value: normRoll, target: 0.70, passed: rollOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.roll))}°` }]
      : step.id === 3
        ? [{ label: 'Up Tilt', value: normPitch, target: 0.35, passed: pitchOK && metrics.detected, displayVal: `${Math.round(metrics.pitch)}°` },
        { label: 'Roll', value: normRoll, target: 0.70, passed: rollOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.roll))}°` }]
        : [{ label: 'Yaw', value: normYaw, target: 0.70, passed: yawOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.yaw))}°` },
        { label: 'Roll', value: normRoll, target: 0.70, passed: rollOK && metrics.detected, displayVal: `${Math.abs(Math.round(metrics.roll))}°` }];

  const guidanceMsg = !metrics.detected ? '👁  Position your face inside the oval'
    : !areaOK ? (metrics.faceArea < THRESHOLDS.FACE_AREA_MIN ? '↑  Move closer' : '↓  Move farther')
      : !eyesOK ? '👁  Keep both eyes fully open'
        : !poseOK ? step.hint
          : !smileOK ? '😊  Smile wider!'
            : allPass ? '✓  Perfect — capturing…'
              : 'Hold steady…';

  // ════════════════════════════════════════════════════════════════════════════
  // GUIDE SCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'guide') {
    return (
      <SafeAreaView style={gg.safe}>
        <ScrollView contentContainerStyle={gg.scroll} showsVerticalScrollIndicator={false}>
          <View style={gg.hero}>
            <View style={gg.heroRing}><Text style={{ fontSize: 48 }}>🔬</Text></View>
            <Text style={gg.title}>QUANTUM{'\n'}FACE SCAN</Text>
            <Text style={gg.sub}>AI biometric enrollment · 5 poses · ~30 seconds</Text>
          </View>
          <View style={gg.card}>
            <View style={gg.badge}><Text style={[gg.badgeText, { color: '#00FFEA' }]}>HOW IT WORKS</Text></View>
            <Text style={gg.body}>Our AI extracts a 512-dimensional face embedding from each pose. Your raw photos are never retained — only your encrypted mathematical signature.</Text>
          </View>
          <View style={gg.card}>
            <View style={[gg.badge, { backgroundColor: '#FFD20015', borderColor: '#FFD200' }]}><Text style={[gg.badgeText, { color: '#FFD200' }]}>REQUIREMENTS</Text></View>
            {[{ i: '💡', t: 'Good even lighting — face a window or lamp', ok: true }, { i: '👓', t: 'Remove glasses, hats, or face coverings', ok: true }, { i: '📏', t: 'Stay 30–50 cm from the camera', ok: true }, { i: '🌑', t: 'Avoid dark rooms or harsh backlight', ok: false }]
              .map((r, idx) => (<View key={idx} style={gg.reqRow}><Text style={gg.reqIcon}>{r.i}</Text><Text style={[gg.reqText, r.ok ? { color: 'rgba(255,255,255,0.65)' } : { color: '#FF5F3F' }]}>{r.t}</Text></View>))}
          </View>
          <View style={gg.card}>
            <View style={[gg.badge, { backgroundColor: '#BF5FFF15', borderColor: '#BF5FFF' }]}><Text style={[gg.badgeText, { color: '#BF5FFF' }]}>5 AUTO-CAPTURED POSES</Text></View>
            {STEPS.map(s => (
              <View key={s.id} style={gg.stepRow}>
                <View style={[gg.stepDot, { backgroundColor: s.color + '18', borderColor: s.color }]}><Text style={{ fontSize: 16 }}>{s.icon}</Text></View>
                <View style={{ flex: 1 }}><Text style={[gg.stepLabel, { color: s.color }]}>{s.label}</Text><Text style={gg.stepHint}>{s.hint}</Text></View>
                <View style={[gg.autoBadge, { backgroundColor: s.color + '18' }]}><Text style={[gg.autoBadgeText, { color: s.color }]}>AUTO</Text></View>
              </View>
            ))}
          </View>
          {!hasPermission
            ? <TouchableOpacity style={gg.btn} onPress={requestPermission} activeOpacity={0.85}><Text style={gg.btnText}>GRANT CAMERA ACCESS</Text></TouchableOpacity>
            : <TouchableOpacity style={gg.btn} onPress={() => setPhase('camera')} activeOpacity={0.85}><Text style={gg.btnText}>START SCANNING  →</Text></TouchableOpacity>
          }
          <TouchableOpacity style={gg.skipBtn} onPress={() => router.back()}><Text style={gg.skipText}>Do this later</Text></TouchableOpacity>
          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'submitting') {
    return (
      <View style={tt.root}>
        <View style={tt.card}>
          <ActivityIndicator size="large" color="#00FFEA" style={{ marginBottom: 24 }} />
          <Text style={tt.title}>PROCESSING{'\n'}ENROLLMENT</Text>
          <Text style={tt.sub}>Extracting face embeddings…</Text>
          <View style={{ flexDirection: 'row', marginTop: 20 }}>{[0, 1, 2].map(i => <AnimDot key={i} delay={i * 220} color="#00FFEA" />)}</View>
        </View>
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={[tt.root, { backgroundColor: '#020D08' }]}>
        <View style={[tt.card, { borderColor: 'rgba(0,255,136,0.2)', shadowColor: '#00FF88' }]}>
          <View style={tt.doneRing}><Text style={{ fontSize: 52 }}>🎉</Text></View>
          <Text style={[tt.title, { color: '#00FF88', marginTop: 16 }]}>PROFILE{'\n'}SECURED</Text>
          <Text style={tt.sub}>Your biometric signature is encrypted and locked.</Text>
          <View style={tt.statsRow}>
            {[{ v: '5', l: 'POSES' }, { v: '512', l: 'DIMS' }, { v: 'AES', l: 'ENCRYPTED' }].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center' }}>
                {i > 0 && <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 18 }} />}
                <View style={{ alignItems: 'center' }}><Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{s.v}</Text><Text style={{ fontSize: 7, fontWeight: '800', color: 'rgba(255,255,255,0.28)', letterSpacing: 1.2, marginTop: 3 }}>{s.l}</Text></View>
              </View>
            ))}
          </View>
          <TouchableOpacity style={tt.doneBtn} onPress={() => router.replace('/(tabs)/home')} activeOpacity={0.85}>
            <Text style={tt.doneBtnText}>RETURN TO HOME  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!device) {
    return (<View style={tt.root}><ActivityIndicator size="large" color="#00FFEA" /><Text style={tt.sub}>Initializing camera…</Text></View>);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CAMERA PHASE  ← THE MONEY SHOT
  // Camera = full screen. HUD chips float INSIDE the oval on face.
  // Compact bottom bar at very bottom.
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* ── FULL SCREEN CAMERA ──────────────────────────────────────────── */}
      <Camera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={phase === 'camera'}
        frameProcessor={frameProcessor}
        photo={true}
        photoQualityBalance='quality'
      />

      {/* ── OVAL ZONE: everything floats here ──────────────────────────── */}
      <View style={[cs.ovalZone, { top: OVAL_TOP, left: (W - OVAL_W) / 2 }]} pointerEvents="none">

        {/* Dashed oval border */}
        <View style={[cs.ovalBorder, {
          borderColor: allPass ? '#00FF88CC' : metrics.detected ? step.color + '88' : 'rgba(255,255,255,0.14)',
        }]} />

        {/* Holographic scan rings */}
        <ScanRings color={step.color} detected={metrics.detected} progress={stableProgress} allPass={allPass} />

        {/* Corner brackets */}
        <CornerBrackets color={step.color} allPass={allPass} />

        {/* Scan sweep through face */}
        <ScanSweep color={step.color} active={metrics.detected && !allPass} />

        {/* ── LEFT HUD PANEL — Face Size + Eye Open ──────────────────── */}
        <View style={cs.hudLeft}>
          {leftChips.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: i === 0 ? 10 : 0 }}>
              <HUDChip {...m} color={step.color} />
              {/* connector line to oval edge */}
              <View style={[cs.connLineL, { backgroundColor: m.passed ? step.color : step.color + '55' }]} />
              <View style={[cs.connDotL, { backgroundColor: m.passed ? step.color : step.color + '44' }]} />
            </View>
          ))}
        </View>

        {/* ── RIGHT HUD PANEL — Pose + Roll/Smile ────────────────────── */}
        <View style={cs.hudRight}>
          {rightChips.map((m, i) => (
            <View key={i} style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: i === 0 ? 10 : 0 }}>
              <HUDChip {...m} color={step.color} />
              <View style={[cs.connLineR, { backgroundColor: m.passed ? step.color : step.color + '55' }]} />
              <View style={[cs.connDotR, { backgroundColor: m.passed ? step.color : step.color + '44' }]} />
            </View>
          ))}
        </View>

        {/* Direction arrow above oval */}
        <DirArrow stepId={step.id} color={step.color} show={metrics.detected && !poseOK} />

        {/* Crosshair when locked */}
        <Crosshair color={step.color} visible={allPass} />

        {/* Capture burst */}
        <CaptureBurst visible={showBurst} color={step.color} />

        {/* Stability gauge — below oval, centered */}
        <View style={cs.stabilityWrap}>
          <StabilityGauge progress={stableProgress} color={step.color} />
        </View>
      </View>

      {/* ── CAPTURE FLASH ───────────────────────────────────────────────── */}
      {capturing && <View style={cs.flash} pointerEvents="none" />}

      {/* ── HUD OVERLAY (top bar + stepper + badge + bottom bar) ────────── */}
      <SafeAreaView style={cs.hud} pointerEvents="box-none">

        {/* TOP BAR */}
        <View style={cs.topBar}>
          <TouchableOpacity style={cs.restartBtn} onPress={resetSession} activeOpacity={0.8}>
            <Text style={cs.restartText}>↺  RESTART</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={cs.topTitle}>FACE SCAN</Text>
            <Text style={[cs.topSub, { color: step.color }]}>{capturedCount}/{STEPS.length} CAPTURED</Text>
          </View>
          <View style={{ width: 80 }} />
        </View>

        {/* STEP STEPPER */}
        <View style={{ paddingVertical: 8 }}>
          <StepStepper currentStep={currentStep} steps={STEPS} capturedCount={capturedCount} />
        </View>

        {/* STATUS BADGE */}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <StatusBadge detected={metrics.detected} allPass={allPass} color={step.color} />
        </View>

        {/* SPACER — camera is full screen */}
        <View style={{ flex: 1 }} />

        {/* COMPACT BOTTOM BAR */}
        <Animated.View style={[cs.bottomBar, { opacity: drawerFade, transform: [{ translateY: drawerSlide }] }]}>
          <View style={cs.barHandle} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={[cs.stepPill, { backgroundColor: step.color + '1A', borderColor: step.color + '55' }]}>
                <Text style={[cs.stepPillText, { color: step.color }]}>STEP {currentStep + 1}/{STEPS.length}  ·  {step.label}</Text>
              </View>
              <Text style={cs.instrText}>{step.icon}  {step.instruction}</Text>
              <Text style={cs.hintText}>{guidanceMsg}</Text>
            </View>
            <StabilityGauge progress={stableProgress} color={step.color} />
          </View>
          {showManualBtn && metrics.detected && !capturing && (
            <TouchableOpacity style={[cs.manualBtn, { borderColor: step.color }]} onPress={triggerCapture} activeOpacity={0.8}>
              <Text style={[cs.manualBtnText, { color: step.color }]}>📸  TAP TO FORCE CAPTURE</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// 4.  STYLES
// ════════════════════════════════════════════════════════════════════════════════

const gg = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#060B12' },
  scroll: { padding: 20, paddingTop: 10 },
  hero: { alignItems: 'center', paddingVertical: 32 },
  heroRing: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#00FFEA12', borderWidth: 2, borderColor: '#00FFEA30', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#00FFEA', shadowRadius: 24, shadowOpacity: 0.4, elevation: 12 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 3, lineHeight: 38 },
  sub: { fontSize: 12, color: '#00FFEA', marginTop: 12, letterSpacing: 0.8, fontWeight: '600' },
  card: { backgroundColor: '#0C1318', borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  badge: { alignSelf: 'flex-start', backgroundColor: '#00FFEA15', borderWidth: 1, borderColor: '#00FFEA', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 7, marginBottom: 10 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8 },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.52)', lineHeight: 21 },
  reqRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 9 },
  reqIcon: { fontSize: 16, width: 24 },
  reqText: { fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 20 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepDot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  stepHint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
  autoBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
  autoBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2, color: '#fff' },
  btn: { backgroundColor: '#00FFEA', borderRadius: 14, paddingVertical: 18, alignItems: 'center', marginTop: 8, shadowColor: '#00FFEA', shadowRadius: 18, shadowOpacity: 0.45, elevation: 10 },
  btnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  skipBtn: { alignItems: 'center', marginTop: 14 },
  skipText: { color: 'rgba(255,255,255,0.2)', fontSize: 13, fontWeight: '600' },
});

const tt = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060A10', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#0C1318', borderRadius: 26, padding: 34, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(0,255,234,0.18)', shadowColor: '#00FFEA', shadowRadius: 28, shadowOpacity: 0.15, elevation: 10, width: '92%' },
  title: { color: '#00FFEA', fontSize: 22, fontWeight: '900', letterSpacing: 3, textAlign: 'center', lineHeight: 30 },
  sub: { color: 'rgba(255,255,255,0.36)', fontSize: 13, marginTop: 10, textAlign: 'center', lineHeight: 20 },
  doneRing: { width: 108, height: 108, borderRadius: 54, backgroundColor: '#00FF8812', borderWidth: 2, borderColor: '#00FF8835', justifyContent: 'center', alignItems: 'center', shadowColor: '#00FF88', shadowRadius: 26, shadowOpacity: 0.4, elevation: 12 },
  statsRow: { flexDirection: 'row', marginTop: 26, alignItems: 'center' },
  doneBtn: { backgroundColor: '#00FF88', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 28, marginTop: 26, width: '100%', alignItems: 'center', shadowColor: '#00FF88', shadowRadius: 14, shadowOpacity: 0.45, elevation: 10 },
  doneBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1.5 },
});

const BOTTOM_BAR_H = 160;

const cs = StyleSheet.create({
  // Oval zone (full screen, no overflow clip so HUD chips stick out)
  ovalZone: { position: 'absolute', width: OVAL_W, height: OVAL_H, justifyContent: 'center', alignItems: 'center', overflow: 'visible' },
  ovalBorder: { position: 'absolute', width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2, borderWidth: 2, borderStyle: 'dashed' },

  // HUD panels — positioned at vertical center of oval, sticking OUT on each side
  hudLeft: { position: 'absolute', right: OVAL_W + 2, top: '28%', alignItems: 'flex-end' },
  hudRight: { position: 'absolute', left: OVAL_W + 2, top: '28%', alignItems: 'flex-start' },

  // Connector lines from chips to oval edge
  connLineL: { height: 1, width: 20, marginLeft: 0 },
  connDotL: { width: 5, height: 5, borderRadius: 2.5, marginLeft: 0 },
  connLineR: { height: 1, width: 20, marginRight: 0 },
  connDotR: { width: 5, height: 5, borderRadius: 2.5, marginRight: 0 },

  // Stability gauge below oval
  stabilityWrap: { position: 'absolute', bottom: -54, alignSelf: 'center' },

  // Flash
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.58)', zIndex: 50 },

  // HUD overlay
  hud: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2 },
  restartBtn: { backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  restartText: { color: 'rgba(255,255,255,0.7)', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  topTitle: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 3 },
  topSub: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 2 },

  // Bottom bar — compact
  bottomBar: {
    backgroundColor: 'rgba(4,8,16,0.97)',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowRadius: 16, shadowOpacity: 0.6, elevation: 30,
  },
  barHandle: { width: 34, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  stepPill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 7, borderWidth: 1, marginBottom: 7 },
  stepPillText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  instrText: { fontSize: 17, fontWeight: '900', color: '#fff', letterSpacing: 0.2 },
  hintText: { fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 5, lineHeight: 18 },
  manualBtn: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.03)' },
  manualBtnText: { fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});