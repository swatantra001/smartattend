import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { useAuthStore } from '../../src/store/auth.store';
import { COLORS } from '../../src/constants';
import { MaterialIcons } from '@expo/vector-icons';


export default function ProfessorTabsLayout() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/(auth)/login');
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
          paddingBottom: 8, paddingTop: 8, height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ size }) => <Text style={{ fontSize: size * 0.85 }}>🏠</Text>,
        }}
      />
        <Tabs.Screen
          name="session"
          options={{
            title: 'Sessions',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="fact-check" size={size} color={color} />
            ),
          }}
        />
        {/* 🚀 NEW ASSIGNMENTS TAB INJECTED HERE */}
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Assignments',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment" size={size} color={color} />
          ),
        }}
      />
        <Tabs.Screen
          name="reports"
          options={{
            title: 'Reports',
            tabBarIcon: ({ size }) => <Text style={{ fontSize: size * 0.85 }}>📊</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ size }) => <Text style={{ fontSize: size * 0.85 }}>👤</Text>,
          }}
        />
      </Tabs>
      );
}