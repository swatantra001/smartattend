import React, { useState } from 'react';
import {
	View, Text, StyleSheet, TouchableOpacity,
	ScrollView, Alert, TextInput, ActivityIndicator,
	Modal,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { AuthAPI, StudentAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

export default function ProfileScreen() {
	const { user, clearAuth, getDeviceId } = useAuthStore();
	const [resetModalVisible, setResetModalVisible] = useState(false);
	const [resetReason, setResetReason] = useState('');
	const [resetting, setResetting] = useState(false);
	const [loggingOut, setLoggingOut] = useState(false);
	// Face Reset State
	const [faceModalVisible, setFaceModalVisible] = useState(false);
	const [faceReason, setFaceReason] = useState('');
	const [faceResetting, setFaceResetting] = useState(false);

	async function handleLogout() {
		Alert.alert('Logout', 'Are you sure you want to logout?', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Logout',
				style: 'destructive',
				onPress: async () => {
					setLoggingOut(true);
					try {
						await AuthAPI.logout(user!.user_id);
					} catch { }
					await clearAuth();
					router.replace('/(auth)/login');
				},
			},
		]);
	}

	async function handleDeviceReset() {
		if (resetReason.trim().length < 10) {
			Alert.alert('Error', 'Please provide a detailed reason (at least 10 characters).');
			return;
		}

		setResetting(true);
		try {
			const deviceId = await getDeviceId();
			await StudentAPI.requestDeviceReset({
				reason: resetReason.trim(),
				new_device_id_raw: deviceId,
			});

			setResetModalVisible(false);
			setResetReason('');
			Alert.alert(
				'Request Submitted',
				'Your device reset request has been submitted. Admin will review within 24 hours. You will receive a notification when approved.',
				[{ text: 'OK' }]
			);
		} catch (err: any) {
			const msg = err.response?.data?.error || 'Request failed. Please try again.';
			Alert.alert('Error', msg);
		} finally {
			setResetting(false);
		}
	}

	// ── NEW: Handle Face Reset Request ──
	async function handleFaceReset() {
		if (faceReason.trim().length < 10) {
			Alert.alert('Error', 'Please provide a detailed reason (at least 10 characters).');
			return;
		}

		setFaceResetting(true);
		try {
			await StudentAPI.requestFaceReset({ reason: faceReason.trim() });
			setFaceModalVisible(false);
			setFaceReason('');
			Alert.alert(
				'Request Submitted',
				'Your face reset request was sent. Once approved by the admin, your current facial data will be wiped and you can re-enroll.',
				[{ text: 'OK' }]
			);
		} catch (err: any) {
			const msg = err.response?.data?.error || 'Request failed. Please try again.';
			Alert.alert('Error', msg);
		} finally {
			setFaceResetting(false);
		}
	}

	function InfoRow({ label, value }: { label: string; value: string }) {
		return (
			<View style={styles.infoRow}>
				<Text style={styles.infoLabel}>{label}</Text>
				<Text style={styles.infoValue}>{value}</Text>
			</View>
		);
	}

	return (
		<SafeAreaView style={styles.safe}>
			<ScrollView>
				{/* Header */}
				<View style={styles.header}>
					<View style={styles.avatar}>
						<Text style={styles.avatarText}>
							{user?.name?.charAt(0)?.toUpperCase() ?? '?'}
						</Text>
					</View>
					<Text style={styles.name}>{user?.name}</Text>
					<Text style={styles.rollNo}>{user?.roll_number}</Text>
				</View>

				{/* Info card */}
				<View style={styles.card}>
					<Text style={styles.cardTitle}>Student Details</Text>
					<InfoRow label="Email" value={user?.email ?? '-'} />
					<InfoRow label="Roll Number" value={user?.roll_number ?? '-'} />
					<InfoRow label="Semester" value={`Semester ${user?.semester ?? '-'}`} />
					<InfoRow
						label="Face Enrolled"
						value={user?.face_enrolled_at
							? `✅ ${new Date(user.face_enrolled_at).toLocaleDateString()}`
							: '❌ Not enrolled'
						}
					/>
				</View>

				{/* Actions */}
				<View style={styles.card}>
					<Text style={styles.cardTitle}>Actions</Text>

					{!user?.face_enrolled_at && (
						<ActionButton
							icon="📷"
							label="Enroll Face"
							subtitle="Required for attendance"
							color={COLORS.warning}
							onPress={() => router.push('/enroll-face')}
						/>
					)}

					{user?.face_enrolled_at && (
						<ActionButton
							icon="📷"
							label="Request Face Reset"
							subtitle="Update your face data"
							color={COLORS.textSecondary}
							onPress={() => setFaceModalVisible(true)}
						/>
					)}

					<ActionButton
						icon="📱"
						label="Request Device Reset"
						subtitle="Changed your phone? Request a reset"
						color={COLORS.textSecondary}
						onPress={() => setResetModalVisible(true)}
					/>

					<ActionButton
						icon="🚪"
						label="Logout"
						subtitle="Sign out of your account"
						color={COLORS.danger}
						onPress={handleLogout}
						loading={loggingOut}
					/>
				</View>

				<Text style={styles.version}>SmartAttend v1.0.0 • Student App</Text>
			</ScrollView>

			{/* Device Reset Modal */}
			<Modal
				visible={resetModalVisible}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setResetModalVisible(false)}
			>
				<SafeAreaView style={styles.modalSafe}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Request Device Reset</Text>
						<TouchableOpacity onPress={() => setResetModalVisible(false)}>
							<Text style={styles.modalClose}>✕</Text>
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.modalContent}>
						<Text style={styles.modalInfo}>
							Use this if you have bought a new phone or your device was lost/stolen.
							An admin will review your request within 24 hours.
						</Text>

						<View style={styles.warningBox}>
							<Text style={styles.warningText}>
								⚠️ You can only request 2 device resets per semester.
								Make sure you are logged into the new device before submitting.
							</Text>
						</View>

						<Text style={styles.inputLabel}>Reason for reset *</Text>
						<TextInput
							style={styles.textArea}
							value={resetReason}
							onChangeText={setResetReason}
							placeholder="e.g. I bought a new phone and the old one is no longer available..."
							placeholderTextColor={COLORS.textMuted}
							multiline
							numberOfLines={5}
							textAlignVertical="top"
						/>

						<TouchableOpacity
							style={[styles.submitBtn, resetting && { opacity: 0.6 }]}
							onPress={handleDeviceReset}
							disabled={resetting}
						>
							{resetting ? (
								<ActivityIndicator color={COLORS.white} />
							) : (
								<Text style={styles.submitBtnText}>Submit Request</Text>
							)}
						</TouchableOpacity>

						<TouchableOpacity
							style={styles.cancelBtn}
							onPress={() => setResetModalVisible(false)}
						>
							<Text style={styles.cancelBtnText}>Cancel</Text>
						</TouchableOpacity>
					</ScrollView>
				</SafeAreaView>
			</Modal>

			{/* ── Face Reset Modal ── */}
			<Modal visible={faceModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setFaceModalVisible(false)}>
				<SafeAreaView style={styles.modalSafe}>
					<View style={styles.modalHeader}>
						<Text style={styles.modalTitle}>Request Face Reset</Text>
						<TouchableOpacity onPress={() => setFaceModalVisible(false)}>
							<Text style={styles.modalClose}>✕</Text>
						</TouchableOpacity>
					</View>
					<ScrollView style={styles.modalContent}>
						<Text style={styles.modalInfo}>
							If your face data is inaccurate (e.g. wearing glasses, bad lighting), request an admin to wipe it so you can enroll again.
						</Text>
						<Text style={styles.inputLabel}>Reason for Face Reset *</Text>
						<TextInput
							style={styles.textArea} value={faceReason} onChangeText={setFaceReason}
							placeholder="e.g. I enrolled with sunglasses on and it is failing..." placeholderTextColor={COLORS.textMuted}
							multiline numberOfLines={5} textAlignVertical="top"
						/>
						<TouchableOpacity style={[styles.submitBtn, faceResetting && { opacity: 0.6 }]} onPress={handleFaceReset} disabled={faceResetting}>
							{faceResetting ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>Submit Request</Text>}
						</TouchableOpacity>
						<TouchableOpacity style={styles.cancelBtn} onPress={() => setFaceModalVisible(false)}>
							<Text style={styles.cancelBtnText}>Cancel</Text>
						</TouchableOpacity>
					</ScrollView>
				</SafeAreaView>
			</Modal>
		</SafeAreaView>
	);
}

