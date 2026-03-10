// D:\smartattend\apps\student-app\app\(auth)\forgot-password.tsx
// NEW FILE — OTP-based password reset

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, SPACING, RADIUS } from '../../src/constants';
import { Ionicons } from '@expo/vector-icons'; // Import icons


const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

type Step = 'identifier' | 'otp' | 'password';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  async function requestOtp() {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or roll number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setStep('otp');
        Alert.alert(
          'OTP Sent',
          'If your identifier is registered, you will receive an OTP on your registered email.'
        );
      } else {
        Alert.alert('Error', data.error || 'Failed to send OTP');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function verifyOtp() {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter the 6-digit OTP');
      return;
    }
    setStep('password');
  }

  async function resetPassword() {
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Password reset successfully! Please login.', [
          { text: 'Login', onPress: () => router.replace('/(auth)/login') }
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to reset password');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.back} onPress={() => {
        if (step === 'otp') setStep('identifier');
        else if (step === 'password') setStep('otp');
        else router.back();
      }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Reset Password</Text>

      {/* Step indicators */}
      <View style={styles.steps}>
        {['identifier', 'otp', 'password'].map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={[styles.stepDot, step === s && styles.stepDotActive,
            (['otp', 'password'].includes(step) && s === 'identifier' ||
              step === 'password' && s === 'otp') && styles.stepDotDone
            ]}>
              <Text style={styles.stepDotText}>{i + 1}</Text>
            </View>
            {i < 2 && <View style={styles.stepLine} />}
          </View>
        ))}
      </View>

      {step === 'identifier' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter your identifier</Text>
          <Text style={styles.cardSub}>
            Enter your email address, roll number (students), or employee code (professors)
          </Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="Email / Roll Number / Employee Code"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={styles.btn} onPress={requestOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
          </TouchableOpacity>
        </View>
      )}

      {step === 'otp' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Enter OTP</Text>
          <Text style={styles.cardSub}>
            Check your registered email for a 6-digit code. Valid for 10 minutes.
          </Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={t => { setOtp(t.replace(/[^0-9]/g, '').slice(0, 6)); if (otp.length === 6) verifyOtp(); }}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity style={styles.btn} onPress={verifyOtp}>
            <Text style={styles.btnText}>Verify OTP</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resendBtn} onPress={requestOtp} disabled={loading}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'password' && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Set New Password</Text>
          <Text style={styles.cardSub}>
            Must be at least 8 characters with an uppercase letter and a number.
          </Text>
          <View>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              secureTextEntry={!showPassword}
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
          <View>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={COLORS.textMuted}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btn} onPress={resetPassword} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: SPACING.lg, backgroundColor: COLORS.background },
  back: { marginBottom: SPACING.lg },
  backText: { color: COLORS.primary, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.lg },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xl },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border,
    justifyContent: 'center', alignItems: 'center'
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepDotDone: { backgroundColor: COLORS.success },
  stepDotText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  stepLine: { width: 40, height: 2, backgroundColor: COLORS.border },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  cardSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 18 },
  input: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: 15, marginBottom: SPACING.md,
    color: COLORS.textPrimary, backgroundColor: COLORS.background
  },
  otpInput: { textAlign: 'center', fontSize: 28, fontWeight: '700', letterSpacing: 8 },
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
  btn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.xs
  },
  btnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  resendBtn: { marginTop: SPACING.md, alignItems: 'center' },
  resendText: { color: COLORS.primary, fontSize: 14 }
});