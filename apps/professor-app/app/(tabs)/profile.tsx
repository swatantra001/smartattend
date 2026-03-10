import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { useSessionStore } from '../../src/store/session.store';
import { AuthAPI } from '../../src/services/api';
import { disconnectSocket } from '../../src/services/socket';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

export default function ProfessorProfileScreen() {
  const { user, clearAuth } = useAuthStore();
  const { clearSession } = useSessionStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await AuthAPI.logout(user!.user_id); } catch {}
          disconnectSocket();
          clearSession();
          await clearAuth();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.code}>Prof. • {user?.employee_code}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Details</Text>
          {[
            ['Email', user?.email ?? '-'],
            ['Employee Code', user?.employee_code ?? '-'],
            ['Role', 'Professor'],
          ].map(([label, value]) => (
            <View key={label} style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Text style={styles.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.logoutBtnText}>🚪 Logout</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>SmartAttend v1.0.0 • Professor App</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, alignItems: 'center',
    paddingVertical: SPACING.xl, paddingHorizontal: SPACING.lg,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  avatarText: { fontSize: 36, color: COLORS.white, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  code: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    margin: SPACING.md, marginBottom: 0, padding: SPACING.md,
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: 14, color: COLORS.textSecondary },
  rowValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  logoutBtn: {
    backgroundColor: COLORS.danger, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center',
  },
  logoutBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  version: {
    textAlign: 'center', color: COLORS.textMuted,
    fontSize: 12, padding: SPACING.lg,
  },
});