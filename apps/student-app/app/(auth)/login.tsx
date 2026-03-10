import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { AuthAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth.store';
import { COLORS, SPACING, RADIUS } from '../../src/constants';
import { Ionicons } from '@expo/vector-icons'; // Import icons


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);


  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const res = await AuthAPI.login(email.trim().toLowerCase(), password);
      const { access_token, refresh_token, user } = res.data.data;

      if (user.role !== 'STUDENT') {
        Alert.alert('Error', 'Please use the Student app to login.');
        return;
      }

      await setAuth(user, access_token, refresh_token);
      router.replace('/(tabs)/home');
    } catch (err: any) {
        console.error("FULL LOGIN ERROR:", err); // <--- Add this

      const msg = err.response?.data?.error || 'Login failed. Please try again.';

      if (err.response?.data?.code === 'DEVICE_MISMATCH') {
        Alert.alert(
          'Device Not Recognized',
          'This account is linked to another device. Would you like to request a device reset?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Request Reset', onPress: () => router.push('/(auth)/device-reset') },
          ]
        );
        return;
      }

      if (err.response?.data?.code === 'RESET_PENDING') {
        Alert.alert(
          'Reset Pending',
          'Your device reset request is pending admin approval. You will be notified when approved.'
        );
        return;
      }

      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>SmartAttend</Text>
          <Text style={styles.subtitle}>Student Portal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={styles.label}>Password</Text>
          <View>
            <TextInput
              style={styles.input}
              placeholder="Your password"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword} // Toggle based on state
              autoComplete="password"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* ── NEW: Forgot Password Button ── */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/(auth)/forgot-password')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          SmartAttend • Secure Attendance System
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logo: {
    fontSize: 40,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
  },
  form: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  // Added styling for the Forgot Password button
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  passwordInput: {
    flex: 1, // Take up remaining space
    padding: SPACING.md,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  eyeIcon: {
    position: 'absolute',
    right: SPACING.xs,
    top: SPACING.md + 2, // Adjusted to align with input text
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: SPACING.xl,
    fontSize: 12,
  },
});