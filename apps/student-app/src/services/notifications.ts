// import * as Notifications from 'expo-notifications';
// import * as TaskManager from 'expo-task-manager';
// import * as SecureStore from 'expo-secure-store';
// import { Platform } from 'react-native';
// import { router } from 'expo-router';

// export const ATTENDANCE_TASK = 'ATTENDANCE_NOTIFICATION_HANDLER';

// // Configure foreground notification behavior
// Notifications.setNotificationHandler({
//   handleNotification: async (notification) => {
//     const data = notification.request.content.data as any;

//     // Attendance notifications: show banner + sound even in foreground
//     if (data?.type === 'ATTENDANCE_REQUEST') {
//       return {
//         shouldShowAlert: true,
//         shouldPlaySound: true,
//         shouldSetBadge: true,
//       };
//     }

//     return {
//       shouldShowAlert: true,
//       shouldPlaySound: false,
//       shouldSetBadge: false,
//     };
//   },
// });

// // ── Register for push notifications ───────────────────────────────────────
// export async function registerForPushNotifications(): Promise<string | null> {
//   try {
//     // Check existing permissions
//     const { status: existingStatus } = await Notifications.getPermissionsAsync();
//     let finalStatus = existingStatus;

//     if (existingStatus !== 'granted') {
//       const { status } = await Notifications.requestPermissionsAsync();
//       finalStatus = status;
//     }

//     if (finalStatus !== 'granted') {
//       return null;
//     }

//     // Create notification channel for Android
//     if (Platform.OS === 'android') {
//       await Notifications.setNotificationChannelAsync('attendance', {
//         name: 'Attendance Notifications',
//         importance: Notifications.AndroidImportance.MAX,
//         vibrationPattern: [0, 250, 250, 250],
//         lightColor: '#1F4E79',
//         sound: 'notification.wav',
//         enableVibrate: true,
//         showBadge: true,
//       });
//     }

//     // // Get FCM/APNs token
//     // const tokenData = await Notifications.getExpoPushTokenAsync({
//     //   projectId: 'e1d358e7-eb20-439d-be1c-c198acd02181',
//     // });

//     // const token = tokenData.data;
//     // await SecureStore.setItemAsync('fcm_token', token);
//     // return token;


//     // ✅ Use getDevicePushTokenAsync instead of getExpoPushTokenAsync
//     // getExpoPushTokenAsync requires Expo's push service + Firebase initialized via Expo config
//     // getDevicePushTokenAsync gets the raw FCM token directly — works in custom builds
//     const tokenData = await Notifications.getDevicePushTokenAsync();
//     const token = tokenData.data as string;

//     console.log('[Notifications] FCM token:', token);
//     await SecureStore.setItemAsync('fcm_token', token);
//     return token;

//   } catch (err) {
//     // Non-fatal — app works without push notifications
//     console.warn('[Notifications] Push registration failed:', err);
//     return null;
//   }
// }

// // ── Listen for incoming notifications (foreground) ────────────────────────
// export function setupNotificationListeners(
//   onAttendanceRequest: (payload: any) => void
// ) {
//   // Received while app is foregrounded
//   const receivedSub = Notifications.addNotificationReceivedListener(
//     (notification) => {
//       const data = notification.request.content.data as any;
//       if (data?.type === 'ATTENDANCE_REQUEST') {
//         onAttendanceRequest(data);
//       }
//     }
//   );

//   // Tapped from notification tray
//   const responseSub = Notifications.addNotificationResponseReceivedListener(
//     (response) => {
//       const data = response.notification.request.content.data as any;
//       if (data?.type === 'ATTENDANCE_REQUEST') {
//         // Navigate directly to verification screen
//         router.push({
//           pathname: '/verify',
//           params: {
//             session_id: data.session_id,
//             course_name: data.course_name,
//             professor_name: data.professor_name,
//             expires_at: data.expires_at,
//             challenges: data.challenges,
//           },
//         });
//       }
//     }
//   );

//   return () => {
//     receivedSub.remove();
//     responseSub.remove();
//   };
// }














import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as any;

    // Show banner + sound for ALL attendance-related events
    if (
      data?.type === 'ATTENDANCE_REQUEST' ||
      data?.type === 'ATTENDANCE_REVOKED' ||
      data?.type === 'ATTENDANCE_OVERRIDE' ||
      data?.type === 'SESSION_WARNING' ||
      data?.type === 'DEVICE_RESET_APPROVED' ||  // <-- Add this
      data?.type === 'DEVICE_RESET_REJECTED' ||  // <-- Add this
      data?.type === 'FACE_RESET_APPROVED' ||    // <-- Add this
      data?.type === 'FACE_RESET_REJECTED'       // <-- Add this
    ) {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

// ── Register for push notifications ───────────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('attendance', {
        name: 'Attendance Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1F4E79',
        sound: 'notification.wav',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    const token = tokenData.data as string;

    console.log('[Notifications] FCM token:', token);
    await SecureStore.setItemAsync('fcm_token', token);
    return token;

  } catch (err) {
    console.warn('[Notifications] Push registration failed:', err);
    return null;
  }
}

// ── Listen for incoming notifications (foreground & background) ───────────
export function setupNotificationListeners(
  onAttendanceRequest: (payload: any) => void
) {
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification) => {
      const data = notification.request.content.data as any;
      if (data?.type === 'ATTENDANCE_REQUEST') {
        onAttendanceRequest(data);
      }
    }
  );

  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as any;
      
      // 1. Initial Request -> Go to Verify Screen
      if (data?.type === 'ATTENDANCE_REQUEST') {
        router.push({
          pathname: '/verify',
          params: {
            session_id: data.session_id,
            course_name: data.course_name,
            professor_name: data.professor_name,
            expires_at: data.expires_at,
            challenges: data.challenges,
          },
        });
      } 
      // 2. Revoked (Scene failed) or Expiring Soon -> Go to Home to see active session banner
      else if (data?.type === 'ATTENDANCE_REVOKED' || data?.type === 'SESSION_WARNING') {
        router.push('/(tabs)/home');
      } 
      // 3. Manual Override -> Go to History to see the result
      else if (data?.type === 'ATTENDANCE_OVERRIDE') {
        router.push('/(tabs)/attendance');
      }
    }
  );

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}