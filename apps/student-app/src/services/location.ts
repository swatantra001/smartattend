import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { LocationAPI } from './api';

export const LOCATION_TASK = 'BACKGROUND_LOCATION_PING';

// Safely check if we are running inside the Expo Go app
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ── Define background task (only used in production APK) ─────────────────
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations = data?.locations;
  if (!locations || locations.length === 0) return;
  const { latitude, longitude, accuracy } = locations[0].coords;
  try {
    // Only ping if accuracy is reasonably good (under 100m) to avoid bad background data
    if (accuracy && accuracy <= 100) {
      await LocationAPI.ping(latitude, longitude, accuracy);
    }
  } catch {
    // Silently fail — background task cannot show UI
  }
});

// ── Request permissions ───────────────────────────────────────────────────
export async function requestLocationPermissions(): Promise<boolean> {
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') return false;

  // Skip background permission request in Expo Go — it crashes
  if (isExpoGo) return true;

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  return background === 'granted';
}

// ── Start location pinging ────────────────────────────────────────────────
export async function startLocationPing(): Promise<void> {
  const hasPermission = await requestLocationPermissions();
  if (!hasPermission) return;

  // In Expo Go: just do a one-shot ping, no background service
  if (isExpoGo) {
    const location = await getCurrentLocation();
    if (location) {
      try {
        await LocationAPI.ping(location.lat, location.lng, location.accuracy);
        console.log('✅ Location pinged (Expo Go one-shot):', location);
      } catch (err) {
        console.warn('Location ping failed:', err);
      }
    }
    return;
  }

  // Production APK: full background tracking
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) return;

  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High, // Bumped to High for GPS accuracy
    timeInterval: 60000,
    distanceInterval: 15, // Update if they move 15 meters
    deferredUpdatesInterval: 60000,
    deferredUpdatesDistance: 15,
    showsBackgroundLocationIndicator: false,
    foregroundService: {
      notificationTitle: 'SmartAttend',
      notificationBody: 'Monitoring classroom location',
      notificationColor: '#1F4E79',
    },
    pausesUpdatesAutomatically: false,
  });
}

// ── Stop background pinging ───────────────────────────────────────────────
export async function stopLocationPing(): Promise<void> {
  if (isExpoGo) return;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

// ── One-shot location fetch (with GPS warmup loop) ────────────────────────
export async function getCurrentLocation(maxRetries = 3): Promise<{
  lat: number;
  lng: number;
  accuracy: number;
} | null> {
  let bestLocation = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Forces physical GPS chip on
      });

      const acc = location.coords.accuracy ?? 999;
      
      // Save the best reading we find
      if (!bestLocation || acc < bestLocation.accuracy) {
        bestLocation = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          accuracy: acc,
        };
      }

      // If we hit our target of < 50m error, stop trying and return immediately
      if (acc <= 50) {
        return bestLocation;
      }

      // If accuracy is poor (e.g. 180m), wait 1.5 seconds for satellites to lock, then try again
      await new Promise(resolve => setTimeout(resolve, 1500));
    } catch {
      break;
    }
  }

  // Return the best location we could find after exhausting retries
  return bestLocation;
}












// import * as Location from 'expo-location';
// import * as TaskManager from 'expo-task-manager';
// import Constants from 'expo-constants';
// import { LocationAPI } from './api';

// export const LOCATION_TASK = 'BACKGROUND_LOCATION_PING';

// const isExpoGo = Constants.appOwnership === 'expo';

// // ── Define background task (only used in production APK) ─────────────────
// TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
//   if (error) return;
//   const locations = data?.locations;
//   if (!locations || locations.length === 0) return;
//   const { latitude, longitude, accuracy } = locations[0].coords;
//   try {
//     await LocationAPI.ping(latitude, longitude, accuracy ?? undefined);
//   } catch {
//     // Silently fail — background task cannot show UI
//   }
// });

// // ── Request permissions ───────────────────────────────────────────────────
// export async function requestLocationPermissions(): Promise<boolean> {
//   const { status: foreground } = await Location.requestForegroundPermissionsAsync();
//   if (foreground !== 'granted') return false;

//   // Skip background permission request in Expo Go — it crashes
//   if (isExpoGo) return true;

//   const { status: background } = await Location.requestBackgroundPermissionsAsync();
//   return background === 'granted';
// }

// // ── Start location pinging ────────────────────────────────────────────────
// export async function startLocationPing(): Promise<void> {
//   const hasPermission = await requestLocationPermissions();
//   if (!hasPermission) return;

//   // In Expo Go: just do a one-shot ping, no background service
//   if (isExpoGo) {
//     const location = await getCurrentLocation();
//     if (location) {
//       try {
//         await LocationAPI.ping(location.lat, location.lng, location.accuracy);
//         console.log('✅ Location pinged (Expo Go one-shot):', location);
//       } catch (err) {
//         console.warn('Location ping failed:', err);
//       }
//     }
//     return;
//   }

//   // Production APK: full background tracking
//   const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
//   if (isRegistered) return;

//   await Location.startLocationUpdatesAsync(LOCATION_TASK, {
//     accuracy: Location.Accuracy.Balanced,
//     timeInterval: 60000,
//     distanceInterval: 50,
//     deferredUpdatesInterval: 60000,
//     deferredUpdatesDistance: 50,
//     showsBackgroundLocationIndicator: false,
//     foregroundService: {
//       notificationTitle: 'SmartAttend',
//       notificationBody: 'Monitoring classroom location',
//       notificationColor: '#1F4E79',
//     },
//     pausesUpdatesAutomatically: false,
//   });
// }

// // ── Stop background pinging ───────────────────────────────────────────────
// export async function stopLocationPing(): Promise<void> {
//   if (isExpoGo) return; // nothing to stop in Expo Go

//   const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
//   if (isRegistered) {
//     await Location.stopLocationUpdatesAsync(LOCATION_TASK);
//   }
// }

// // ── One-shot location fetch ───────────────────────────────────────────────
// export async function getCurrentLocation(): Promise<{
//   lat: number;
//   lng: number;
//   accuracy: number;
// } | null> {
//   try {
//     const location = await Location.getCurrentPositionAsync({
//       accuracy: Location.Accuracy.High,
//     });
//     return {
//       lat: location.coords.latitude,
//       lng: location.coords.longitude,
//       accuracy: location.coords.accuracy ?? 0,
//     };
//   } catch {
//     return null;
//   }
// }