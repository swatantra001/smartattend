// import { useEffect, useState } from 'react';
// import { View } from 'react-native';
// import { Stack, useRouter } from 'expo-router';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import * as SplashScreen from 'expo-splash-screen';
// import * as Notifications from 'expo-notifications';
// import { useAuthStore } from '../src/store/auth.store';
// import { registerForPushNotifications } from '../src/services/notifications';
// import { startLocationPing } from '../src/services/location';
// import api from '../src/services/api';
// import AnimatedSplash from '../src/components/AnimatedSplash';

// SplashScreen.preventAutoHideAsync();

// export default function RootLayout() {
//   const { loadFromStorage, isLoading, isAuthenticated } = useAuthStore();
//   const router = useRouter();

//   // ── Animated splash state ─────────────────────────────────────────────────
//   // Stays true until our AnimatedSplash calls onFinish.
//   // We wait for isLoading to clear first so auth state is ready when the
//   // animation ends and the app is revealed.
//   const [splashDone,    setSplashDone]    = useState(false);
//   const [animReady,     setAnimReady]     = useState(false); // gate: only start animation after native splash hides

//   const lastNotificationResponse = Notifications.useLastNotificationResponse();

//   // ── Load auth from storage ────────────────────────────────────────────────
//   useEffect(() => {
//     loadFromStorage();
//   }, []);

//   // ── Hide native splash + start animated splash ────────────────────────────
//   useEffect(() => {
//     if (!isLoading) {
//       // Hide the Expo native splash — our AnimatedSplash takes over visually
//       SplashScreen.hideAsync().then(() => {
//         setAnimReady(true); // now safe to show our animation
//       });
//     }
//   }, [isLoading]);

//   // ── Register push token ───────────────────────────────────────────────────
//   useEffect(() => {
//     if (isAuthenticated) {
//       registerForPushNotifications().then(async (token) => {
//         if (token) {
//           try {
//             await api.post('/students/fcm-token', { fcm_token: token });
//             console.log('✅ Push token registered:', token);
//           } catch (err) {
//             console.error('Failed to save push token:', err);
//           }
//         }
//       });
//     }
//   }, [isAuthenticated]);

//   // ── Navigation handler for attendance notifications ───────────────────────
//   const handleAttendanceNavigation = (data: any) => {
//     if (
//       data &&
//       (data.type === 'ATTENDANCE_REQUEST' || data.type === 'ATTENDANCE_SESSION_STARTED')
//     ) {
//       console.log('🔔 Navigating to verify:', data);
//       const challengesStr =
//         typeof data.challenges === 'string'
//           ? data.challenges
//           : JSON.stringify(data.challenges || '[]');

//       // 500ms delay ensures Auth routing to (tabs) finishes before pushing the modal
//       setTimeout(() => {
//         router.push({
//           pathname: '/verify',
//           params: {
//             session_id:     String(data.session_id    || ''),
//             course_name:    String(data.course_name   || 'Course'),
//             professor_name: String(data.professor_name || 'Professor'),
//             expires_at:     String(data.expires_at    || new Date().toISOString()),
//             challenges:     challengesStr,
//           },
//         });
//       }, 500);
//     }
//   };

//   // ── App opened from background via notification ───────────────────────────
//   useEffect(() => {
//     if (isAuthenticated && lastNotificationResponse) {
//       const data = lastNotificationResponse.notification.request.content.data;
//       handleAttendanceNavigation(data);
//     }
//   }, [lastNotificationResponse, isAuthenticated]);

//   // ── Foreground notification listener + location ping ─────────────────────
//   useEffect(() => {
//     if (!isAuthenticated) return;

//     startLocationPing().catch(console.error);

//     const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
//       const data = response.notification.request.content.data;
//       handleAttendanceNavigation(data);
//     });

//     return () => { tapSub.remove(); };
//   }, [isAuthenticated]);

//   // ── Don't render anything until auth storage is loaded ───────────────────
//   if (isLoading) return null;

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       {/* ── App navigator ────────────────────────────────────────────────── */}
//       <Stack screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="(auth)"      options={{ headerShown: false }} />
//         <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
//         <Stack.Screen
//           name="verify"
//           options={{
//             headerShown: false,
//             presentation: 'fullScreenModal',
//             gestureEnabled: false,
//           }}
//         />
//         <Stack.Screen
//           name="enroll-face"
//           options={{
//             headerShown: true,
//             title: 'Face Enrollment',
//             headerStyle: { backgroundColor: '#1F4E79' },
//             headerTintColor: '#FFFFFF',
//           }}
//         />
//       </Stack>

//       {/* ── Animated splash — overlaid on top of the navigator ───────────────
//           Rendered AFTER the Stack so it sits above everything in z-order.
//           Only mounts once animReady is true (native splash has been hidden).
//           Unmounts permanently once the animation calls onFinish.              ── */}
//       {animReady && !splashDone && (
//         <AnimatedSplash
//           role="student"
//           iconSource={require('../assets/student-icon.png')}
//           onFinish={() => setSplashDone(true)}
//         />
//       )}
//     </GestureHandlerRootView>
//   );
// }






