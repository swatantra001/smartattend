

// import React, {
// 	useEffect, useRef, useState, useCallback,
// } from 'react';
// import {
// 	View, Text, StyleSheet, FlatList, TouchableOpacity,
// 	Modal, TextInput, ActivityIndicator, Alert, Animated,
// 	KeyboardAvoidingView, Platform, ScrollView,
// 	SafeAreaView as RNSafeAreaView,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useLocalSearchParams, router } from 'expo-router';
// import { COLORS, SPACING, RADIUS } from '../../src/constants';
// import { ProfessorAPI } from '../../src/services/api';
// import { useAuthStore } from '../../src/store/auth.store';
// import {
// 	joinSession, leaveSession, onSessionEvent,
// 	sendChatMessage, requestChatHistory,
// 	onStudentChatMessage, onChatHistory,
// 	getSocket,
// 	type ChatMessage,
// } from '../../src/services/socket';
// import { DashboardStudentCard } from '../../src/types/shared';

// // ─── Card width for 2-column grid ────────────────────────────────────────────
// import { Dimensions } from 'react-native';
// import { useSessionStore } from '../../src/store/session.store';
// const SCREEN_W = Dimensions.get('window').width;
// const CARD_W = (SCREEN_W - SPACING.md * 3) / 2;

// // ─── Types ────────────────────────────────────────────────────────────────────
// interface SessionInfo {
// 	session_id: string;
// 	status: string;
// 	course_name: string;
// 	code: string;
// 	section: string | null;
// 	started_at: string;
// 	expires_at: string;
// 	attendance_credits: number;
// 	class_duration_minutes: number;
// }

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function getCardBg(s: DashboardStudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '#F0FFF4';
// 	if (s.verification_status === 'SUSPICIOUS') return '#FFFBEB';
// 	if (s.verification_status === 'FAILED') return '#FFF5F5';
// 	return COLORS.white;
// }

// function getCardBorder(s: DashboardStudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return COLORS.success;
// 	if (s.verification_status === 'SUSPICIOUS') return '#F59E0B';
// 	if (s.verification_status === 'FAILED') return COLORS.danger;
// 	return COLORS.border;
// }

// function getStatusIcon(s: DashboardStudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '✅';
// 	if (s.verification_status === 'SUSPICIOUS') return '⚠️';
// 	if (s.verification_status === 'FAILED') return '❌';
// 	if (s.marked_by === 'PROFESSOR') return '✋';
// 	return '⏳';
// }

// function formatTime(iso: string): string {
// 	const d = new Date(iso);
// 	return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
// }

// function formatTimer(sec: number): string {
// 	const m = Math.floor(sec / 60);
// 	const s = sec % 60;
// 	return `${m}:${s.toString().padStart(2, '0')}`;
// }

// // ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
// export default function DashboardScreen() {
// 	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
// 	const { user } = useAuthStore();

// 	const [session, setSession] = useState<SessionInfo | null>(null);
// 	const [students, setStudents] = useState<Map<string, DashboardStudentCard>>(new Map());
// 	const [loading, setLoading] = useState(true);
// 	const [sessionEnded, setSessionEnded] = useState(false);
// 	const [timeLeft, setTimeLeft] = useState<number>(0);
// 	const [activeTab, setActiveTab] = useState<'students' | 'chat'>('students');

// 	// Override modal
// 	const [selectedStudent, setSelectedStudent] = useState<DashboardStudentCard | null>(null);
// 	const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
// 	const [overrideReason, setOverrideReason] = useState('');
// 	const [overriding, setOverriding] = useState(false);

// 	// Chat
// 	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
// 	const [chatInput, setChatInput] = useState('');
// 	const [chatUnread, setChatUnread] = useState(0);
// 	const chatListRef = useRef<FlatList>(null);
// 	const timerRef = useRef<ReturnType<typeof setInterval>>();
// 	const { activeSession } = useSessionStore();

// 	// ── Load dashboard data ───────────────────────────────────────────────────
// 	const loadDashboard = useCallback(async () => {
// 		try {
// 			const res = await ProfessorAPI.getDashboard(sessionId);
// 			const data = res.data.data;
// 			setSession(data.session);
// 			const map = new Map<string, DashboardStudentCard>();
// 			data.students.forEach((s: DashboardStudentCard) => map.set(s.student_id, s));
// 			setStudents(map);
// 			if (data.session.status !== 'ACTIVE') setSessionEnded(true);
// 		} catch (err: any) {
// 			Alert.alert('Error', 'Failed to load dashboard');
// 		} finally {
// 			setLoading(false);
// 		}
// 	}, [sessionId]);

// 	useEffect(() => {
// 		if (!session?.expires_at) return;


// 		const update = () => {
// 			const remaining = Math.max(
// 				0,
// 				Math.floor(
// 					(new Date(session.expires_at).getTime() - Date.now()) / 1000
// 				)
// 			);
// 			setTimeLeft(remaining);
// 			if (remaining === 0) clearInterval(timerRef.current);
// 		};

// 		update();
// 		timerRef.current = setInterval(update, 1000);
// 		return () => clearInterval(timerRef.current);
// 	}, [session?.expires_at]);

// 	// ── Socket events ─────────────────────────────────────────────────────────
// 	useEffect(() => {
// 		loadDashboard();

// 		joinSession(sessionId);
// 		requestChatHistory(sessionId);

// 		// Attendance events
// 		const unsubAttendance = onSessionEvent((event: any) => {
// 			if (
// 				event.type === 'SESSION_ENDED' ||
// 				event.type === 'SESSION_EXPIRED' ||
// 				event.type === 'SESSION_CANCELLED'
// 			) {
// 				setSessionEnded(true);
// 				if (event.type === 'SESSION_CANCELLED') {
// 					Alert.alert('Session Cancelled', 'Attendance session was cancelled. No records saved.');
// 				}
// 				return;
// 			}

// 			if (event.data?.student_id) {
// 				setStudents(prev => {
// 					const next = new Map(prev);
// 					const existing = next.get(event.data.student_id) ?? {} as DashboardStudentCard;
// 					next.set(event.data.student_id, { ...existing, ...event.data });
// 					return next;
// 				});
// 			}
// 		});

// 		// Chat — incoming student messages
// 		const unsubChat = onStudentChatMessage((msg) => {
// 			setChatMessages(prev => [...prev, msg]);
// 			if (activeTab !== 'chat') {
// 				setChatUnread(n => n + 1);
// 			}
// 		});

// 		// Chat history on join
// 		const unsubHistory = onChatHistory((data) => {
// 			setChatMessages(data.messages);
// 		});

// 		const unsubProfReply = (() => {
// 			const handler = (msg: ChatMessage) => {
// 				// No dedup needed — we don't do optimistic append anymore
// 				setChatMessages(prev => [...prev, { ...msg, sender_type: 'PROFESSOR' }]);
// 				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
// 			};
// 			const s = getSocket();
// 			s?.on('professor_reply_sent', handler);
// 			return () => s?.off('professor_reply_sent', handler);
// 		})();

// 		return () => {
// 			unsubAttendance();
// 			unsubChat();
// 			unsubHistory();
// 			unsubProfReply();          // ← ADD THIS
// 			leaveSession(sessionId);
// 		};
// 	}, [sessionId]);

// 	// Auto-scroll chat to bottom on new messages
// 	useEffect(() => {
// 		if (chatMessages.length > 0) {
// 			setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
// 		}
// 	}, [chatMessages]);

// 	// ── Actions ───────────────────────────────────────────────────────────────
// 	async function handleEndSession() {
// 		Alert.alert(
// 			'End Session',
// 			'End the attendance session? Students can no longer verify.',
// 			[
// 				{ text: 'Cancel', style: 'cancel' },
// 				{
// 					text: 'End Session', style: 'destructive',
// 					onPress: async () => {
// 						try {
// 							await ProfessorAPI.endSession(sessionId);
// 							setSessionEnded(true);
// 						} catch (err: any) {
// 							Alert.alert('Error', err.response?.data?.error || 'Failed to end session');
// 						}
// 					},
// 				},
// 			]
// 		);
// 	}

// 	async function handleCancelSession() {
// 		Alert.alert(
// 			'❌ Cancel Session',
// 			'This will DELETE all attendance records for this class. No attendance will be saved. Are you sure?',
// 			[
// 				{ text: 'Keep Session', style: 'cancel' },
// 				{
// 					text: 'Cancel Session', style: 'destructive',
// 					onPress: async () => {
// 						try {
// 							await ProfessorAPI.cancelSession(sessionId);
// 							setSessionEnded(true);
// 							Alert.alert('Cancelled', 'Session cancelled. No attendance recorded.');
// 						} catch (err: any) {
// 							Alert.alert('Error', err.response?.data?.error || 'Failed to cancel session');
// 						}
// 					},
// 				},
// 			]
// 		);
// 	}

// 	async function handleOverrideSubmit() {
// 		if (!selectedStudent) return;
// 		if (!overrideReason.trim()) {
// 			Alert.alert('Reason Required', 'Please enter a reason for the override (e.g. physically verified).');
// 			return;
// 		}

// 		setOverriding(true);
// 		try {
// 			await ProfessorAPI.manualOverride(
// 				sessionId,
// 				selectedStudent.student_id,
// 				overrideStatus,
// 				overrideReason.trim()
// 			);
// 			setSelectedStudent(null);
// 			setOverrideReason('');
// 			setOverrideStatus('PRESENT');
// 		} catch (err: any) {
// 			Alert.alert('Error', err.response?.data?.error || 'Override failed');
// 		} finally {
// 			setOverriding(false);
// 		}
// 	}

// 	function handleSendChat() {
// 		const text = chatInput.trim();
// 		if (!text) return;

// 		sendChatMessage(sessionId, text);
// 		setChatInput('');
// 	}

// 	// ── Summary counts ────────────────────────────────────────────────────────
// 	const studentsArr = Array.from(students.values());
// 	const presentCount = studentsArr.filter(s => s.status === 'PRESENT').length;
// 	const absentCount = studentsArr.filter(s => s.status === 'ABSENT').length;
// 	const suspiciousCount = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
// 	const pendingCount = studentsArr.filter(s => s.verification_status === 'PENDING').length;

// 	const isTimeLow = (() => {
// 		if (!session) return false;
// 		return new Date(session.expires_at).getTime() - Date.now() < 2 * 60 * 1000;
// 	})();

// 	// ── Loading ───────────────────────────────────────────────────────────────
// 	if (loading) {
// 		return (
// 			<View style={styles.center}>
// 				<ActivityIndicator size="large" color={COLORS.primary} />
// 				<Text style={styles.loadingText}>Loading dashboard...</Text>
// 			</View>
// 		);
// 	}

// 	// ─────────────────────────────────────────────────────────────────────────
// 	return (
// 		<SafeAreaView style={styles.safe} edges={['top']}>

// 			{/* ── HEADER ─────────────────────────────────────────────────────────── */}
// 			<View style={styles.header}>
// 				<View style={styles.headerLeft}>
// 					<Text style={styles.headerTitle} numberOfLines={1}>
// 						{session?.course_name}
// 						{session?.section ? ` — ${session.section}` : ''}
// 					</Text>
// 					<Text style={styles.headerSub}>
// 						{session?.attendance_credits ?? 1} credit(s) • {session?.code}
// 					</Text>
// 				</View>

// 				<View style={styles.headerRight}>
// 					{/* Timer */}
// 					{!sessionEnded && (
// 						<View style={[styles.timerBadge, isTimeLow && styles.timerBadgeDanger]}>
// 							<Text style={styles.timerText}>{formatTimer(timeLeft)}</Text>
// 						</View>
// 					)}

// 					{/* End / Cancel buttons */}
// 					{!sessionEnded ? (
// 						<View style={{ gap: SPACING.xs }}>
// 							<TouchableOpacity style={styles.endBtn} onPress={handleEndSession}>
// 								<Text style={styles.endBtnText}>✅ End</Text>
// 							</TouchableOpacity>
// 							<TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSession}>
// 								<Text style={styles.cancelBtnText}>❌ Cancel</Text>
// 							</TouchableOpacity>
// 						</View>
// 					) : (
// 						<TouchableOpacity
// 							style={styles.backBtn}
// 							onPress={() => router.back()}
// 						>
// 							<Text style={styles.backBtnText}>← Back</Text>
// 						</TouchableOpacity>
// 					)}
// 				</View>
// 			</View>

// 			{/* Session ended banner */}
// 			{sessionEnded && (
// 				<View style={styles.endedBanner}>
// 					<Text style={styles.endedBannerText}>
// 						🏁 Session ended — you can still override attendance below
// 					</Text>
// 				</View>
// 			)}

// 			{/* ── SUMMARY BAR ─────────────────────────────────────────────────────── */}
// 			<View style={styles.summaryBar}>
// 				<SummaryPill label="Present" value={presentCount} color={COLORS.success} />
// 				<SummaryPill label="Absent" value={absentCount} color={COLORS.danger} />
// 				<SummaryPill label="Suspicious" value={suspiciousCount} color="#F59E0B" />
// 				<SummaryPill label="Pending" value={pendingCount} color={COLORS.textMuted} />
// 			</View>

// 			{/* ── TABS ─────────────────────────────────────────────────────────────── */}
// 			<View style={styles.tabs}>
// 				<TouchableOpacity
// 					style={[styles.tab, activeTab === 'students' && styles.tabActive]}
// 					onPress={() => setActiveTab('students')}
// 				>
// 					<Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>
// 						👥 Students ({studentsArr.length})
// 					</Text>
// 				</TouchableOpacity>

// 				<TouchableOpacity
// 					style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
// 					onPress={() => { setActiveTab('chat'); setChatUnread(0); }}
// 				>
// 					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
// 						<Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>
// 							💬 Chat
// 						</Text>
// 						{chatUnread > 0 && (
// 							<View style={styles.unreadBadge}>
// 								<Text style={styles.unreadBadgeText}>{chatUnread}</Text>
// 							</View>
// 						)}
// 					</View>
// 				</TouchableOpacity>
// 			</View>

// 			{/* ── STUDENTS TAB ────────────────────────────────────────────────────── */}
// 			{activeTab === 'students' && (
// 				<FlatList
// 					data={studentsArr}
// 					keyExtractor={item => item.student_id}
// 					numColumns={2}
// 					contentContainerStyle={styles.grid}
// 					columnWrapperStyle={styles.gridRow}
// 					ListEmptyComponent={
// 						<View style={styles.emptyContainer}>
// 							<Text style={styles.emptyIcon}>👥</Text>
// 							<Text style={styles.emptyText}>No students in session yet</Text>
// 						</View>
// 					}
// 					renderItem={({ item }) => (
// 						<StudentCard
// 							student={item}
// 							bg={getCardBg(item)}
// 							border={getCardBorder(item)}
// 							statusIcon={getStatusIcon(item)}
// 							onPress={() => {
// 								setSelectedStudent(item);
// 								// Pre-fill override status toggle
// 								setOverrideStatus(item.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
// 								setOverrideReason('');
// 							}}
// 						/>
// 					)}
// 				/>
// 			)}

// 			{/* ── CHAT TAB ─────────────────────────────────────────────────────────── */}
// 			{activeTab === 'chat' && (
// 				<KeyboardAvoidingView
// 					style={{ flex: 1 }}
// 					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
// 					keyboardVerticalOffset={120}
// 				>
// 					<FlatList
// 						ref={chatListRef}
// 						data={chatMessages}
// 						keyExtractor={(item, i) => item.message_id + i}
// 						contentContainerStyle={styles.chatList}
// 						ListEmptyComponent={
// 							<View style={styles.emptyContainer}>
// 								<Text style={styles.emptyIcon}>💬</Text>
// 								<Text style={styles.emptyText}>
// 									No messages yet.{'\n'}Students can message you here during the session.
// 								</Text>
// 							</View>
// 						}
// 						onContentSizeChange={() =>
// 							chatListRef.current?.scrollToEnd({ animated: true })
// 						}
// 						renderItem={({ item }) => <ChatBubble message={item} isMe={item.sender_type === 'PROFESSOR'} />}
// 					/>

// 					{/* Chat input */}
// 					<View style={styles.chatInputRow}>
// 						<TextInput
// 							style={styles.chatInput}
// 							value={chatInput}
// 							onChangeText={setChatInput}
// 							placeholder="Reply to students..."
// 							placeholderTextColor={COLORS.textMuted}
// 							multiline
// 							maxLength={500}
// 							returnKeyType="send"
// 							onSubmitEditing={handleSendChat}
// 						/>
// 						<TouchableOpacity
// 							style={[styles.chatSendBtn, !chatInput.trim() && styles.chatSendBtnDisabled]}
// 							onPress={handleSendChat}
// 							disabled={!chatInput.trim()}
// 						>
// 							<Text style={styles.chatSendBtnText}>Send</Text>
// 						</TouchableOpacity>
// 					</View>
// 				</KeyboardAvoidingView>
// 			)}

// 			{/* ── OVERRIDE MODAL ───────────────────────────────────────────────────── */}
// 			<Modal
// 				visible={!!selectedStudent}
// 				transparent
// 				animationType="fade"
// 				onRequestClose={() => setSelectedStudent(null)}
// 			>
// 				<View style={styles.modalOverlay}>
// 					<View style={styles.modalCard}>
// 						{selectedStudent && (
// 							<>
// 								{/* Header */}
// 								<View style={styles.modalHeader}>
// 									<View>
// 										<Text style={styles.modalName}>{selectedStudent.name}</Text>
// 										<Text style={styles.modalRoll}>{selectedStudent.roll_number}</Text>
// 									</View>
// 									<TouchableOpacity onPress={() => setSelectedStudent(null)}>
// 										<Text style={styles.modalClose}>✕</Text>
// 									</TouchableOpacity>
// 								</View>

// 								{/* Scores */}
// 								<View style={styles.scoresRow}>
// 									<ModalScore label="Face" value={selectedStudent.face_score} threshold={0.65} />
// 									<ModalScore label="Liveness" value={selectedStudent.liveness_score} threshold={0.70} />
// 									<ModalScore label="Scene" value={selectedStudent.scene_score} threshold={0.60} />
// 								</View>

// 								{/* Current status */}
// 								<View style={[
// 									styles.statusRow,
// 									{ backgroundColor: getCardBg(selectedStudent) }
// 								]}>
// 									<Text style={styles.statusRowIcon}>{getStatusIcon(selectedStudent)}</Text>
// 									<View style={{ flex: 1 }}>
// 										<Text style={styles.statusRowText}>
// 											{selectedStudent.status === 'PRESENT'
// 												? 'Currently: Present'
// 												: 'Currently: Absent'}
// 										</Text>
// 										{selectedStudent.marked_by === 'PROFESSOR' && (
// 											<Text style={styles.markedBy}>
// 												Manually overridden
// 												{(selectedStudent as any).override_reason
// 													? `: ${(selectedStudent as any).override_reason}`
// 													: ''}
// 											</Text>
// 										)}
// 									</View>
// 								</View>

// 								{/* Override toggle */}
// 								<Text style={styles.overrideLabel}>Change to:</Text>
// 								<View style={styles.overrideToggleRow}>
// 									<TouchableOpacity
// 										style={[
// 											styles.overrideToggleBtn,
// 											overrideStatus === 'PRESENT' && styles.overrideToggleBtnActivePresent
// 										]}
// 										onPress={() => setOverrideStatus('PRESENT')}
// 									>
// 										<Text style={[
// 											styles.overrideToggleBtnText,
// 											overrideStatus === 'PRESENT' && { color: COLORS.white }
// 										]}>
// 											✅ Present
// 										</Text>
// 									</TouchableOpacity>
// 									<TouchableOpacity
// 										style={[
// 											styles.overrideToggleBtn,
// 											overrideStatus === 'ABSENT' && styles.overrideToggleBtnActiveAbsent
// 										]}
// 										onPress={() => setOverrideStatus('ABSENT')}
// 									>
// 										<Text style={[
// 											styles.overrideToggleBtnText,
// 											overrideStatus === 'ABSENT' && { color: COLORS.white }
// 										]}>
// 											❌ Absent
// 										</Text>
// 									</TouchableOpacity>
// 								</View>

// 								{/* Reason input */}
// 								<TextInput
// 									style={styles.reasonInput}
// 									value={overrideReason}
// 									onChangeText={setOverrideReason}
// 									placeholder="Reason (required) — e.g. physically verified, student appeal..."
// 									placeholderTextColor={COLORS.textMuted}
// 									multiline
// 									maxLength={500}
// 								/>

// 								{/* Submit */}
// 								<TouchableOpacity
// 									style={[styles.overrideBtn, overriding && { opacity: 0.6 }]}
// 									onPress={handleOverrideSubmit}
// 									disabled={overriding}
// 								>
// 									{overriding
// 										? <ActivityIndicator color={COLORS.white} />
// 										: <Text style={styles.overrideBtnText}>Apply Override</Text>
// 									}
// 								</TouchableOpacity>

// 								<TouchableOpacity
// 									style={styles.closeBtnSecondary}
// 									onPress={() => setSelectedStudent(null)}
// 								>
// 									<Text style={styles.closeBtnSecondaryText}>Close</Text>
// 								</TouchableOpacity>
// 							</>
// 						)}
// 					</View>
// 				</View>
// 			</Modal>

// 		</SafeAreaView>
// 	);
// }

// // ─── Sub-components ───────────────────────────────────────────────────────────

// function StudentCard({
// 	student, bg, border, statusIcon, onPress,
// }: {
// 	student: DashboardStudentCard;
// 	bg: string;
// 	border: string;
// 	statusIcon: string;
// 	onPress: () => void;
// }) {
// 	const fadeAnim = useRef(new Animated.Value(0)).current;

// 	useEffect(() => {
// 		Animated.timing(fadeAnim, {
// 			toValue: 1, duration: 300, useNativeDriver: true,
// 		}).start();
// 	}, [student.verification_status, student.status]);

// 	return (
// 		<TouchableOpacity onPress={onPress} activeOpacity={0.8}>
// 			<Animated.View style={[
// 				styles.studentCard,
// 				{ backgroundColor: bg, borderColor: border, opacity: fadeAnim, width: CARD_W },
// 			]}>
// 				{/* Avatar */}
// 				<View style={[styles.studentAvatar, { borderColor: border }]}>
// 					<Text style={styles.studentAvatarText}>
// 						{student.name?.charAt(0)?.toUpperCase() ?? '?'}
// 					</Text>
// 				</View>

// 				{/* Status icon */}
// 				<Text style={styles.studentStatusIcon}>{statusIcon}</Text>

// 				{/* Info */}
// 				<Text style={styles.studentName} numberOfLines={2}>{student.name}</Text>
// 				<Text style={styles.studentRoll}>{student.roll_number}</Text>

// 				{student.face_score != null && (
// 					<Text style={styles.studentScore}>
// 						F:{Math.round(student.face_score * 100)}%
// 						{student.scene_score != null
// 							? ` S:${Math.round(student.scene_score * 100)}%`
// 							: ''}
// 					</Text>
// 				)}

// 				{student.marked_by === 'PROFESSOR' && (
// 					<Text style={styles.manualTag}>✋ Manual</Text>
// 				)}
// 			</Animated.View>
// 		</TouchableOpacity>
// 	);
// }

// function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
// 	return (
// 		<View style={[styles.summaryPill, { backgroundColor: color + '18' }]}>
// 			<Text style={[styles.summaryValue, { color }]}>{value}</Text>
// 			<Text style={[styles.summaryLabel, { color }]}>{label}</Text>
// 		</View>
// 	);
// }

// function ModalScore({
// 	label, value, threshold,
// }: {
// 	label: string; value?: number; threshold: number;
// }) {
// 	if (value == null) return (
// 		<View style={styles.modalScore}>
// 			<Text style={styles.modalScoreLabel}>{label}</Text>
// 			<Text style={styles.modalScoreValue}>—</Text>
// 		</View>
// 	);
// 	const pct = Math.round(value * 100);
// 	const color = value >= threshold ? COLORS.success : COLORS.danger;
// 	return (
// 		<View style={styles.modalScore}>
// 			<Text style={styles.modalScoreLabel}>{label}</Text>
// 			<Text style={[styles.modalScoreValue, { color }]}>{pct}%</Text>
// 		</View>
// 	);
// }

// function ChatBubble({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
// 	return (
// 		<View style={[styles.chatRow, isMe ? styles.chatRowMe : styles.chatRowOther]}>
// 			<View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleOther]}>
// 				{!isMe && (
// 					<Text style={styles.chatSenderName}>
// 						{message.student_name} ({message.roll_number})
// 					</Text>
// 				)}
// 				<Text style={[styles.chatText, isMe && styles.chatTextMe]}>
// 					{message.message}
// 				</Text>
// 				<Text style={[styles.chatTime, isMe && styles.chatTimeMe]}>
// 					{formatTime(message.created_at)}
// 				</Text>
// 			</View>
// 		</View>
// 	);
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
// 	safe: { flex: 1, backgroundColor: COLORS.background },
// 	center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
// 	loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: 14 },

// 	// Header
// 	header: {
// 		backgroundColor: COLORS.primary,
// 		padding: SPACING.md,
// 		flexDirection: 'row',
// 		justifyContent: 'space-between',
// 		alignItems: 'center',
// 	},
// 	headerLeft: { flex: 1, marginRight: SPACING.sm },
// 	headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
// 	headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
// 	headerRight: { alignItems: 'flex-end', gap: SPACING.xs },
// 	timerBadge: {
// 		backgroundColor: 'rgba(255,255,255,0.2)',
// 		borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
// 		paddingVertical: SPACING.xs,
// 	},
// 	timerBadgeDanger: { backgroundColor: COLORS.danger },
// 	timerText: { color: COLORS.white, fontWeight: '700', fontSize: 15, letterSpacing: 1 },
// 	endBtn: {
// 		backgroundColor: 'rgba(255,255,255,0.25)',
// 		borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
// 		paddingVertical: 5, alignItems: 'center',
// 	},
// 	endBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
// 	cancelBtn: {
// 		backgroundColor: COLORS.danger,
// 		borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
// 		paddingVertical: 5, alignItems: 'center',
// 	},
// 	cancelBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },
// 	backBtn: {
// 		backgroundColor: 'rgba(255,255,255,0.2)',
// 		borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 5,
// 	},
// 	backBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },

// 	// Session ended banner
// 	endedBanner: {
// 		backgroundColor: '#FEF3C7',
// 		borderLeftWidth: 4, borderLeftColor: '#F59E0B',
// 		padding: SPACING.sm, paddingHorizontal: SPACING.md,
// 	},
// 	endedBannerText: { color: '#92400E', fontSize: 12, fontWeight: '600' },

// 	// Summary
// 	summaryBar: {
// 		flexDirection: 'row', justifyContent: 'space-between',
// 		padding: SPACING.sm, backgroundColor: COLORS.white,
// 		borderBottomWidth: 1, borderBottomColor: COLORS.border,
// 	},
// 	summaryPill: {
// 		flex: 1, alignItems: 'center', borderRadius: RADIUS.sm,
// 		paddingVertical: SPACING.xs, marginHorizontal: 2,
// 	},
// 	summaryValue: { fontSize: 18, fontWeight: '800' },
// 	summaryLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },

// 	// Tabs
// 	tabs: {
// 		flexDirection: 'row',
// 		backgroundColor: COLORS.white,
// 		borderBottomWidth: 1, borderBottomColor: COLORS.border,
// 	},
// 	tab: {
// 		flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
// 		borderBottomWidth: 2, borderBottomColor: 'transparent',
// 	},
// 	tabActive: { borderBottomColor: COLORS.primary },
// 	tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
// 	tabTextActive: { color: COLORS.primary },
// 	unreadBadge: {
// 		backgroundColor: COLORS.danger, borderRadius: 10,
// 		minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
// 		paddingHorizontal: 4,
// 	},
// 	unreadBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

// 	// Student grid
// 	grid: { padding: SPACING.md, gap: SPACING.sm },
// 	gridRow: { gap: SPACING.sm, justifyContent: 'flex-start' },
// 	emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACING.xl },
// 	emptyIcon: { fontSize: 48 },
// 	emptyText: {
// 		color: COLORS.textMuted, marginTop: SPACING.sm,
// 		fontSize: 14, textAlign: 'center', lineHeight: 22,
// 	},

// 	// Student card
// 	studentCard: {
// 		borderRadius: RADIUS.md, padding: SPACING.sm,
// 		alignItems: 'center', borderWidth: 2,
// 		shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
// 		shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
// 	},
// 	studentAvatar: {
// 		width: 50, height: 50, borderRadius: 25,
// 		backgroundColor: 'rgba(0,0,0,0.08)',
// 		borderWidth: 2, justifyContent: 'center', alignItems: 'center',
// 		marginBottom: SPACING.xs,
// 	},
// 	studentAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
// 	studentStatusIcon: { fontSize: 16, position: 'absolute', top: 6, right: 6 },
// 	studentName: {
// 		fontSize: 12, fontWeight: '700', color: COLORS.textPrimary,
// 		textAlign: 'center', marginTop: SPACING.xs,
// 	},
// 	studentRoll: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
// 	studentScore: { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
// 	manualTag: { fontSize: 9, color: COLORS.primary, marginTop: 2, fontWeight: '700' },

// 	// Chat
// 	chatList: { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },
// 	chatRow: { flexDirection: 'row', marginBottom: SPACING.xs },
// 	chatRowMe: { justifyContent: 'flex-end' },
// 	chatRowOther: { justifyContent: 'flex-start' },
// 	chatBubble: {
// 		maxWidth: '80%', borderRadius: RADIUS.md,
// 		paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
// 	},
// 	chatBubbleMe: { backgroundColor: COLORS.primary },
// 	chatBubbleOther: {
// 		backgroundColor: COLORS.white,
// 		borderWidth: 1, borderColor: COLORS.border,
// 	},
// 	chatSenderName: {
// 		fontSize: 10, fontWeight: '800', color: COLORS.primary,
// 		marginBottom: 2,
// 	},
// 	chatText: { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
// 	chatTextMe: { color: COLORS.white },
// 	chatTime: { fontSize: 9, color: COLORS.textMuted, marginTop: 3, textAlign: 'right' },
// 	chatTimeMe: { color: 'rgba(255,255,255,0.6)' },
// 	chatInputRow: {
// 		flexDirection: 'row', alignItems: 'flex-end',
// 		padding: SPACING.sm,
// 		borderTopWidth: 1, borderTopColor: COLORS.border,
// 		backgroundColor: COLORS.white, gap: SPACING.xs,
// 	},
// 	chatInput: {
// 		flex: 1, backgroundColor: COLORS.background,
// 		borderRadius: RADIUS.full, paddingHorizontal: SPACING.md,
// 		paddingVertical: SPACING.xs, fontSize: 13,
// 		maxHeight: 80, color: COLORS.textPrimary,
// 		borderWidth: 1, borderColor: COLORS.border,
// 	},
// 	chatSendBtn: {
// 		backgroundColor: COLORS.primary,
// 		borderRadius: RADIUS.full,
// 		paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
// 	},
// 	chatSendBtnDisabled: { opacity: 0.4 },
// 	chatSendBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

// 	// Override modal
// 	modalOverlay: {
// 		flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
// 		justifyContent: 'center', padding: SPACING.lg,
// 	},
// 	modalCard: {
// 		backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
// 		padding: SPACING.lg,
// 	},
// 	modalHeader: {
// 		flexDirection: 'row', justifyContent: 'space-between',
// 		alignItems: 'flex-start', marginBottom: SPACING.md,
// 	},
// 	modalName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
// 	modalRoll: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
// 	modalClose: { fontSize: 22, color: COLORS.textSecondary, padding: 4 },
// 	scoresRow: {
// 		flexDirection: 'row', justifyContent: 'space-between',
// 		marginBottom: SPACING.md,
// 		borderWidth: 1, borderColor: COLORS.border,
// 		borderRadius: RADIUS.md, padding: SPACING.sm,
// 	},
// 	modalScore: { flex: 1, alignItems: 'center' },
// 	modalScoreLabel: { fontSize: 11, color: COLORS.textMuted },
// 	modalScoreValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
// 	statusRow: {
// 		flexDirection: 'row', alignItems: 'center',
// 		borderRadius: RADIUS.md, padding: SPACING.sm,
// 		marginBottom: SPACING.md, gap: SPACING.xs,
// 	},
// 	statusRowIcon: { fontSize: 18 },
// 	statusRowText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
// 	markedBy: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
// 	overrideLabel: {
// 		fontSize: 12, fontWeight: '700', color: COLORS.textMuted,
// 		textTransform: 'uppercase', letterSpacing: 0.5,
// 		marginBottom: SPACING.xs,
// 	},
// 	overrideToggleRow: {
// 		flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md,
// 	},
// 	overrideToggleBtn: {
// 		flex: 1, borderRadius: RADIUS.md,
// 		borderWidth: 1.5, borderColor: COLORS.border,
// 		padding: SPACING.sm, alignItems: 'center',
// 	},
// 	overrideToggleBtnActivePresent: {
// 		backgroundColor: COLORS.success, borderColor: COLORS.success,
// 	},
// 	overrideToggleBtnActiveAbsent: {
// 		backgroundColor: COLORS.danger, borderColor: COLORS.danger,
// 	},
// 	overrideToggleBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
// 	reasonInput: {
// 		borderWidth: 1, borderColor: COLORS.border,
// 		borderRadius: RADIUS.md, padding: SPACING.sm,
// 		fontSize: 13, color: COLORS.textPrimary,
// 		minHeight: 60, marginBottom: SPACING.md,
// 		backgroundColor: COLORS.background,
// 	},
// 	overrideBtn: {
// 		backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
// 		padding: SPACING.md, alignItems: 'center',
// 		marginBottom: SPACING.sm,
// 	},
// 	overrideBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
// 	closeBtnSecondary: { padding: SPACING.sm, alignItems: 'center' },
// 	closeBtnSecondaryText: { color: COLORS.textSecondary, fontSize: 14 },
// });



















import React, {
	useEffect, useRef, useState, useCallback,
} from 'react';
import {
	View, Text, StyleSheet, FlatList, TouchableOpacity,
	Modal, TextInput, ActivityIndicator, Alert, Animated,
	KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Dimensions } from 'react-native';
import { COLORS, SPACING, RADIUS } from '../../src/constants';
import { ProfessorAPI } from '../../src/services/api';
import { useAuthStore } from '../../src/store/auth.store';
import {
	joinSession, leaveSession, onSessionEvent,
	sendChatMessage, requestChatHistory,
	onStudentChatMessage, onChatHistory,
	getSocket,
	type ChatMessage,
} from '../../src/services/socket';
import { DashboardStudentCard } from '../../src/types/shared';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = (SCREEN_W - SPACING.md * 3) / 2;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionInfo {
	session_id: string;
	status: string;
	course_name: string;
	code: string;
	section: string | null;
	started_at: string;
	expires_at: string;
	attendance_credits: number;
	class_duration_minutes: number;
}

interface StudentCard extends DashboardStudentCard {
	notified?: boolean;
}

type StudentTab = 'all' | 'notified' | 'unnotified';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCardBg(s: StudentCard): string {
	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '#F0FFF4';
	if (s.verification_status === 'SUSPICIOUS') return '#FFFBEB';
	if (s.verification_status === 'FAILED') return '#FFF5F5';
	return COLORS.white;
}
function getCardBorder(s: StudentCard): string {
	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return COLORS.success;
	if (s.verification_status === 'SUSPICIOUS') return '#F59E0B';
	if (s.verification_status === 'FAILED') return COLORS.danger;
	return COLORS.border;
}
function getStatusIcon(s: StudentCard): string {
	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '✅';
	if (s.verification_status === 'SUSPICIOUS') return '⚠️';
	if (s.verification_status === 'FAILED') return '❌';
	if (s.marked_by === 'PROFESSOR') return '✋';
	return '⏳';
}
function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatTimer(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = sec % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function DashboardScreen() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	const { user } = useAuthStore();

	const [session, setSession]       = useState<SessionInfo | null>(null);
	// FIX: Switched from Map to standard Object for guaranteed React re-renders
	const [studentsObj, setStudentsObj] = useState<Record<string, StudentCard>>({});
	const [loading, setLoading]       = useState(true);
	const [sessionEnded, setSessionEnded] = useState(false);
	const [timeLeft, setTimeLeft]     = useState<number>(0);

	const [mainTab, setMainTab]         = useState<'students' | 'chat'>('students');
	const [studentTab, setStudentTab]   = useState<StudentTab>('all');

	// FIX: Ref required to prevent stale closures inside socket event listeners
	const mainTabRef = useRef(mainTab);
	useEffect(() => {
		mainTabRef.current = mainTab;
	}, [mainTab]);

	// Override modal
	const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
	const [overrideStatus, setOverrideStatus]   = useState<'PRESENT' | 'ABSENT'>('PRESENT');
	const [overrideReason, setOverrideReason]   = useState('');
	const [overriding, setOverriding]           = useState(false);

	// Chat
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput]       = useState('');
	const [chatUnread, setChatUnread]     = useState(0);
	const chatListRef  = useRef<FlatList>(null);
	const timerRef     = useRef<ReturnType<typeof setInterval>>();

	// ── Load dashboard ────────────────────────────────────────────────────────
	const loadDashboard = useCallback(async () => {
		try {
			const res  = await ProfessorAPI.getDashboard(sessionId);
			const data = res.data.data;
			setSession(data.session);

			const obj: Record<string, StudentCard> = {};
			data.students.forEach((s: StudentCard) => {
				obj[s.student_id] = s;
			});
			setStudentsObj(obj);

			if (data.session.status !== 'ACTIVE') setSessionEnded(true);
		} catch {
			Alert.alert('Error', 'Failed to load dashboard');
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	// ── Countdown timer ───────────────────────────────────────────────────────
	useEffect(() => {
		if (!session?.expires_at) return;
		const update = () => {
			const remaining = Math.max(
				0,
				Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
			);
			setTimeLeft(remaining);
			if (remaining === 0) clearInterval(timerRef.current);
		};
		update();
		timerRef.current = setInterval(update, 1000);
		return () => clearInterval(timerRef.current);
	}, [session?.expires_at]);

	// ── Socket + initial load ─────────────────────────────────────────────────
	useEffect(() => {
		loadDashboard();
		joinSession(sessionId);
		requestChatHistory(sessionId);

		const unsubAttendance = onSessionEvent((event: any) => {
			if (
				event.type === 'SESSION_ENDED' ||
				event.type === 'SESSION_EXPIRED' ||
				event.type === 'SESSION_CANCELLED'
			) {
				setSessionEnded(true);
				if (event.type === 'SESSION_CANCELLED') {
					Alert.alert('Session Cancelled', 'Attendance session was cancelled. No records saved.');
				}
				return;
			}
			
			// FIX: Absolute real-time update trigger
			if (event.data?.student_id) {
				setStudentsObj(prev => ({
					...prev,
					[event.data.student_id]: {
						...(prev[event.data.student_id] || {}),
						...event.data
					}
				}));
			}
		});

		const unsubChat = onStudentChatMessage((msg) => {
			setChatMessages(prev => {
				if (prev.some(m => m.message_id === msg.message_id)) return prev;
				return [...prev, msg];
			});

			if (mainTabRef.current !== 'chat') {
				setChatUnread(n => n + 1);
			} else {
				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
			}
		});

		const unsubHistory = onChatHistory((data) => {
			setChatMessages(data.messages);
		});

		const unsubProfReply = (() => {
			const handler = (msg: ChatMessage) => {
				setChatMessages(prev => {
					if (prev.some(m => m.message_id === msg.message_id)) return prev;
					return [...prev, { ...msg, sender_type: 'PROFESSOR' }];
				});
				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
			};
			const s = getSocket();
			if (s) {
				s.on('professor_reply_sent', handler);
				return () => s.off('professor_reply_sent', handler);
			}
			return () => {};
		})();

		return () => {
			unsubAttendance();
			unsubChat();
			unsubHistory();
			unsubProfReply();
			leaveSession(sessionId);
		};
	}, [sessionId]);

	useEffect(() => {
		if (chatMessages.length > 0) {
			setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
		}
	}, [chatMessages]);

	// ── Actions ───────────────────────────────────────────────────────────────
	async function handleEndSession() {
		Alert.alert(
			'End Session',
			'End the attendance session? Students can no longer verify.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'End Session', style: 'destructive',
					onPress: async () => {
						try {
							await ProfessorAPI.endSession(sessionId);
							setSessionEnded(true);
						} catch (err: any) {
							Alert.alert('Error', err.response?.data?.error || 'Failed to end session');
						}
					},
				},
			]
		);
	}

	async function handleCancelSession() {
		Alert.alert(
			'❌ Cancel Session',
			'This will DELETE all attendance records for this class. No attendance will be saved. Are you sure?',
			[
				{ text: 'Keep Session', style: 'cancel' },
				{
					text: 'Cancel Session', style: 'destructive',
					onPress: async () => {
						try {
							await ProfessorAPI.cancelSession(sessionId);
							setSessionEnded(true);
							Alert.alert('Cancelled', 'Session cancelled. No attendance recorded.');
						} catch (err: any) {
							Alert.alert('Error', err.response?.data?.error || 'Failed to cancel session');
						}
					},
				},
			]
		);
	}

	async function handleOverrideSubmit() {
		if (!selectedStudent) return;
		if (!overrideReason.trim()) {
			Alert.alert('Reason Required', 'Please enter a reason for the override.');
			return;
		}
		setOverriding(true);
		try {
			await ProfessorAPI.manualOverride(
				sessionId,
				selectedStudent.student_id,
				overrideStatus,
				overrideReason.trim()
			);
			setSelectedStudent(null);
			setOverrideReason('');
			setOverrideStatus('PRESENT');
		} catch (err: any) {
			Alert.alert('Error', err.response?.data?.error || 'Override failed');
		} finally {
			setOverriding(false);
		}
	}

	function handleSendChat() {
		const text = chatInput.trim();
		if (!text) return;
		
		// Send over network. We removed the optimistic UI append, 
		// so the message will only appear once the socket acknowledges it.
		sendChatMessage(sessionId, text);
		setChatInput('');
	}

	// ── Derived state ─────────────────────────────────────────────────────────
	
	// Convert dict back to sorted array for rendering
	const studentsArr = Object.values(studentsObj).sort((a, b) => 
		(a.name || '').localeCompare(b.name || '')
	);

	const notifiedArr     = studentsArr.filter(s => s.notified !== false);
	const unnotifiedArr   = studentsArr.filter(s => s.notified === false);

	const presentCount    = studentsArr.filter(s => s.status === 'PRESENT').length;
	const absentCount     = studentsArr.filter(s => s.status === 'ABSENT').length;
	const suspiciousCount = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
	const pendingCount    = studentsArr.filter(s => s.verification_status === 'PENDING').length;

	const isTimeLow = session
		? new Date(session.expires_at).getTime() - Date.now() < 2 * 60 * 1000
		: false;

	const visibleStudents: StudentCard[] =
		studentTab === 'notified'   ? notifiedArr :
		studentTab === 'unnotified' ? unnotifiedArr :
		studentsArr;

	// ── Loading ───────────────────────────────────────────────────────────────
	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color={COLORS.primary} />
				<Text style={styles.loadingText}>Loading dashboard...</Text>
			</View>
		);
	}

	// ─────────────────────────────────────────────────────────────────────────
	return (
		<SafeAreaView style={styles.safe} edges={['top']}>

			{/* ── HEADER ────────────────────────────────────────────────────────── */}
			{/* ── HEADER ────────────────────────────────────────────────────────── */}
			<View style={styles.header}>
				{/* Top Row: Info & Timer */}
				<View style={styles.headerTopRow}>
					<View style={styles.headerLeft}>
						<Text style={styles.headerTitle} numberOfLines={1}>
							{session?.course_name}{session?.section ? ` — ${session.section}` : ''}
						</Text>
						<Text style={styles.headerSub}>
							{session?.attendance_credits ?? 1} credit(s) • {session?.code}
						</Text>
					</View>
					{!sessionEnded && (
						<View style={[styles.timerBadge, isTimeLow && styles.timerBadgeDanger]}>
							<Text style={[styles.timerText, isTimeLow && { color: COLORS.white }]}>
								⏱ {formatTimer(timeLeft)}
							</Text>
						</View>
					)}
				</View>

				{/* Bottom Row: Horizontal Action Buttons */}
				<View style={styles.headerActionRow}>
					{!sessionEnded ? (
						<>
							<TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSession} activeOpacity={0.8}>
								<Text style={styles.cancelBtnText}>✕ Cancel</Text>
							</TouchableOpacity>
							<TouchableOpacity style={styles.endBtn} onPress={handleEndSession} activeOpacity={0.8}>
								<Text style={styles.endBtnText}>✅ End Session</Text>
							</TouchableOpacity>
						</>
					) : (
						<TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
							<Text style={styles.backBtnText}>← Back to Dashboard</Text>
						</TouchableOpacity>
					)}
				</View>
			</View>

			{sessionEnded && (
				<View style={styles.endedBanner}>
					<Text style={styles.endedBannerText}>
						🏁 Session ended — you can still override attendance below
					</Text>
				</View>
			)}

			{/* ── SUMMARY BAR ───────────────────────────────────────────────────── */}
			<View style={styles.summaryBar}>
				<SummaryPill label="Present"    value={presentCount}    color={COLORS.success} />
				<SummaryPill label="Absent"     value={absentCount}     color={COLORS.danger} />
				<SummaryPill label="Suspicious" value={suspiciousCount} color="#F59E0B" />
				<SummaryPill label="Pending"    value={pendingCount}    color={COLORS.textMuted} />
			</View>

			{/* ── MAIN TABS ─────────────────────────────────────────────────────── */}
			<View style={styles.tabs}>
				<TouchableOpacity
					style={[styles.tab, mainTab === 'students' && styles.tabActive]}
					onPress={() => setMainTab('students')}
				>
					<Text style={[styles.tabText, mainTab === 'students' && styles.tabTextActive]}>
						👥 Students ({studentsArr.length})
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.tab, mainTab === 'chat' && styles.tabActive]}
					onPress={() => { setMainTab('chat'); setChatUnread(0); }}
				>
					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
						<Text style={[styles.tabText, mainTab === 'chat' && styles.tabTextActive]}>
							💬 Chat
						</Text>
						{chatUnread > 0 && (
							<View style={styles.unreadBadge}>
								<Text style={styles.unreadBadgeText}>{chatUnread}</Text>
							</View>
						)}
					</View>
				</TouchableOpacity>
			</View>

			{/* ── STUDENTS TAB ──────────────────────────────────────────────────── */}
			{mainTab === 'students' && (
				<>
					<View style={styles.subTabRow}>
						<SubTab label={`All (${studentsArr.length})`} active={studentTab === 'all'} onPress={() => setStudentTab('all')} color={COLORS.primary} />
						<SubTab label={`📶 Notified (${notifiedArr.length})`} active={studentTab === 'notified'} onPress={() => setStudentTab('notified')} color={COLORS.success} />
						<SubTab label={`⚠️ Outside Range (${unnotifiedArr.length})`} active={studentTab === 'unnotified'} onPress={() => setStudentTab('unnotified')} color="#F59E0B" />
					</View>

					{studentTab === 'unnotified' && unnotifiedArr.length > 0 && (
						<View style={styles.hintBanner}>
							<Text style={styles.hintText}>
								⚠️ These students were outside the classroom range when the session started.
								They received no push notification. Mark them present manually if you can physically verify them — or they may be proxies.
							</Text>
						</View>
					)}
					{studentTab === 'unnotified' && unnotifiedArr.length === 0 && (
						<View style={styles.hintBanner}>
							<Text style={styles.hintText}>
								✅ All enrolled students were within range when the session started.
							</Text>
						</View>
					)}

					<FlatList
						data={visibleStudents}
						extraData={studentsObj} // FIX: Forces FlatList to re-render when objects update
						keyExtractor={item => item.student_id}
						numColumns={2}
						contentContainerStyle={styles.grid}
						columnWrapperStyle={styles.gridRow}
						ListEmptyComponent={
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyIcon}>{studentTab === 'unnotified' ? '✅' : '👥'}</Text>
								<Text style={styles.emptyText}>
									{studentTab === 'unnotified' ? 'No students outside range' : 'No students in session yet'}
								</Text>
							</View>
						}
						renderItem={({ item }) => (
							<StudentCard
								student={item}
								bg={getCardBg(item)}
								border={getCardBorder(item)}
								statusIcon={getStatusIcon(item)}
								onPress={() => {
									setSelectedStudent(item);
									setOverrideStatus(item.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
									setOverrideReason('');
								}}
							/>
						)}
					/>
				</>
			)}

			{/* ── CHAT TAB ──────────────────────────────────────────────────────── */}
			{mainTab === 'chat' && (
				<KeyboardAvoidingView
					style={{ flex: 1 }}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
					keyboardVerticalOffset={120}
				>
					<FlatList
						ref={chatListRef}
						data={chatMessages}
						keyExtractor={(item, i) => item.message_id + i}
						contentContainerStyle={styles.chatList}
						ListEmptyComponent={
							<View style={styles.emptyContainer}>
								<Text style={styles.emptyIcon}>💬</Text>
								<Text style={styles.emptyText}>
									No messages yet.{'\n'}Students can message you here during the session.
								</Text>
							</View>
						}
						onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
						renderItem={({ item }) => <ChatBubble message={item} isMe={item.sender_type === 'PROFESSOR'} />}
					/>
					<View style={styles.chatInputRow}>
						<TextInput
							style={styles.chatInput}
							value={chatInput}
							onChangeText={setChatInput}
							placeholder="Reply to students..."
							placeholderTextColor={COLORS.textMuted}
							multiline
							maxLength={500}
							returnKeyType="send"
							onSubmitEditing={handleSendChat}
						/>
						<TouchableOpacity
							style={[styles.chatSendBtn, !chatInput.trim() && styles.chatSendBtnDisabled]}
							onPress={handleSendChat}
							disabled={!chatInput.trim()}
						>
							<Text style={styles.chatSendBtnText}>Send</Text>
						</TouchableOpacity>
					</View>
				</KeyboardAvoidingView>
			)}

			{/* ── OVERRIDE MODAL ────────────────────────────────────────────────── */}
			<Modal visible={!!selectedStudent} transparent animationType="fade" onRequestClose={() => setSelectedStudent(null)}>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						{selectedStudent && (
							<>
								<View style={styles.modalHeader}>
									<View style={{ flex: 1 }}>
										<Text style={styles.modalName}>{selectedStudent.name}</Text>
										<Text style={styles.modalRoll}>{selectedStudent.roll_number}</Text>
										{selectedStudent.notified === false && (
											<View style={styles.proxyWarningBadge}>
												<Text style={styles.proxyWarningText}>⚠️ Was outside classroom range — possible proxy</Text>
											</View>
										)}
									</View>
									<TouchableOpacity onPress={() => setSelectedStudent(null)}>
										<Text style={styles.modalClose}>✕</Text>
									</TouchableOpacity>
								</View>

								<View style={styles.scoresRow}>
									<ModalScore label="Face"     value={selectedStudent.face_score}     threshold={0.65} />
									<ModalScore label="Liveness" value={selectedStudent.liveness_score} threshold={0.70} />
									<ModalScore label="Scene"    value={selectedStudent.scene_score}    threshold={0.60} />
								</View>

								<View style={[styles.statusRow, { backgroundColor: getCardBg(selectedStudent) }]}>
									<Text style={styles.statusRowIcon}>{getStatusIcon(selectedStudent)}</Text>
									<View style={{ flex: 1 }}>
										<Text style={styles.statusRowText}>
											{selectedStudent.status === 'PRESENT' ? 'Currently: Present' : 'Currently: Absent'}
										</Text>
										{selectedStudent.marked_by === 'PROFESSOR' && (
											<Text style={styles.markedBy}>
												Manually overridden
												{(selectedStudent as any).override_reason ? `: ${(selectedStudent as any).override_reason}` : ''}
											</Text>
										)}
									</View>
								</View>

								<Text style={styles.overrideLabel}>Change to:</Text>
								<View style={styles.overrideToggleRow}>
									<TouchableOpacity
										style={[styles.overrideToggleBtn, overrideStatus === 'PRESENT' && styles.overrideToggleBtnActivePresent]}
										onPress={() => setOverrideStatus('PRESENT')}
									>
										<Text style={[styles.overrideToggleBtnText, overrideStatus === 'PRESENT' && { color: COLORS.white }]}>✅ Present</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={[styles.overrideToggleBtn, overrideStatus === 'ABSENT' && styles.overrideToggleBtnActiveAbsent]}
										onPress={() => setOverrideStatus('ABSENT')}
									>
										<Text style={[styles.overrideToggleBtnText, overrideStatus === 'ABSENT' && { color: COLORS.white }]}>❌ Absent</Text>
									</TouchableOpacity>
								</View>

								<TextInput
									style={styles.reasonInput}
									value={overrideReason}
									onChangeText={setOverrideReason}
									placeholder="Reason (required) — e.g. physically verified, student appeal..."
									placeholderTextColor={COLORS.textMuted}
									multiline
									maxLength={500}
								/>

								<TouchableOpacity
									style={[styles.overrideBtn, overriding && { opacity: 0.6 }]}
									onPress={handleOverrideSubmit}
									disabled={overriding}
								>
									{overriding ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.overrideBtnText}>Apply Override</Text>}
								</TouchableOpacity>

								<TouchableOpacity style={styles.closeBtnSecondary} onPress={() => setSelectedStudent(null)}>
									<Text style={styles.closeBtnSecondaryText}>Close</Text>
								</TouchableOpacity>
							</>
						)}
					</View>
				</View>
			</Modal>

		</SafeAreaView>
	);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SubTab({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
	return (
		<TouchableOpacity style={[styles.subTab, active && { borderBottomColor: color, borderBottomWidth: 2.5 }]} onPress={onPress}>
			<Text style={[styles.subTabText, active && { color, fontWeight: '700' }]}>{label}</Text>
		</TouchableOpacity>
	);
}

function StudentCard({ student, bg, border, statusIcon, onPress }: { student: StudentCard; bg: string; border: string; statusIcon: string; onPress: () => void; }) {
	const fadeAnim = useRef(new Animated.Value(0)).current;
	useEffect(() => {
		Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
	}, [student.verification_status, student.status]);

	return (
		<TouchableOpacity onPress={onPress} activeOpacity={0.8}>
			<Animated.View style={[styles.studentCard, { backgroundColor: bg, borderColor: border, opacity: fadeAnim, width: CARD_W }]}>
				{student.notified === false && (
					<View style={styles.outsideRangePip}>
						<Text style={{ fontSize: 8, color: '#fff', fontWeight: '800' }}>OUT</Text>
					</View>
				)}

				<View style={[styles.studentAvatar, { borderColor: border }]}>
					<Text style={styles.studentAvatarText}>{student.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
				</View>

				<Text style={styles.studentStatusIcon}>{statusIcon}</Text>
				<Text style={styles.studentName} numberOfLines={2}>{student.name}</Text>
				<Text style={styles.studentRoll}>{student.roll_number}</Text>

				{student.face_score != null && (
					<Text style={styles.studentScore}>
						F:{Math.round(student.face_score * 100)}%
						{student.scene_score != null ? ` S:${Math.round(student.scene_score * 100)}%` : ''}
					</Text>
				)}

				{student.marked_by === 'PROFESSOR' && <Text style={styles.manualTag}>✋ Manual</Text>}
			</Animated.View>
		</TouchableOpacity>
	);
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
	return (
		<View style={[styles.summaryPill, { backgroundColor: color + '18' }]}>
			<Text style={[styles.summaryValue, { color }]}>{value}</Text>
			<Text style={[styles.summaryLabel, { color }]}>{label}</Text>
		</View>
	);
}

function ModalScore({ label, value, threshold }: { label: string; value?: number; threshold: number }) {
	if (value == null) return (
		<View style={styles.modalScore}>
			<Text style={styles.modalScoreLabel}>{label}</Text>
			<Text style={styles.modalScoreValue}>—</Text>
		</View>
	);
	const pct = Math.round(value * 100);
	const color = value >= threshold ? COLORS.success : COLORS.danger;
	return (
		<View style={styles.modalScore}>
			<Text style={styles.modalScoreLabel}>{label}</Text>
			<Text style={[styles.modalScoreValue, { color }]}>{pct}%</Text>
		</View>
	);
}

function ChatBubble({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
	return (
		<View style={[styles.chatRow, isMe ? styles.chatRowMe : styles.chatRowOther]}>
			<View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubbleOther]}>
				{!isMe && (
					<Text style={styles.chatSenderName}>{message.student_name} ({message.roll_number})</Text>
				)}
				<Text style={[styles.chatText, isMe && styles.chatTextMe]}>{message.message}</Text>
				<Text style={[styles.chatTime, isMe && styles.chatTimeMe]}>{formatTime(message.created_at)}</Text>
			</View>
		</View>
	);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
	safe:        { flex: 1, backgroundColor: COLORS.background },
	center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
	loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: 14 },

	// ── HEADER STYLES ──
	header: {
		backgroundColor: COLORS.primary, 
		padding: SPACING.md,
		paddingBottom: SPACING.md,
	},
	headerTopRow: {
		flexDirection: 'row', 
		justifyContent: 'space-between', 
		alignItems: 'flex-start',
	},
	headerLeft:  { flex: 1, marginRight: SPACING.sm },
	headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
	headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },
	
	// Timer
	timerBadge: {
		backgroundColor: 'rgba(0,0,0,0.25)', 
		borderRadius: RADIUS.full,
		paddingHorizontal: 12, 
		paddingVertical: 6,
		borderWidth: 1,
		borderColor: 'rgba(255,255,255,0.1)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	timerBadgeDanger: { 
		backgroundColor: COLORS.danger, 
		borderColor: '#FF4D4D' 
	},
	timerText:   { color: COLORS.white, fontWeight: '700', fontSize: 13, letterSpacing: 1 },

	// Action Row
	headerActionRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		marginTop: 16,
		gap: SPACING.sm,
	},
	endBtn: { 
		backgroundColor: COLORS.success, 
		borderRadius: RADIUS.full, 
		paddingHorizontal: 16, 
		paddingVertical: 8, 
		alignItems: 'center',
		shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
	},
	endBtnText:  { color: COLORS.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
	cancelBtn:   { 
		backgroundColor: 'rgba(255,255,255,0.15)', 
		borderRadius: RADIUS.full, 
		paddingHorizontal: 16, 
		paddingVertical: 8, 
		alignItems: 'center',
	},
	cancelBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
	backBtn:     { 
		backgroundColor: 'rgba(255,255,255,0.2)', 
		borderRadius: RADIUS.full, 
		paddingHorizontal: 18, 
		paddingVertical: 10,
		width: '100%',
		alignItems: 'center',
	},
	backBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

	endedBanner: { backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B', padding: SPACING.sm, paddingHorizontal: SPACING.md },
	endedBannerText: { color: '#92400E', fontSize: 12, fontWeight: '600' },

	summaryBar: {
		flexDirection: 'row', justifyContent: 'space-between',
		padding: SPACING.sm, backgroundColor: COLORS.white,
		borderBottomWidth: 1, borderBottomColor: COLORS.border,
	},
	summaryPill:  { flex: 1, alignItems: 'center', borderRadius: RADIUS.sm, paddingVertical: SPACING.xs, marginHorizontal: 2 },
	summaryValue: { fontSize: 18, fontWeight: '800' },
	summaryLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },

	tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
	tab: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
	tabActive: { borderBottomColor: COLORS.primary },
	tabText:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
	tabTextActive: { color: COLORS.primary },
	unreadBadge: { backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
	unreadBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

	subTabRow: {
		flexDirection: 'row', backgroundColor: COLORS.white,
		borderBottomWidth: 1, borderBottomColor: COLORS.border,
	},
	subTab: {
		flex: 1, alignItems: 'center', paddingVertical: 9,
		borderBottomWidth: 2, borderBottomColor: 'transparent',
	},
	subTabText: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted },

	hintBanner: {
		backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B',
		paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
	},
	hintText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

	grid:           { padding: SPACING.md, gap: SPACING.sm },
	gridRow:        { gap: SPACING.sm, justifyContent: 'flex-start' },
	emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACING.xl },
	emptyIcon:      { fontSize: 48 },
	emptyText:      { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14, textAlign: 'center', lineHeight: 22 },

	studentCard: {
		borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', borderWidth: 2,
		shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
	},
	outsideRangePip: {
		position: 'absolute', top: 6, left: 6,
		backgroundColor: '#F59E0B', borderRadius: 6,
		paddingHorizontal: 5, paddingVertical: 2,
	},
	studentAvatar:     { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs },
	studentAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
	studentStatusIcon: { fontSize: 16, position: 'absolute', top: 6, right: 6 },
	studentName:       { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginTop: SPACING.xs },
	studentRoll:       { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
	studentScore:      { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
	manualTag:         { fontSize: 9, color: COLORS.primary, marginTop: 2, fontWeight: '700' },

	chatList:       { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },
	chatRow:        { flexDirection: 'row', marginBottom: SPACING.xs },
	chatRowMe:      { justifyContent: 'flex-end' },
	chatRowOther:   { justifyContent: 'flex-start' },
	chatBubble:     { maxWidth: '80%', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
	chatBubbleMe:   { backgroundColor: COLORS.primary },
	chatBubbleOther: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
	chatSenderName: { fontSize: 10, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
	chatText:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
	chatTextMe:     { color: COLORS.white },
	chatTime:       { fontSize: 9, color: COLORS.textMuted, marginTop: 3, textAlign: 'right' },
	chatTimeMe:     { color: 'rgba(255,255,255,0.6)' },
	chatInputRow:   { flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white, gap: SPACING.xs },
	chatInput:      { flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, fontSize: 13, maxHeight: 80, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
	chatSendBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
	chatSendBtnDisabled: { opacity: 0.4 },
	chatSendBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

	modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
	modalCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
	modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
	modalName:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
	modalRoll:    { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
	modalClose:   { fontSize: 22, color: COLORS.textSecondary, padding: 4 },
	proxyWarningBadge: { marginTop: 6, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
	proxyWarningText:  { fontSize: 11, color: '#92400E', fontWeight: '600' },
	scoresRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm },
	modalScore:   { flex: 1, alignItems: 'center' },
	modalScoreLabel: { fontSize: 11, color: COLORS.textMuted },
	modalScoreValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
	statusRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, gap: SPACING.xs },
	statusRowIcon: { fontSize: 18 },
	statusRowText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
	markedBy:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
	overrideLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs },
	overrideToggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
	overrideToggleBtn: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, padding: SPACING.sm, alignItems: 'center' },
	overrideToggleBtnActivePresent: { backgroundColor: COLORS.success, borderColor: COLORS.success },
	overrideToggleBtnActiveAbsent:  { backgroundColor: COLORS.danger,  borderColor: COLORS.danger  },
	overrideToggleBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
	reasonInput:  { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 13, color: COLORS.textPrimary, minHeight: 60, marginBottom: SPACING.md, backgroundColor: COLORS.background },
	overrideBtn:  { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm },
	overrideBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
	closeBtnSecondary: { padding: SPACING.sm, alignItems: 'center' },
	closeBtnSecondaryText: { color: COLORS.textSecondary, fontSize: 14 },
});