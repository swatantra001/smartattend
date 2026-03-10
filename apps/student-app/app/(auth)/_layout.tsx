import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}