function ActionButton({
	icon, label, subtitle, color, onPress, loading,
}: {
	icon: string;
	label: string;
	subtitle: string;
	color: string;
	onPress: () => void;
	loading?: boolean;
}) {
	return (
		<TouchableOpacity
			style={styles.actionBtn}
			onPress={onPress}
			disabled={loading}
			activeOpacity={0.7}
		>
			<Text style={styles.actionIcon}>{icon}</Text>
			<View style={styles.actionText}>
				<Text style={[styles.actionLabel, { color }]}>{label}</Text>
				<Text style={styles.actionSubtitle}>{subtitle}</Text>
			</View>
			{loading
				? <ActivityIndicator size="small" color={color} />
				: <Text style={[styles.actionArrow, { color }]}>›</Text>
			}
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	safe: { flex: 1, backgroundColor: COLORS.background },
	header: {
		backgroundColor: COLORS.primary,
		alignItems: 'center',
		paddingVertical: SPACING.xl,
		paddingHorizontal: SPACING.lg,
	},
	avatar: {
		width: 80, height: 80, borderRadius: 40,
		backgroundColor: 'rgba(255,255,255,0.2)',
		justifyContent: 'center', alignItems: 'center',
		marginBottom: SPACING.sm,
	},
	avatarText: { fontSize: 36, color: COLORS.white, fontWeight: '700' },
	name: { fontSize: 22, fontWeight: '800', color: COLORS.white },
	rollNo: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
	card: {
		backgroundColor: COLORS.white,
		borderRadius: RADIUS.md,
		margin: SPACING.md,
		marginBottom: 0,
		padding: SPACING.md,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	cardTitle: {
		fontSize: 12, fontWeight: '700',
		color: COLORS.textMuted, textTransform: 'uppercase',
		letterSpacing: 0.8, marginBottom: SPACING.sm,
	},
	infoRow: {
		flexDirection: 'row', justifyContent: 'space-between',
		paddingVertical: SPACING.sm,
		borderBottomWidth: 1, borderBottomColor: COLORS.border,
	},
	infoLabel: { fontSize: 14, color: COLORS.textSecondary },
	infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
	actionBtn: {
		flexDirection: 'row', alignItems: 'center',
		paddingVertical: SPACING.sm,
		borderBottomWidth: 1, borderBottomColor: COLORS.border,
	},
	actionIcon: { fontSize: 22, width: 36 },
	actionText: { flex: 1 },
	actionLabel: { fontSize: 15, fontWeight: '600' },
	actionSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
	actionArrow: { fontSize: 22, fontWeight: '300' },
	version: {
		textAlign: 'center', color: COLORS.textMuted,
		fontSize: 12, padding: SPACING.lg,
	},
	// Modal
	modalSafe: { flex: 1, backgroundColor: COLORS.background },
	modalHeader: {
		flexDirection: 'row', justifyContent: 'space-between',
		alignItems: 'center', padding: SPACING.lg,
		borderBottomWidth: 1, borderBottomColor: COLORS.border,
		backgroundColor: COLORS.white,
	},
	modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
	modalClose: { fontSize: 20, color: COLORS.textSecondary },
	modalContent: { padding: SPACING.lg },
	modalInfo: {
		fontSize: 14, color: COLORS.textSecondary,
		lineHeight: 20, marginBottom: SPACING.md,
	},
	warningBox: {
		backgroundColor: COLORS.warningLight,
		borderRadius: RADIUS.md,
		padding: SPACING.md,
		marginBottom: SPACING.md,
	},
	warningText: { fontSize: 13, color: COLORS.warning, lineHeight: 18 },
	inputLabel: {
		fontSize: 14, fontWeight: '600',
		color: COLORS.textPrimary, marginBottom: SPACING.xs,
	},
	textArea: {
		borderWidth: 1.5, borderColor: COLORS.border,
		borderRadius: RADIUS.md, padding: SPACING.md,
		fontSize: 14, color: COLORS.textPrimary,
		backgroundColor: COLORS.white,
		minHeight: 120, marginBottom: SPACING.lg,
	},
	submitBtn: {
		backgroundColor: COLORS.primary,
		borderRadius: RADIUS.md, padding: SPACING.md,
		alignItems: 'center', marginBottom: SPACING.sm,
	},
	submitBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
	cancelBtn: {
		padding: SPACING.md, alignItems: 'center',
	},
	cancelBtnText: { color: COLORS.textSecondary, fontSize: 15 },
});