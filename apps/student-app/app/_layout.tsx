// import { useEffect } from 'react';
// import { Stack } from 'expo-router';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import * as SplashScreen from 'expo-splash-screen';
// import { useAuthStore } from '../src/store/auth.store';
// import { registerForPushNotifications, setupNotificationListeners } from '../src/services/notifications';
// import { startLocationPing } from '../src/services/location';
// import { router } from 'expo-router';
// import api from '../src/services/api';

// SplashScreen.preventAutoHideAsync();

// export default function RootLayout() {
//   const { loadFromStorage, isLoading, isAuthenticated } = useAuthStore();

//   useEffect(() => {
//     loadFromStorage();
//   }, []);

//   useEffect(() => {
//     if (!isLoading) {
//       SplashScreen.hideAsync();
//     }
//   }, [isLoading]);

//   // Inside component, add this useEffect:
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

//   useEffect(() => {
//     if (!isAuthenticated) return;

//     // Register push notifications
//     registerForPushNotifications().catch(console.error);

//     // Start background location pinging
//     startLocationPing().catch(console.error);

//     // Listen for attendance notifications
//     const cleanup = setupNotificationListeners((payload) => {
//       // Foreground notification received — navigate to verify
//       router.push({
//         pathname: '/verify',
//         params: {
//           session_id: payload.session_id,
//           course_name: payload.course_name,
//           professor_name: payload.professor_name,
//           expires_at: payload.expires_at,
//           challenges: payload.challenges,
//         },
//       });
//     });

//     return cleanup;
//   }, [isAuthenticated]);

//   if (isLoading) return null;

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//       <Stack screenOptions={{ headerShown: false }}>
//         <Stack.Screen name="(auth)" options={{ headerShown: false }} />
//         <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
//         <Stack.Screen
//           name="verify"
//           options={{
//             headerShown: false,
//             presentation: 'fullScreenModal',
//             gestureEnabled: false, // prevent swipe-to-dismiss during verification
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
//     </GestureHandlerRootView>
//   );
// }








import { useEffect } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/store/auth.store';
import { registerForPushNotifications } from '../src/services/notifications';
import { startLocationPing } from '../src/services/location';
import api from '../src/services/api';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { loadFromStorage, isLoading, isAuthenticated } = useAuthStore();
  const router = useRouter();
  
  // Catches notifications tapped while app was completely closed or in background
  const lastNotificationResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Register push token
  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().then(async (token) => {
        if (token) {
          try {
            await api.post('/students/fcm-token', { fcm_token: token });
            console.log('✅ Push token registered:', token);
          } catch (err) {
            console.error('Failed to save push token:', err);
          }
        }
      });
    }
  }, [isAuthenticated]);

  // Unified navigation handler for attendance
  const handleAttendanceNavigation = (data: any) => {
    if (data && (data.type === 'ATTENDANCE_REQUEST' || data.type === 'ATTENDANCE_SESSION_STARTED')) {
      console.log('🔔 Navigating to verify:', data);

      const challengesStr = typeof data.challenges === 'string' 
        ? data.challenges 
        : JSON.stringify(data.challenges || "[]");

      // 500ms delay ensures Auth routing to (tabs) finishes before pushing the modal
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

  // 1. Handle app opened from background via notification
  useEffect(() => {
    if (isAuthenticated && lastNotificationResponse) {
      const data = lastNotificationResponse.notification.request.content.data;
      handleAttendanceNavigation(data);
    }
  }, [lastNotificationResponse, isAuthenticated]);

  // 2. Handle app opened in foreground via notification
  useEffect(() => {
    if (!isAuthenticated) return;

    startLocationPing().catch(console.error);

    const tapSub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      handleAttendanceNavigation(data);
    });

    return () => {
      tapSub.remove();
    };
  }, [isAuthenticated]);

  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
    </GestureHandlerRootView>
  );
}