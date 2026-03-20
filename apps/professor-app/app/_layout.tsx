// import { useEffect } from 'react';
// import { Stack } from 'expo-router';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import * as SplashScreen from 'expo-splash-screen';
// import { useAuthStore } from '../src/store/auth.store';
// import { connectSocket, disconnectSocket } from '../src/services/socket';

// SplashScreen.preventAutoHideAsync();

// export default function RootLayout() {
// 	console.log('✅ RootLayout rendered');

// 	const { loadFromStorage, isLoading, isAuthenticated, accessToken } = useAuthStore();
// 	console.log('✅ Store loaded, isLoading:', isLoading);

// 	useEffect(() => { loadFromStorage(); }, []);

// 	useEffect(() => {
// 		if (!isLoading) SplashScreen.hideAsync();
// 	}, [isLoading]);

// 	useEffect(() => {
// 		if (isAuthenticated && accessToken) {
// 			connectSocket(accessToken);
// 		} else {
// 			disconnectSocket();
// 		}
// 		return () => { disconnectSocket(); };
// 	}, [isAuthenticated, accessToken]);

// 	if (isLoading) return null;

// 	return (
// 		<GestureHandlerRootView style={{ flex: 1 }}>
// 			<Stack screenOptions={{ headerShown: false }}>
// 				{/* <Stack.Screen name="(auth)" /> */}
// 				<Stack.Screen name="index" />
// 				<Stack.Screen name="(auth)/login" />
// 				<Stack.Screen name="(tabs)" />
// 				<Stack.Screen
// 					name="dashboard/[sessionId]"
// 					options={{
// 						headerShown: false,
// 						presentation: 'fullScreenModal',
// 						gestureEnabled: false,
// 					}}
// 				/>
// 			</Stack>
// 		</GestureHandlerRootView>
// 	);
// }
















// D:\smartattend\apps\professor-app\app\_layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Changes vs original:
//   1. AnimatedSplash injected — renders on top of everything until done,
//      then unmounts. All existing logic (auth, socket) is 100% unchanged.
//   2. showSplash state: starts true, set to false in onFinish callback.
//   3. Native SplashScreen is hidden as soon as isLoading clears (unchanged).
//      Our AnimatedSplash immediately takes visual control so there's no
//      white flash between the native splash and the app.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/auth.store';
import { connectSocket, disconnectSocket } from '../src/services/socket';
import AnimatedSplash from '../src/components/AnimatedSplash';
import CourseEvaluationReportScreen from '../screens/CourseEvaluationReportScreen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  console.log('✅ RootLayout rendered');

  const { loadFromStorage, isLoading, isAuthenticated, accessToken } = useAuthStore();
  console.log('✅ Store loaded, isLoading:', isLoading);

  // ── Animated splash state ─────────────────────────────────────────────────
  // animReady: true once native splash is hidden and it's safe to animate.
  // splashDone: true once our animation calls onFinish — unmounts the overlay.
  const [animReady, setAnimReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  // ── Load auth from storage ────────────────────────────────────────────────
  useEffect(() => { loadFromStorage(); }, []);

  // ── Hide native splash + gate animated splash ─────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync().then(() => {
        setAnimReady(true);
      });
    }
  }, [isLoading]);

  // ── Socket connect / disconnect ───────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
    } else {
      disconnectSocket();
    }
    return () => { disconnectSocket(); };
  }, [isAuthenticated, accessToken]);

  // ── Don't render anything until auth storage is loaded ───────────────────
  if (isLoading) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* ── App navigator ────────────────────────────────────────────────── */}
      <Stack screenOptions={{ headerShown: false }}>
        {/* <Stack.Screen name="(auth)" /> */}
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="dashboard/[sessionId]"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            gestureEnabled: false,
          }}
        />
        <Stack.Screen name="CourseEvalReport" options={{ headerShown: false }} />
        <Stack.Screen
          name="EvaluationReport"
          options={{
            headerShown: true,
            title: 'AI Evaluation Report',
            headerBackTitle: 'Back' // Optional: Gives a nice "Back" text next to the arrow on iOS
          }}
        />
      </Stack>

      {/* ── Animated splash — overlaid on top of the navigator ───────────────
          Rendered AFTER the Stack so it sits above everything in z-order.
          Only mounts once animReady is true (native splash has been hidden).
          Unmounts permanently once the animation calls onFinish.              ── */}
      {animReady && !splashDone && (
        <AnimatedSplash
          role="professor"
          iconSource={require('../assets/professor-icon.png')}
          onFinish={() => setSplashDone(true)}
        />
      )}
    </GestureHandlerRootView>
  );
}