import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, TouchableOpacity, Linking, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location'; // 🟢 INJECTED LOCATION
import { Ionicons } from '@expo/vector-icons'; // 🟢 INJECTED ICONS
import { useAuthStore } from '../src/store/auth.store';
import { registerForPushNotifications } from '../src/services/notifications';
import { startLocationPing } from '../src/services/location';
import api from '../src/services/api';
import AnimatedSplash from '../src/components/AnimatedSplash';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadFromStorage, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [splashDone, setSplashDone] = useState(false);
  const [animReady, setAnimReady] = useState(false); 
  
  // 🟢 NEW: State to track if GPS hardware is turned on
  const [isLocationEnabled, setIsLocationEnabled] = useState(true);

  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  // ── Load auth from storage ────────────────────────────────────────────────
  useEffect(() => {
    loadFromStorage();
  }, []);

  // ── Hide native splash + start animated splash ────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().then(() => {
        setAnimReady(true);
      });
    }
  }, [isLoading]);

  // ── 🟢 NEW: GLOBAL LOCATION WATCHER ───────────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkLocationStatus = async () => {
      try {
        // Checks if the actual phone GPS is turned on/off
        const status = await Location.getProviderStatusAsync();
        setIsLocationEnabled(status.locationServicesEnabled);
      } catch (error) {
        console.error("Location status check failed:", error);
      }
    };

    // 1. Check immediately
    checkLocationStatus();

    // 2. Check every time the app comes to the foreground (e.g. returning from settings)
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkLocationStatus();
      }
    });

    // 3. Poll every 3 seconds to catch quick-setting pull-down toggles
    interval = setInterval(checkLocationStatus, 3000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, []);

  // ── Register push token ───────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().then(async (token) => {
        if (token) {
          try {
            await api.post('/students/fcm-token', { fcm_token: token });
          } catch (err) {}
        }
      });
    }
  }, [isAuthenticated]);

  // ── Navigation handler for attendance notifications ───────────────────────
  const handleAttendanceNavigation = (data: any) => {
    if (data && (data.type === 'ATTENDANCE_REQUEST' || data.type === 'ATTENDANCE_SESSION_STARTED')) {
      const challengesStr = typeof data.challenges === 'string' 
        ? data.challenges : JSON.stringify(data.challenges || '[]');

      setTimeout(() => {
        router.push({
          pathname: '/verify',
          params: {
            session_id: String(data.session_id || ''),
            course_name: String(data.course_name || 'Course'),
            professor_name: String(data.professor_name || 'Professor'),
            expires_at: String(data.expires_at || new Date().toISOString()),
            challenges: challengesStr,
          },
        });
      }, 500);
    }
  };

  // ── Foreground/Background notification listeners ─────────────────────────
  useEffect(() => {
    if (isAuthenticated && lastNotificationResponse) {
      handleAttendanceNavigation(lastNotificationResponse.notification.request.content.data);
    }
  }, [lastNotificationResponse, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    startLocationPing().catch(console.error);
    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      handleAttendanceNavigation(response.notification.request.content.data);
    });
    return () => { tapSub.remove(); };
  }, [isAuthenticated]);


  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)"      options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)"      options={{ headerShown: false }} />
        <Stack.Screen
          name="verify"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="enroll-face"
          options={{
            headerShown: true,
            title: 'Face Enrollment',
            headerStyle: { backgroundColor: '#1F4E79' },
            headerTintColor: '#FFFFFF',
          }}
        />
      </Stack>

      {/* ── Animated splash ── */}
      {animReady && !splashDone && (
        <AnimatedSplash
          role="student"
          iconSource={require('../assets/student-icon.png')}
          onFinish={() => setSplashDone(true)}
        />
      )}

      {/* ── 🟢 NEW: THE GHOST WARNING OVERLAY ── 
          Only show if the splash screen is done, the user is logged in, 
          and they turned off their location.
      */}
      {splashDone && isAuthenticated && !isLocationEnabled && (
        <View style={styles.ghostOverlay}>
          <Ionicons name="location-outline" size={80} color="#EF4444" />
          <Text style={styles.ghostTitle}>Location Required</Text>
          <Text style={styles.ghostText}>
            SmartAttend requires your device's GPS to be turned on to verify classroom attendance.
          </Text>
          <Text style={styles.ghostSubText}>
            Please turn on your location to continue using the app.
          </Text>
        </View>
      )}

    </GestureHandlerRootView>
  );
}

// ── 🟢 NEW: STYLES FOR THE GHOST OVERLAY ────────────────────────────────────
const styles = StyleSheet.create({
  ghostOverlay: {
    ...StyleSheet.absoluteFillObject, // Covers the entire screen
    backgroundColor: 'rgba(15, 23, 42, 0.98)', // Very dark slate, almost solid
    zIndex: 99999, // Ensures it sits above EVERYTHING else
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  ghostTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  ghostText: {
    color: '#cbd5e1',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  ghostSubText: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  }
});