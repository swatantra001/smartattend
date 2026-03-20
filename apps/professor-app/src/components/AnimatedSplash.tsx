// D:\smartattend\apps\student-app\src\components\AnimatedSplash.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Beautiful animated splash screen.
// Replace the default Expo splash with this component.
//
// HOW TO USE — see bottom of this file for setup instructions.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY        = '#0F172A';
const INDIGO      = '#6366F1';
const INDIGO_DARK = '#4338CA';
const MINT        = '#34D399';
const WHITE       = '#FFFFFF';

interface Props {
  onFinish: () => void;          // called when animation completes — show your app
  role?: 'student' | 'professor';
  // Pass the icon image source from the calling layout, e.g.:
  //   iconSource={require('../../assets/student-icon.png')}
  // This avoids hard-coded relative paths that differ between apps.
  iconSource?: any;
}

export default function AnimatedSplash({ onFinish, role = 'student', iconSource }: Props) {
  // ── Animation values ────────────────────────────────────────────────────────
  const bgScale       = useRef(new Animated.Value(1.15)).current;   // bg zoom-in
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(0.72)).current;
  const ringScale1    = useRef(new Animated.Value(0.6)).current;
  const ringOpacity1  = useRef(new Animated.Value(0)).current;
  const ringScale2    = useRef(new Animated.Value(0.6)).current;
  const ringOpacity2  = useRef(new Animated.Value(0)).current;
  const ringScale3    = useRef(new Animated.Value(0.6)).current;
  const ringOpacity3  = useRef(new Animated.Value(0)).current;
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textY         = useRef(new Animated.Value(18)).current;
  const tagOpacity    = useRef(new Animated.Value(0)).current;
  const tagY          = useRef(new Animated.Value(14)).current;
  const barWidth      = useRef(new Animated.Value(0)).current;
  const barOpacity    = useRef(new Animated.Value(0)).current;
  const exitOpacity   = useRef(new Animated.Value(1)).current;
  const exitScale     = useRef(new Animated.Value(1)).current;

  // Ring pulse: repeating expanding circle (ripple effect)
  const ripple = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setHidden(true);

    // ── Ripple loop (starts early, runs throughout) ──────────────────────────
    const rippleLoop = Animated.loop(
      Animated.timing(ripple, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      })
    );
    rippleLoop.start();

    // ── Main sequence ────────────────────────────────────────────────────────
    Animated.sequence([
      // 1. Background settles (subtle zoom from 1.15 → 1.0)
      Animated.timing(bgScale, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      // 2. Three concentric rings expand in (staggered)
      Animated.stagger(120, [
        Animated.parallel([
          Animated.spring(ringScale1, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
          Animated.timing(ringOpacity1, { toValue: 0.35, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(ringScale2, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }),
          Animated.timing(ringOpacity2, { toValue: 0.22, duration: 400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.spring(ringScale3, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
          Animated.timing(ringOpacity3, { toValue: 0.12, duration: 400, useNativeDriver: true }),
        ]),
      ]),

      // 3. Logo pops in with spring
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]),

      // 4. Short breath
      Animated.delay(120),

      // 5. App name slides up + fades in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(textY, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 6. Tagline slides up
      Animated.parallel([
        Animated.timing(tagOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(tagY, {
          toValue: 0,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      // 7. Loading bar fills
      Animated.parallel([
        Animated.timing(barOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false, // width animation needs false
        }),
        Animated.timing(barWidth, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),

      // 8. Hold for a beat
      Animated.delay(300),

      // 9. Whole screen exits — zoom-out + fade
      Animated.parallel([
        Animated.timing(exitOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(exitScale, {
          toValue: 1.08,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      rippleLoop.stop();
      StatusBar.setHidden(false);
      onFinish();
    });
  }, []);

  // ── Derived animated styles ──────────────────────────────────────────────
  const rippleSize = W * 1.6;
  const rippleStyle = {
    opacity: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] }),
    transform: [{
      scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    }],
  };

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Use passed iconSource prop, or fall back to built-in paths
  const resolvedIcon = iconSource
    ?? (role === 'professor'
      ? require('../../assets/professor-icon.png')
      : require('../../assets/student-icon.png'));

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: exitOpacity, transform: [{ scale: exitScale }] },
      ]}
    >
      {/* ── Background with radial glow ─────────────────────────────────── */}
      <Animated.View
        style={[styles.bg, { transform: [{ scale: bgScale }] }]}
      />

      {/* ── Radial glow blob ────────────────────────────────────────────── */}
      <View style={styles.glowWrap} pointerEvents="none">
        <View style={styles.glowBlob} />
      </View>

      {/* ── Ripple ring ─────────────────────────────────────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ripple,
          { width: rippleSize, height: rippleSize, borderRadius: rippleSize / 2 },
          rippleStyle,
        ]}
      />

      {/* ── Decorative concentric rings ──────────────────────────────────── */}
      {[
        [ringScale1, ringOpacity1, W * 0.88],
        [ringScale2, ringOpacity2, W * 1.12],
        [ringScale3, ringOpacity3, W * 1.38],
      ].map(([scale, opacity, size], i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size as number,
              height: size as number,
              borderRadius: (size as number) / 2,
              opacity: opacity as Animated.Value,
              transform: [{ scale: scale as Animated.Value }],
            },
          ]}
        />
      ))}

      {/* ── Corner accent lines ─────────────────────────────────────────── */}
      <View style={styles.cornerTL} pointerEvents="none" />
      <View style={styles.cornerBR} pointerEvents="none" />

      {/* ── Centre content ──────────────────────────────────────────────── */}
      <View style={styles.centre}>

        {/* App icon */}
        <Animated.View style={[
          styles.iconWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}>
          {/* Glow behind icon */}
          <View style={styles.iconGlow} />
          <Image
            source={resolvedIcon}
            style={styles.icon}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App name */}
        <Animated.Text
          style={[
            styles.appName,
            {
              opacity: textOpacity,
              transform: [{ translateY: textY }],
            },
          ]}
        >
          Smart<Text style={styles.appNameAccent}>Attend</Text>
        </Animated.Text>

        {/* Role tagline */}
        <Animated.View style={[
          styles.tagRow,
          {
            opacity: tagOpacity,
            transform: [{ translateY: tagY }],
          },
        ]}>
          <View style={styles.tagDot} />
          <Text style={styles.tagline}>
            {role === 'professor' ? 'Professor Portal' : 'Student Portal'}
          </Text>
          <View style={styles.tagDot} />
        </Animated.View>

        {/* Loading bar */}
        <Animated.View style={[styles.loadingTrack, { opacity: barOpacity }]}>
          <Animated.View style={[styles.loadingBar, { width: barInterpolated }]} />
        </Animated.View>

      </View>

      {/* ── Bottom version line ─────────────────────────────────────────── */}
      <Animated.Text style={[styles.version, { opacity: tagOpacity }]}>
        v1.0  ·  SmartAttend
      </Animated.Text>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const ICON_SIZE = Math.min(W * 0.32, 148);
const BAR_W     = W * 0.46;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NAVY,
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBlob: {
    width: W * 0.9,
    height: W * 0.9,
    borderRadius: W * 0.45,
    backgroundColor: INDIGO,
    opacity: 0.07,
  },
  ripple: {
    position: 'absolute',
    alignSelf: 'center',
    top: H / 2 - (W * 1.6) / 2,
    borderWidth: 1.5,
    borderColor: INDIGO,
    backgroundColor: 'transparent',
  },
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    top: undefined,
    borderWidth: 1,
    borderColor: INDIGO,
    backgroundColor: 'transparent',
  },
  cornerTL: {
    position: 'absolute',
    top: 0, left: 0,
    width: W * 0.35, height: W * 0.35,
    borderTopWidth: 1.5, borderLeftWidth: 1.5,
    borderColor: INDIGO + '40',
    borderTopLeftRadius: 0,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: W * 0.35, height: W * 0.35,
    borderBottomWidth: 1.5, borderRightWidth: 1.5,
    borderColor: INDIGO + '40',
    borderBottomRightRadius: 0,
  },
  centre: {
    alignItems: 'center',
    gap: 0,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconGlow: {
    position: 'absolute',
    width: ICON_SIZE * 1.5,
    height: ICON_SIZE * 1.5,
    borderRadius: ICON_SIZE,
    backgroundColor: INDIGO,
    opacity: 0.18,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE * 0.26,
  },
  appName: {
    fontSize: 38,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: -1.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  appNameAccent: {
    color: MINT,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 36,
  },
  tagDot: {
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: INDIGO,
    opacity: 0.7,
  },
  tagline: {
    fontSize: 13,
    color: INDIGO + 'CC',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  loadingTrack: {
    width: BAR_W,
    height: 2,
    backgroundColor: INDIGO + '30',
    borderRadius: 1,
    overflow: 'hidden',
  },
  loadingBar: {
    height: 2,
    backgroundColor: MINT,
    borderRadius: 1,
    shadowColor: MINT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  version: {
    position: 'absolute',
    bottom: 36,
    fontSize: 11,
    color: WHITE + '30',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────
//
// STEP 1 — Copy image assets
//   Copy these files to:
//     apps/student-app/assets/student-icon.png       (1024×1024)
//     apps/student-app/assets/student-splash.png     (2048×2048)
//     apps/student-app/assets/adaptive-icon.png      (student-adaptive-icon.png)
//     apps/student-app/assets/favicon.png            (student-favicon.png)
//
//     apps/professor-app/assets/professor-icon.png
//     apps/professor-app/assets/professor-splash.png
//     apps/professor-app/assets/adaptive-icon.png    (professor-adaptive-icon.png)
//     apps/professor-app/assets/favicon.png          (professor-favicon.png)
//
//
// STEP 2 — Update app.json / app.config.ts for EACH app
//   "expo": {
//     "name": "SmartAttend Student",
//     "slug": "smartattend-student",
//     "icon": "./assets/student-icon.png",
//     "splash": {
//       "image": "./assets/student-splash.png",
//       "resizeMode": "cover",
//       "backgroundColor": "#0F172A"
//     },
//     "android": {
//       "adaptiveIcon": {
//         "foregroundImage": "./assets/adaptive-icon.png",
//         "backgroundColor": "#0F172A"
//       }
//     },
//     "web": { "favicon": "./assets/favicon.png" }
//   }
//
//
// STEP 3 — Install expo-splash-screen
//   npx expo install expo-splash-screen
//
//
// STEP 4 — Update your root _layout.tsx
//   Replace the default Expo splash handling with this pattern:
//
//   import * as SplashScreen from 'expo-splash-screen';
//   import AnimatedSplash from '../src/components/AnimatedSplash';
//   import { useState } from 'react';
//
//   // Keep native splash visible until our animated one is ready
//   SplashScreen.preventAutoHideAsync();
//
//   export default function RootLayout() {
//     const [showAnimated, setShowAnimated] = useState(true);
//     const [appReady, setAppReady] = useState(false);
//
//     // Hide native splash as soon as layout mounts, our component takes over
//     useEffect(() => {
//       SplashScreen.hideAsync();
//     }, []);
//
//     return (
//       <View style={{ flex: 1 }}>
//         {/* Your actual app */}
//         {appReady && <YourActualNavigator />}
//
//         {/* Our animated splash sits on top until done */}
//         {showAnimated && (
//           <AnimatedSplash
//             role="student"          // or "professor" in the professor app
//             onFinish={() => {
//               setShowAnimated(false);
//               setAppReady(true);
//             }}
//           />
//         )}
//       </View>
//     );
//   }
//
//
// STEP 5 — For professor app
//   Copy this file to:
//     apps/professor-app/src/components/AnimatedSplash.tsx
//   Change the require() paths to point to professor-icon.png
//   In _layout.tsx use  role="professor"
// ─────────────────────────────────────────────────────────────────────────────