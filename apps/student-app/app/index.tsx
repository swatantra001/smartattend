import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';

export default function Index() {
  console.log('✅ Index rendered');
  const { isAuthenticated } = useAuthStore();
  console.log('✅ Auth state:', isAuthenticated);
  return <Redirect href={isAuthenticated ? '/(tabs)/home' : '/(auth)/login'} />;
}