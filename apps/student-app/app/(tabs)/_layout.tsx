import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../../src/store/auth.store';
import { COLORS } from '../../src/constants';

export default function TabsLayout() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="🏠" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="📋" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon emoji="👤" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji, size }: { emoji: string; color: string; size: number }) {
  return (
    <Text style={{ fontSize: size * 0.85 }}>{emoji}</Text>
  );
}

// Text import needed for TabIcon
import { Text } from 'react-native';