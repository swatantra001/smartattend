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

export default function ProfessorLoginScreen() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const { setAuth } = useAuthStore();

	async function handleLogin() {
		if (!email.trim() || !password.trim()) {
			Alert.alert('Error', 'Please enter email and password');
			return;
		}
		setLoading(true);
		try {
			const res = await AuthAPI.login(email.trim().toLowerCase(), password);
			const { access_token, refresh_token, user } = res.data.data;

			if (user.role !== 'PROFESSOR') {
				Alert.alert('Error', 'Please use the Professor app to login.');
				return;
			}

			await setAuth(user, access_token, refresh_token);
			router.replace('/(tabs)/home');
		} catch (err: any) {
			const msg = err.response?.data?.error || 'Login failed. Please try again.';
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
				<View style={styles.header}>
					<Text style={styles.logo}>SmartAttend</Text>
					<Text style={styles.role}>Professor Portal</Text>
					<Text style={styles.subtitle}>Manage classroom attendance</Text>
				</View>

				<View style={styles.form}>
					<Text style={styles.label}>Email Address</Text>
					<TextInput
						style={styles.input}
						placeholder="professor@college.edu"
						placeholderTextColor={COLORS.textMuted}
						value={email}
						onChangeText={setEmail}
						keyboardType="email-address"
						autoCapitalize="none"
						editable={!loading}
					/>
					{/* show-password toggle */}

					<Text style={styles.label}>Password</Text>
					<View>
						<TextInput
							style={styles.input}
							placeholder="Your password"
							placeholderTextColor={COLORS.textMuted}
							value={password}
							onChangeText={setPassword}
							secureTextEntry={!showPassword} // Toggle based on state
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
						{loading
							? <ActivityIndicator color={COLORS.white} />
							: <Text style={styles.buttonText}>Login</Text>
						}
					</TouchableOpacity>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: COLORS.primary },
	scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },
	header: { alignItems: 'center', marginBottom: SPACING.xxl },
	logo: { fontSize: 40, fontWeight: '800', color: COLORS.white },
	role: { fontSize: 20, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 4 },
	subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
	form: {
		backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
		padding: SPACING.lg, shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
	},
	label: {
		fontSize: 14, fontWeight: '600',
		color: COLORS.textPrimary,
		marginBottom: SPACING.xs, marginTop: SPACING.sm,
	},
	input: {
		borderWidth: 1.5, borderColor: COLORS.border,
		borderRadius: RADIUS.md, padding: SPACING.md,
		fontSize: 15, color: COLORS.textPrimary,
		backgroundColor: COLORS.background,
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
	// Added styling for the Forgot Password button
	forgotPasswordContainer: {
		alignSelf: 'flex-end',
		marginTop: SPACING.xs,
		paddingVertical: SPACING.xs,
	},
	forgotPasswordText: {
		color: COLORS.primary,
		fontSize: 13,
		fontWeight: '600',
	},
	button: {
		backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
		padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg,
	},
	buttonDisabled: { opacity: 0.6 },
	buttonText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});