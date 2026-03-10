import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../src/store/auth.store';
import { connectSocket, disconnectSocket } from '../src/services/socket';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
	console.log('✅ RootLayout rendered');

	const { loadFromStorage, isLoading, isAuthenticated, accessToken } = useAuthStore();
	console.log('✅ Store loaded, isLoading:', isLoading);

	useEffect(() => { loadFromStorage(); }, []);

	useEffect(() => {
		if (!isLoading) SplashScreen.hideAsync();
	}, [isLoading]);

	useEffect(() => {
		if (isAuthenticated && accessToken) {
			connectSocket(accessToken);
		} else {
			disconnectSocket();
		}
		return () => { disconnectSocket(); };
	}, [isAuthenticated, accessToken]);

	if (isLoading) return null;

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
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
			</Stack>
		</GestureHandlerRootView>
	);
}