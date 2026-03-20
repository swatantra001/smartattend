// import React, {
// 	useEffect, useRef, useState, useCallback,
// } from 'react';
// import {
// 	View, Text, StyleSheet, FlatList, TouchableOpacity,
// 	Modal, TextInput, ActivityIndicator, Alert, Animated,
// 	KeyboardAvoidingView, Platform, ScrollView, Image
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useLocalSearchParams, router } from 'expo-router';
// import { Dimensions } from 'react-native';
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

// interface StudentCard extends DashboardStudentCard {
// 	notified?: boolean;
// 	captured_image_b64?: string; // 👈 NEW
// }

// type StudentTab = 'all' | 'notified' | 'unnotified';

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// function getCardBg(s: StudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '#F0FFF4';
// 	if (s.verification_status === 'SUSPICIOUS') return '#FFFBEB';
// 	if (s.verification_status === 'FAILED') return '#FFF5F5';
// 	return COLORS.white;
// }
// function getCardBorder(s: StudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return COLORS.success;
// 	if (s.verification_status === 'SUSPICIOUS') return '#F59E0B';
// 	if (s.verification_status === 'FAILED') return COLORS.danger;
// 	return COLORS.border;
// }
// function getStatusIcon(s: StudentCard): string {
// 	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '✅';
// 	if (s.verification_status === 'SUSPICIOUS') return '⚠️';
// 	if (s.verification_status === 'FAILED') return '❌';
// 	if (s.marked_by === 'PROFESSOR') return '✋';
// 	return '⏳';
// }
// function formatTime(iso: string): string {
// 	return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

// 	const [session, setSession]       = useState<SessionInfo | null>(null);
// 	// FIX: Switched from Map to standard Object for guaranteed React re-renders
// 	const [studentsObj, setStudentsObj] = useState<Record<string, StudentCard>>({});
// 	const [loading, setLoading]       = useState(true);
// 	const [sessionEnded, setSessionEnded] = useState(false);
// 	const [timeLeft, setTimeLeft]     = useState<number>(0);

// 	const [mainTab, setMainTab]         = useState<'students' | 'chat'>('students');
// 	const [studentTab, setStudentTab]   = useState<StudentTab>('all');

// 	// FIX: Ref required to prevent stale closures inside socket event listeners
// 	const mainTabRef = useRef(mainTab);
// 	useEffect(() => {
// 		mainTabRef.current = mainTab;
// 	}, [mainTab]);

// 	// 👈 NEW: State for Full Screen Image Viewer
//     const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

// 	// Override modal
// 	const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
// 	const [overrideStatus, setOverrideStatus]   = useState<'PRESENT' | 'ABSENT'>('PRESENT');
// 	const [overrideReason, setOverrideReason]   = useState('');
// 	const [overriding, setOverriding]           = useState(false);

// 	// Chat
// 	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
// 	const [chatInput, setChatInput]       = useState('');
// 	const [chatUnread, setChatUnread]     = useState(0);
// 	const chatListRef  = useRef<FlatList>(null);
// 	const timerRef     = useRef<ReturnType<typeof setInterval>>();

// 	// ── Load dashboard ────────────────────────────────────────────────────────
// 	const loadDashboard = useCallback(async () => {
// 		try {
// 			const res  = await ProfessorAPI.getDashboard(sessionId);
// 			const data = res.data.data;
// 			setSession(data.session);

// 			const obj: Record<string, StudentCard> = {};
// 			data.students.forEach((s: StudentCard) => {
// 				obj[s.student_id] = s;
// 			});
// 			setStudentsObj(obj);

// 			if (data.session.status !== 'ACTIVE') setSessionEnded(true);
// 		} catch {
// 			Alert.alert('Error', 'Failed to load dashboard');
// 		} finally {
// 			setLoading(false);
// 		}
// 	}, [sessionId]);

// 	// ── Countdown timer ───────────────────────────────────────────────────────
// 	useEffect(() => {
// 		if (!session?.expires_at) return;
// 		const update = () => {
// 			const remaining = Math.max(
// 				0,
// 				Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000)
// 			);
// 			setTimeLeft(remaining);
// 			if (remaining === 0) clearInterval(timerRef.current);
// 		};
// 		update();
// 		timerRef.current = setInterval(update, 1000);
// 		return () => clearInterval(timerRef.current);
// 	}, [session?.expires_at]);

// 	// ── Socket + initial load ─────────────────────────────────────────────────
// 	useEffect(() => {
// 		loadDashboard();
// 		joinSession(sessionId);
// 		requestChatHistory(sessionId);

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

// 			// FIX: Absolute real-time update trigger
// 			if (event.data?.student_id) {
// 				setStudentsObj(prev => ({
// 					...prev,
// 					[event.data.student_id]: {
// 						...(prev[event.data.student_id] || {}),
// 						...event.data
// 					}
// 				}));
// 			}
// 		});

// 		const unsubChat = onStudentChatMessage((msg) => {
// 			setChatMessages(prev => {
// 				if (prev.some(m => m.message_id === msg.message_id)) return prev;
// 				return [...prev, msg];
// 			});

// 			if (mainTabRef.current !== 'chat') {
// 				setChatUnread(n => n + 1);
// 			} else {
// 				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
// 			}
// 		});

// 		const unsubHistory = onChatHistory((data) => {
// 			setChatMessages(data.messages);
// 		});

// 		const unsubProfReply = (() => {
// 			const handler = (msg: ChatMessage) => {
// 				setChatMessages(prev => {
// 					if (prev.some(m => m.message_id === msg.message_id)) return prev;
// 					return [...prev, { ...msg, sender_type: 'PROFESSOR' }];
// 				});
// 				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
// 			};
// 			const s = getSocket();
// 			if (s) {
// 				s.on('professor_reply_sent', handler);
// 				return () => s.off('professor_reply_sent', handler);
// 			}
// 			return () => {};
// 		})();

// 		return () => {
// 			unsubAttendance();
// 			unsubChat();
// 			unsubHistory();
// 			unsubProfReply();
// 			leaveSession(sessionId);
// 		};
// 	}, [sessionId]);

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
// 			Alert.alert('Reason Required', 'Please enter a reason for the override.');
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

// 		// Send over network. We removed the optimistic UI append, 
// 		// so the message will only appear once the socket acknowledges it.
// 		sendChatMessage(sessionId, text);
// 		setChatInput('');
// 	}

// 	// ── Derived state ─────────────────────────────────────────────────────────

// 	// Convert dict back to sorted array for rendering
// 	const studentsArr = Object.values(studentsObj).sort((a, b) => 
// 		(a.name || '').localeCompare(b.name || '')
// 	);

// 	const notifiedArr     = studentsArr.filter(s => s.notified !== false);
// 	const unnotifiedArr   = studentsArr.filter(s => s.notified === false);

// 	const presentCount    = studentsArr.filter(s => s.status === 'PRESENT').length;
// 	const absentCount     = studentsArr.filter(s => s.status === 'ABSENT').length;
// 	const suspiciousCount = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
// 	const pendingCount    = studentsArr.filter(s => s.verification_status === 'PENDING').length;

// 	const isTimeLow = session
// 		? new Date(session.expires_at).getTime() - Date.now() < 2 * 60 * 1000
// 		: false;

// 	const visibleStudents: StudentCard[] =
// 		studentTab === 'notified'   ? notifiedArr :
// 		studentTab === 'unnotified' ? unnotifiedArr :
// 		studentsArr;

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

// 			{/* ── HEADER ────────────────────────────────────────────────────────── */}
// 			{/* ── HEADER ────────────────────────────────────────────────────────── */}
// 			<View style={styles.header}>
// 				{/* Top Row: Info & Timer */}
// 				<View style={styles.headerTopRow}>
// 					<View style={styles.headerLeft}>
// 						<Text style={styles.headerTitle} numberOfLines={1}>
// 							{session?.course_name}{session?.section ? ` — ${session.section}` : ''}
// 						</Text>
// 						<Text style={styles.headerSub}>
// 							{session?.attendance_credits ?? 1} credit(s) • {session?.code}
// 						</Text>
// 					</View>
// 					{!sessionEnded && (
// 						<View style={[styles.timerBadge, isTimeLow && styles.timerBadgeDanger]}>
// 							<Text style={[styles.timerText, isTimeLow && { color: COLORS.white }]}>
// 								⏱ {formatTimer(timeLeft)}
// 							</Text>
// 						</View>
// 					)}
// 				</View>

// 				{/* Bottom Row: Horizontal Action Buttons */}
// 				<View style={styles.headerActionRow}>
// 					{!sessionEnded ? (
// 						<>
// 							<TouchableOpacity style={styles.cancelBtn} onPress={handleCancelSession} activeOpacity={0.8}>
// 								<Text style={styles.cancelBtnText}>✕ Cancel</Text>
// 							</TouchableOpacity>
// 							<TouchableOpacity style={styles.endBtn} onPress={handleEndSession} activeOpacity={0.8}>
// 								<Text style={styles.endBtnText}>✅ End Session</Text>
// 							</TouchableOpacity>
// 						</>
// 					) : (
// 						<TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
// 							<Text style={styles.backBtnText}>← Back to Dashboard</Text>
// 						</TouchableOpacity>
// 					)}
// 				</View>
// 			</View>

// 			{sessionEnded && (
// 				<View style={styles.endedBanner}>
// 					<Text style={styles.endedBannerText}>
// 						🏁 Session ended — you can still override attendance below
// 					</Text>
// 				</View>
// 			)}

// 			{/* ── SUMMARY BAR ───────────────────────────────────────────────────── */}
// 			<View style={styles.summaryBar}>
// 				<SummaryPill label="Present"    value={presentCount}    color={COLORS.success} />
// 				<SummaryPill label="Absent"     value={absentCount}     color={COLORS.danger} />
// 				<SummaryPill label="Suspicious" value={suspiciousCount} color="#F59E0B" />
// 				<SummaryPill label="Pending"    value={pendingCount}    color={COLORS.textMuted} />
// 			</View>

// 			{/* ── MAIN TABS ─────────────────────────────────────────────────────── */}
// 			<View style={styles.tabs}>
// 				<TouchableOpacity
// 					style={[styles.tab, mainTab === 'students' && styles.tabActive]}
// 					onPress={() => setMainTab('students')}
// 				>
// 					<Text style={[styles.tabText, mainTab === 'students' && styles.tabTextActive]}>
// 						👥 Students ({studentsArr.length})
// 					</Text>
// 				</TouchableOpacity>
// 				<TouchableOpacity
// 					style={[styles.tab, mainTab === 'chat' && styles.tabActive]}
// 					onPress={() => { setMainTab('chat'); setChatUnread(0); }}
// 				>
// 					<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
// 						<Text style={[styles.tabText, mainTab === 'chat' && styles.tabTextActive]}>
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

// 			{/* ── STUDENTS TAB ──────────────────────────────────────────────────── */}
// 			{mainTab === 'students' && (
// 				<>
// 					<View style={styles.subTabRow}>
// 						<SubTab label={`All (${studentsArr.length})`} active={studentTab === 'all'} onPress={() => setStudentTab('all')} color={COLORS.primary} />
// 						<SubTab label={`📶 Notified (${notifiedArr.length})`} active={studentTab === 'notified'} onPress={() => setStudentTab('notified')} color={COLORS.success} />
// 						<SubTab label={`⚠️ Outside Range (${unnotifiedArr.length})`} active={studentTab === 'unnotified'} onPress={() => setStudentTab('unnotified')} color="#F59E0B" />
// 					</View>

// 					{studentTab === 'unnotified' && unnotifiedArr.length > 0 && (
// 						<View style={styles.hintBanner}>
// 							<Text style={styles.hintText}>
// 								⚠️ These students were outside the classroom range when the session started.
// 								They received no push notification. Mark them present manually if you can physically verify them — or they may be proxies.
// 							</Text>
// 						</View>
// 					)}
// 					{studentTab === 'unnotified' && unnotifiedArr.length === 0 && (
// 						<View style={styles.hintBanner}>
// 							<Text style={styles.hintText}>
// 								✅ All enrolled students were within range when the session started.
// 							</Text>
// 						</View>
// 					)}

// 					<FlatList
// 						data={visibleStudents}
// 						extraData={studentsObj} // FIX: Forces FlatList to re-render when objects update
// 						keyExtractor={item => item.student_id}
// 						numColumns={2}
// 						contentContainerStyle={styles.grid}
// 						columnWrapperStyle={styles.gridRow}
// 						ListEmptyComponent={
// 							<View style={styles.emptyContainer}>
// 								<Text style={styles.emptyIcon}>{studentTab === 'unnotified' ? '✅' : '👥'}</Text>
// 								<Text style={styles.emptyText}>
// 									{studentTab === 'unnotified' ? 'No students outside range' : 'No students in session yet'}
// 								</Text>
// 							</View>
// 						}
// 						renderItem={({ item }) => (
// 							<StudentCard
// 								student={item}
// 								bg={getCardBg(item)}
// 								border={getCardBorder(item)}
// 								statusIcon={getStatusIcon(item)}
// 								onPress={() => {
// 									setSelectedStudent(item);
// 									setOverrideStatus(item.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
// 									setOverrideReason('');
// 								}}
// 							/>
// 						)}
// 					/>
// 				</>
// 			)}

// 			{/* ── CHAT TAB ──────────────────────────────────────────────────────── */}
// 			{mainTab === 'chat' && (
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
// 						onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
// 						renderItem={({ item }) => <ChatBubble message={item} isMe={item.sender_type === 'PROFESSOR'} />}
// 					/>
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

// 			{/* ── OVERRIDE MODAL ────────────────────────────────────────────────── */}
// 			<Modal visible={!!selectedStudent} transparent animationType="fade" onRequestClose={() => setSelectedStudent(null)}>
// 				<View style={styles.modalOverlay}>
// 					<View style={styles.modalCard}>
// 						{selectedStudent && (
// 							<>
// 								<View style={styles.modalHeader}>
// 									<View style={{ flex: 1 }}>
// 										<Text style={styles.modalName}>{selectedStudent.name}</Text>
// 										<Text style={styles.modalRoll}>{selectedStudent.roll_number}</Text>
// 										{selectedStudent.notified === false && (
// 											<View style={styles.proxyWarningBadge}>
// 												<Text style={styles.proxyWarningText}>⚠️ Was outside classroom range — possible proxy</Text>
// 											</View>
// 										)}
// 									</View>
// 									<TouchableOpacity onPress={() => setSelectedStudent(null)}>
// 										<Text style={styles.modalClose}>✕</Text>
// 									</TouchableOpacity>
// 								</View>

// 								{/* 👈 NEW: Display Captured Image in Modal */}
//                                 {selectedStudent.captured_image_b64 ? (
//                                     <TouchableOpacity 
//                                         activeOpacity={0.9} 
//                                         onPress={() => setFullScreenImage(selectedStudent.captured_image_b64!)}
//                                     >
//                                         <Image 
//                                             source={{ uri: `data:image/jpeg;base64,${selectedStudent.captured_image_b64}` }} 
//                                             style={styles.modalLargeImage} 
//                                         />
//                                         <View style={styles.zoomHintBadge}>
//                                             <Text style={styles.zoomHintText}>🔍 Tap to enlarge</Text>
//                                         </View>
//                                     </TouchableOpacity>
//                                 ) : (
//                                     <View style={styles.modalNoImage}>
//                                         <Text style={styles.modalNoImageText}>No live capture available</Text>
//                                     </View>
//                                 )}

// 								<View style={styles.scoresRow}>
// 									<ModalScore label="Face"     value={selectedStudent.face_score}     threshold={0.65} />
// 									<ModalScore label="Liveness" value={selectedStudent.liveness_score} threshold={0.70} />
// 									<ModalScore label="Scene"    value={selectedStudent.scene_score}    threshold={0.60} />
// 								</View>

// 								<View style={[styles.statusRow, { backgroundColor: getCardBg(selectedStudent) }]}>
// 									<Text style={styles.statusRowIcon}>{getStatusIcon(selectedStudent)}</Text>
// 									<View style={{ flex: 1 }}>
// 										<Text style={styles.statusRowText}>
// 											{selectedStudent.status === 'PRESENT' ? 'Currently: Present' : 'Currently: Absent'}
// 										</Text>
// 										{selectedStudent.marked_by === 'PROFESSOR' && (
// 											<Text style={styles.markedBy}>
// 												Manually overridden
// 												{(selectedStudent as any).override_reason ? `: ${(selectedStudent as any).override_reason}` : ''}
// 											</Text>
// 										)}
// 									</View>
// 								</View>

// 								<Text style={styles.overrideLabel}>Change to:</Text>
// 								<View style={styles.overrideToggleRow}>
// 									<TouchableOpacity
// 										style={[styles.overrideToggleBtn, overrideStatus === 'PRESENT' && styles.overrideToggleBtnActivePresent]}
// 										onPress={() => setOverrideStatus('PRESENT')}
// 									>
// 										<Text style={[styles.overrideToggleBtnText, overrideStatus === 'PRESENT' && { color: COLORS.white }]}>✅ Present</Text>
// 									</TouchableOpacity>
// 									<TouchableOpacity
// 										style={[styles.overrideToggleBtn, overrideStatus === 'ABSENT' && styles.overrideToggleBtnActiveAbsent]}
// 										onPress={() => setOverrideStatus('ABSENT')}
// 									>
// 										<Text style={[styles.overrideToggleBtnText, overrideStatus === 'ABSENT' && { color: COLORS.white }]}>❌ Absent</Text>
// 									</TouchableOpacity>
// 								</View>

// 								<TextInput
// 									style={styles.reasonInput}
// 									value={overrideReason}
// 									onChangeText={setOverrideReason}
// 									placeholder="Reason (required) — e.g. physically verified, student appeal..."
// 									placeholderTextColor={COLORS.textMuted}
// 									multiline
// 									maxLength={500}
// 								/>

// 								<TouchableOpacity
// 									style={[styles.overrideBtn, overriding && { opacity: 0.6 }]}
// 									onPress={handleOverrideSubmit}
// 									disabled={overriding}
// 								>
// 									{overriding ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.overrideBtnText}>Apply Override</Text>}
// 								</TouchableOpacity>

// 								<TouchableOpacity style={styles.closeBtnSecondary} onPress={() => setSelectedStudent(null)}>
// 									<Text style={styles.closeBtnSecondaryText}>Close</Text>
// 								</TouchableOpacity>
// 							</>
// 						)}
// 					</View>
// 				</View>
// 			</Modal>

// 			{/* 👈 NEW: Full Screen Image Viewer Modal */}
//             <Modal visible={!!fullScreenImage} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
//                 <View style={styles.fullScreenOverlay}>
//                     <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenImage(null)}>
//                         <Text style={styles.fullScreenCloseText}>✕ Close</Text>
//                     </TouchableOpacity>
//                     {fullScreenImage && (
//                         <Image
//                             source={{ uri: `data:image/jpeg;base64,${fullScreenImage}` }}
//                             style={styles.fullScreenImage}
//                             resizeMode="contain"
//                         />
//                     )}
//                 </View>
//             </Modal>

// 		</SafeAreaView>
// 	);
// }

// // ─── Sub-components ───────────────────────────────────────────────────────────

// function SubTab({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color: string }) {
// 	return (
// 		<TouchableOpacity style={[styles.subTab, active && { borderBottomColor: color, borderBottomWidth: 2.5 }]} onPress={onPress}>
// 			<Text style={[styles.subTabText, active && { color, fontWeight: '700' }]}>{label}</Text>
// 		</TouchableOpacity>
// 	);
// }

// function StudentCard({ student, bg, border, statusIcon, onPress }: { student: StudentCard; bg: string; border: string; statusIcon: string; onPress: () => void; }) {
// 	const fadeAnim = useRef(new Animated.Value(0)).current;
// 	useEffect(() => {
// 		Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
// 	}, [student.verification_status, student.status]);

// 	return (
// 		<TouchableOpacity onPress={onPress} activeOpacity={0.8}>
// 			<Animated.View style={[styles.studentCard, { backgroundColor: bg, borderColor: border, opacity: fadeAnim, width: CARD_W }]}>
// 				{student.notified === false && (
// 					<View style={styles.outsideRangePip}>
// 						<Text style={{ fontSize: 8, color: '#fff', fontWeight: '800' }}>OUT</Text>
// 					</View>
// 				)}

// 				<View style={[styles.studentAvatar, { borderColor: border }]}>
// 					<Text style={styles.studentAvatarText}>{student.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
// 				</View>

// 				<Text style={styles.studentStatusIcon}>{statusIcon}</Text>
// 				{/* 👈 NEW: Large Photo Header */}
//                 {student.captured_image_b64 ? (
//                     <Image 
//                         source={{ uri: `data:image/jpeg;base64,${student.captured_image_b64}` }} 
//                         style={styles.studentLargeDisplayImage} 
//                     />
//                 ) : (
//                     <View style={[styles.studentLargeDisplayImage, { backgroundColor: 'rgba(0,0,0,0.04)', justifyContent: 'center', alignItems: 'center' }]}>
//                         <Text style={styles.studentAvatarText}>{student.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
//                     </View>
//                 )}
// 				<Text style={styles.studentName} numberOfLines={2}>{student.name}</Text>
// 				<Text style={styles.studentRoll}>{student.roll_number}</Text>

// 				{student.face_score != null && (
// 					<Text style={styles.studentScore}>
// 						F:{Math.round(student.face_score * 100)}%
// 						{student.scene_score != null ? ` S:${Math.round(student.scene_score * 100)}%` : ''}
// 					</Text>
// 				)}

// 				{student.marked_by === 'PROFESSOR' && <Text style={styles.manualTag}>✋ Manual</Text>}
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

// function ModalScore({ label, value, threshold }: { label: string; value?: number; threshold: number }) {
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
// 					<Text style={styles.chatSenderName}>{message.student_name} ({message.roll_number})</Text>
// 				)}
// 				<Text style={[styles.chatText, isMe && styles.chatTextMe]}>{message.message}</Text>
// 				<Text style={[styles.chatTime, isMe && styles.chatTimeMe]}>{formatTime(message.created_at)}</Text>
// 			</View>
// 		</View>
// 	);
// }

// // ─── Styles ───────────────────────────────────────────────────────────────────
// const styles = StyleSheet.create({
// 	safe:        { flex: 1, backgroundColor: COLORS.background },
// 	center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
// 	loadingText: { marginTop: SPACING.md, color: COLORS.textSecondary, fontSize: 14 },

// 	// ── HEADER STYLES ──
// 	header: {
// 		backgroundColor: COLORS.primary, 
// 		padding: SPACING.md,
// 		paddingBottom: SPACING.md,
// 	},
// 	headerTopRow: {
// 		flexDirection: 'row', 
// 		justifyContent: 'space-between', 
// 		alignItems: 'flex-start',
// 	},
// 	headerLeft:  { flex: 1, marginRight: SPACING.sm },
// 	headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
// 	headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '500' },

// 	// Timer
// 	timerBadge: {
// 		backgroundColor: 'rgba(0,0,0,0.25)', 
// 		borderRadius: RADIUS.full,
// 		paddingHorizontal: 12, 
// 		paddingVertical: 6,
// 		borderWidth: 1,
// 		borderColor: 'rgba(255,255,255,0.1)',
// 		alignItems: 'center',
// 		justifyContent: 'center',
// 	},
// 	timerBadgeDanger: { 
// 		backgroundColor: COLORS.danger, 
// 		borderColor: '#FF4D4D' 
// 	},
// 	timerText:   { color: COLORS.white, fontWeight: '700', fontSize: 13, letterSpacing: 1 },

// 	// Action Row
// 	headerActionRow: {
// 		flexDirection: 'row',
// 		justifyContent: 'flex-end',
// 		alignItems: 'center',
// 		marginTop: 16,
// 		gap: SPACING.sm,
// 	},
// 	endBtn: { 
// 		backgroundColor: COLORS.success, 
// 		borderRadius: RADIUS.full, 
// 		paddingHorizontal: 16, 
// 		paddingVertical: 8, 
// 		alignItems: 'center',
// 		shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
// 	},
// 	endBtnText:  { color: COLORS.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
// 	cancelBtn:   { 
// 		backgroundColor: 'rgba(255,255,255,0.15)', 
// 		borderRadius: RADIUS.full, 
// 		paddingHorizontal: 16, 
// 		paddingVertical: 8, 
// 		alignItems: 'center',
// 	},
// 	cancelBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
// 	backBtn:     { 
// 		backgroundColor: 'rgba(255,255,255,0.2)', 
// 		borderRadius: RADIUS.full, 
// 		paddingHorizontal: 18, 
// 		paddingVertical: 10,
// 		width: '100%',
// 		alignItems: 'center',
// 	},
// 	backBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },

// 	endedBanner: { backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B', padding: SPACING.sm, paddingHorizontal: SPACING.md },
// 	endedBannerText: { color: '#92400E', fontSize: 12, fontWeight: '600' },

// 	summaryBar: {
// 		flexDirection: 'row', justifyContent: 'space-between',
// 		padding: SPACING.sm, backgroundColor: COLORS.white,
// 		borderBottomWidth: 1, borderBottomColor: COLORS.border,
// 	},
// 	summaryPill:  { flex: 1, alignItems: 'center', borderRadius: RADIUS.sm, paddingVertical: SPACING.xs, marginHorizontal: 2 },
// 	summaryValue: { fontSize: 18, fontWeight: '800' },
// 	summaryLabel: { fontSize: 9, fontWeight: '600', marginTop: 1 },

// 	tabs: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
// 	tab: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
// 	tabActive: { borderBottomColor: COLORS.primary },
// 	tabText:   { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
// 	tabTextActive: { color: COLORS.primary },
// 	unreadBadge: { backgroundColor: COLORS.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
// 	unreadBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

// 	subTabRow: {
// 		flexDirection: 'row', backgroundColor: COLORS.white,
// 		borderBottomWidth: 1, borderBottomColor: COLORS.border,
// 	},
// 	subTab: {
// 		flex: 1, alignItems: 'center', paddingVertical: 9,
// 		borderBottomWidth: 2, borderBottomColor: 'transparent',
// 	},
// 	subTabText: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted },

// 	hintBanner: {
// 		backgroundColor: '#FFFBEB', borderLeftWidth: 3, borderLeftColor: '#F59E0B',
// 		paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
// 	},
// 	hintText: { fontSize: 12, color: '#92400E', lineHeight: 18 },

// 	grid:           { padding: SPACING.md, gap: SPACING.sm },
// 	gridRow:        { gap: SPACING.sm, justifyContent: 'flex-start' },
// 	emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: SPACING.xl },
// 	emptyIcon:      { fontSize: 48 },
// 	emptyText:      { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14, textAlign: 'center', lineHeight: 22 },

// 	// studentCard: {
// 	// 	borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center', borderWidth: 2,
// 	// 	shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
// 	// },
// 	// outsideRangePip: {
// 	// 	position: 'absolute', top: 6, left: 6,
// 	// 	backgroundColor: '#F59E0B', borderRadius: 6,
// 	// 	paddingHorizontal: 5, paddingVertical: 2,
// 	// },
// 	studentAvatar:     { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(0,0,0,0.08)', borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs },
// 	// studentAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
// 	// studentStatusIcon: { fontSize: 16, position: 'absolute', top: 6, right: 6 },
// 	// studentName:       { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center', marginTop: SPACING.xs },
// 	// studentRoll:       { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
// 	// studentScore:      { fontSize: 10, color: COLORS.textMuted, marginTop: 2 },
// 	// manualTag:         { fontSize: 9, color: COLORS.primary, marginTop: 2, fontWeight: '700' },

// 	// 👈 REDESIGNED CARD STYLES
//     studentCard: { borderRadius: RADIUS.md, borderWidth: 2, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
//     studentLargeDisplayImage: { width: '100%', height: 130, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
//     studentInfoContainer: { padding: SPACING.sm, alignItems: 'center' },
//     outsideRangePip: { position: 'absolute', top: 6, left: 6, backgroundColor: '#F59E0B', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, zIndex: 10 },
//     studentAvatarText: { fontSize: 32, fontWeight: '700', color: COLORS.textMuted },
//     studentStatusIcon: { fontSize: 18, position: 'absolute', top: 6, right: 6, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 12, overflow: 'hidden' },
//     studentName:       { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
//     studentRoll:       { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
//     studentScore:      { fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontWeight: '600' },
//     manualTag:         { fontSize: 9, color: COLORS.primary, marginTop: 4, fontWeight: '700' },

//     // 👈 NEW MODAL IMAGE STYLES
//     modalLargeImage: { width: '100%', height: 180, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
//     modalNoImage: { width: '100%', height: 100, borderRadius: RADIUS.md, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.border },
//     modalNoImageText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },
//     zoomHintBadge: { position: 'absolute', bottom: 16, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm },
//     zoomHintText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },

//     // 👈 NEW FULL SCREEN MODAL
//     fullScreenOverlay: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
//     fullScreenImage: { width: '100%', height: '100%' },
//     fullScreenClose: { position: 'absolute', top: 50, right: 20, zIndex: 100, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
//     fullScreenCloseText: { color: COLORS.white, fontSize: 16, fontWeight: '800' },

// 	chatList:       { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },
// 	chatRow:        { flexDirection: 'row', marginBottom: SPACING.xs },
// 	chatRowMe:      { justifyContent: 'flex-end' },
// 	chatRowOther:   { justifyContent: 'flex-start' },
// 	chatBubble:     { maxWidth: '80%', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs },
// 	chatBubbleMe:   { backgroundColor: COLORS.primary },
// 	chatBubbleOther: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border },
// 	chatSenderName: { fontSize: 10, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
// 	chatText:       { fontSize: 13, color: COLORS.textPrimary, lineHeight: 18 },
// 	chatTextMe:     { color: COLORS.white },
// 	chatTime:       { fontSize: 9, color: COLORS.textMuted, marginTop: 3, textAlign: 'right' },
// 	chatTimeMe:     { color: 'rgba(255,255,255,0.6)' },
// 	chatInputRow:   { flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white, gap: SPACING.xs },
// 	chatInput:      { flex: 1, backgroundColor: COLORS.background, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, fontSize: 13, maxHeight: 80, color: COLORS.textPrimary, borderWidth: 1, borderColor: COLORS.border },
// 	chatSendBtn:    { backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
// 	chatSendBtnDisabled: { opacity: 0.4 },
// 	chatSendBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

// 	modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
// 	modalCard:    { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg },
// 	modalHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
// 	modalName:    { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
// 	modalRoll:    { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
// 	modalClose:   { fontSize: 22, color: COLORS.textSecondary, padding: 4 },
// 	proxyWarningBadge: { marginTop: 6, backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderLeftWidth: 3, borderLeftColor: '#F59E0B' },
// 	proxyWarningText:  { fontSize: 11, color: '#92400E', fontWeight: '600' },
// 	scoresRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm },
// 	modalScore:   { flex: 1, alignItems: 'center' },
// 	modalScoreLabel: { fontSize: 11, color: COLORS.textMuted },
// 	modalScoreValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
// 	statusRow:    { flexDirection: 'row', alignItems: 'center', borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md, gap: SPACING.xs },
// 	statusRowIcon: { fontSize: 18 },
// 	statusRowText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
// 	markedBy:     { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
// 	overrideLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: SPACING.xs },
// 	overrideToggleRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
// 	overrideToggleBtn: { flex: 1, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, padding: SPACING.sm, alignItems: 'center' },
// 	overrideToggleBtnActivePresent: { backgroundColor: COLORS.success, borderColor: COLORS.success },
// 	overrideToggleBtnActiveAbsent:  { backgroundColor: COLORS.danger,  borderColor: COLORS.danger  },
// 	overrideToggleBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
// 	reasonInput:  { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 13, color: COLORS.textPrimary, minHeight: 60, marginBottom: SPACING.md, backgroundColor: COLORS.background },
// 	overrideBtn:  { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', marginBottom: SPACING.sm },
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
	KeyboardAvoidingView, Platform, ScrollView, Image,
	Dimensions, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 48) / 2;

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
	bg: '#F0F2F5',
	surface: '#FFFFFF',
	surface2: '#F5F7FA',
	surface3: '#EEF0F4',
	border: '#E2E6ED',
	borderBright: '#CDD2DB',
	accent: '#1F4E79',
	accentGlow: 'rgba(31,78,121,0.10)',
	green: '#16A34A',
	greenDim: 'rgba(22,163,74,0.10)',
	red: '#DC2626',
	redDim: 'rgba(220,38,38,0.10)',
	amber: '#D97706',
	amberDim: 'rgba(217,119,6,0.10)',
	purple: '#7C3AED',
	purpleDim: 'rgba(124,58,237,0.10)',
	textPrimary: '#111827',
	textSec: '#6B7280',
	textMute: '#9CA3AF',
	white: '#FFFFFF',
};

// ─── Types ─────────────────────────────────────────────────────────────────
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
	captured_image_b64?: string;
}
type StudentTab = 'all' | 'notified' | 'unnotified';

// ─── Helpers ────────────────────────────────────────────────────────────────
function getCardAccent(s: StudentCard): string {
	if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return T.green;
	if (s.verification_status === 'SUSPICIOUS') return T.amber;
	if (s.verification_status === 'FAILED') return T.red;
	if (s.marked_by === 'PROFESSOR') return T.accent;
	return T.borderBright;
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════════
export default function DashboardScreen() {
	const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
	const { user } = useAuthStore();

	const [session, setSession] = useState<SessionInfo | null>(null);
	const [studentsObj, setStudentsObj] = useState<Record<string, StudentCard>>({});
	const [loading, setLoading] = useState(true);
	const [sessionEnded, setSessionEnded] = useState(false);
	const [timeLeft, setTimeLeft] = useState<number>(0);

	const [mainTab, setMainTab] = useState<'students' | 'chat'>('students');
	const [studentTab, setStudentTab] = useState<StudentTab>('all');

	const mainTabRef = useRef(mainTab);
	useEffect(() => { mainTabRef.current = mainTab; }, [mainTab]);

	const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

	// Override modal
	const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
	const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
	const [overrideReason, setOverrideReason] = useState('');
	const [overriding, setOverriding] = useState(false);

	// Chat
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
	const [chatInput, setChatInput] = useState('');
	const [chatUnread, setChatUnread] = useState(0);
	const chatListRef = useRef<FlatList>(null);
	const timerRef = useRef<ReturnType<typeof setInterval>>();

	// Header pulse anim
	const headerPulse = useRef(new Animated.Value(1)).current;
	useEffect(() => {
		const loop = Animated.loop(
			Animated.sequence([
				Animated.timing(headerPulse, { toValue: 1.03, duration: 1200, useNativeDriver: true }),
				Animated.timing(headerPulse, { toValue: 1.00, duration: 1200, useNativeDriver: true }),
			])
		);
		if (!sessionEnded) loop.start();
		return () => loop.stop();
	}, [sessionEnded]);

	// ── Load ──────────────────────────────────────────────────────────────────
	const loadDashboard = useCallback(async () => {
		try {
			const res = await ProfessorAPI.getDashboard(sessionId);
			const data = res.data.data;
			setSession(data.session);
			const obj: Record<string, StudentCard> = {};
			data.students.forEach((s: StudentCard) => { obj[s.student_id] = s; });
			setStudentsObj(obj);
			if (data.session.status !== 'ACTIVE') setSessionEnded(true);
		} catch {
			Alert.alert('Error', 'Failed to load dashboard');
		} finally {
			setLoading(false);
		}
	}, [sessionId]);

	useEffect(() => {
		if (!session?.expires_at) return;
		const update = () => {
			const remaining = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
			setTimeLeft(remaining);
			if (remaining === 0) clearInterval(timerRef.current);
		};
		update();
		timerRef.current = setInterval(update, 1000);
		return () => clearInterval(timerRef.current);
	}, [session?.expires_at]);

	useEffect(() => {
		loadDashboard();
		joinSession(sessionId);
		requestChatHistory(sessionId);

		const unsubAttendance = onSessionEvent((event: any) => {
			if (['SESSION_ENDED', 'SESSION_EXPIRED', 'SESSION_CANCELLED'].includes(event.type)) {
				setSessionEnded(true);
				if (event.type === 'SESSION_CANCELLED')
					Alert.alert('Session Cancelled', 'Attendance session was cancelled. No records saved.');
				return;
			}
			if (event.data?.student_id) {
				setStudentsObj(prev => ({
					...prev,
					[event.data.student_id]: { ...(prev[event.data.student_id] || {}), ...event.data },
				}));
			}
		});

		const unsubChat = onStudentChatMessage((msg) => {
			setChatMessages(prev => {
				if (prev.some(m => m.message_id === msg.message_id)) return prev;
				return [...prev, msg];
			});
			if (mainTabRef.current !== 'chat') setChatUnread(n => n + 1);
			else setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
		});

		const unsubHistory = onChatHistory((data) => { setChatMessages(data.messages); });

		const unsubProfReply = (() => {
			const handler = (msg: ChatMessage) => {
				setChatMessages(prev => {
					if (prev.some(m => m.message_id === msg.message_id)) return prev;
					return [...prev, { ...msg, sender_type: 'PROFESSOR' }];
				});
				setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
			};
			const s = getSocket();
			if (s) { s.on('professor_reply_sent', handler); return () => s.off('professor_reply_sent', handler); }
			return () => { };
		})();

		return () => {
			unsubAttendance(); unsubChat(); unsubHistory(); unsubProfReply();
			leaveSession(sessionId);
		};
	}, [sessionId]);

	useEffect(() => {
		if (chatMessages.length > 0)
			setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
	}, [chatMessages]);

	// ── Actions ───────────────────────────────────────────────────────────────
	async function handleEndSession() {
		Alert.alert('End Session', 'End the attendance session? Students can no longer verify.', [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'End Session', style: 'destructive', onPress: async () => {
					try { await ProfessorAPI.endSession(sessionId); setSessionEnded(true); }
					catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'Failed to end session'); }
				}
			},
		]);
	}

	async function handleCancelSession() {
		Alert.alert('❌ Cancel Session', 'This will DELETE all attendance records for this class. No attendance will be saved. Are you sure?', [
			{ text: 'Keep Session', style: 'cancel' },
			{
				text: 'Cancel Session', style: 'destructive', onPress: async () => {
					try { await ProfessorAPI.cancelSession(sessionId); setSessionEnded(true); Alert.alert('Cancelled', 'Session cancelled. No attendance recorded.'); }
					catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'Failed to cancel session'); }
				}
			},
		]);
	}

	async function handleOverrideSubmit() {
		if (!selectedStudent) return;
		if (!overrideReason.trim()) { Alert.alert('Reason Required', 'Please enter a reason for the override.'); return; }
		setOverriding(true);
		try {
			await ProfessorAPI.manualOverride(sessionId, selectedStudent.student_id, overrideStatus, overrideReason.trim());
			setSelectedStudent(null); setOverrideReason(''); setOverrideStatus('PRESENT');
		} catch (err: any) { Alert.alert('Error', err.response?.data?.error || 'Override failed'); }
		finally { setOverriding(false); }
	}

	function handleSendChat() {
		const text = chatInput.trim();
		if (!text) return;
		sendChatMessage(sessionId, text);
		setChatInput('');
	}

	// ── Derived ───────────────────────────────────────────────────────────────
	const studentsArr = Object.values(studentsObj).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
	const notifiedArr = studentsArr.filter(s => s.notified !== false);
	const unnotifiedArr = studentsArr.filter(s => s.notified === false);
	const presentCount = studentsArr.filter(s => s.status === 'PRESENT').length;
	const absentCount = studentsArr.filter(s => s.status === 'ABSENT').length;
	const suspCount = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
	const pendingCount = studentsArr.filter(s => s.verification_status === 'PENDING').length;
	const isTimeLow = session ? (new Date(session.expires_at).getTime() - Date.now()) < 2 * 60 * 1000 : false;
	const visibleStudents: StudentCard[] =
		studentTab === 'notified' ? notifiedArr :
			studentTab === 'unnotified' ? unnotifiedArr : studentsArr;

	if (loading) return (
		<View style={S.loadScreen}>
			<StatusBar barStyle="dark-content" backgroundColor={T.bg} />
			<ActivityIndicator size="large" color={T.accent} />
			<Text style={S.loadText}>Loading dashboard…</Text>
		</View>
	);

	return (
		<View style={S.root}>
			<StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
			<SafeAreaView style={{ flex: 1 }} edges={['top']}>

				{/* ══ HEADER ══════════════════════════════════════════════════════ */}
				<View style={S.header}>
					{/* Glowing live dot */}
					{!sessionEnded && (
						<Animated.View style={[S.liveDot, { transform: [{ scale: headerPulse }] }]} />
					)}

					<View style={S.headerContent}>
						{/* Course info */}
						<View style={{ flex: 1, marginRight: 12 }}>
							<Text style={S.headerCode}>{session?.code}{session?.section ? ` · ${session.section}` : ''}</Text>
							<Text style={S.headerTitle} numberOfLines={2}>{session?.course_name}</Text>
							<View style={S.creditPill}>
								<Text style={S.creditPillText}>⭐ {session?.attendance_credits ?? 1} credit{(session?.attendance_credits ?? 1) > 1 ? 's' : ''}</Text>
							</View>
						</View>

						{/* Timer */}
						{!sessionEnded ? (
							<View style={[S.timerBlock, isTimeLow && S.timerBlockDanger]}>
								<Text style={[S.timerLabel, isTimeLow && { color: T.red }]}>TIME LEFT</Text>
								<Text style={[S.timerValue, isTimeLow && { color: T.red }]}>{formatTimer(timeLeft)}</Text>
							</View>
						) : (
							<View style={S.endedBadge}>
								<Text style={S.endedBadgeText}>ENDED</Text>
							</View>
						)}
					</View>

					{/* Action row */}
					<View style={S.actionRow}>
						{!sessionEnded ? (
							<>
								<TouchableOpacity style={S.btnCancel} onPress={handleCancelSession} activeOpacity={0.75}>
									<Text style={S.btnCancelText}>✕  Cancel</Text>
								</TouchableOpacity>
								<TouchableOpacity style={S.btnEnd} onPress={handleEndSession} activeOpacity={0.8}>
									<Text style={S.btnEndText}>✅  End Session</Text>
								</TouchableOpacity>
							</>
						) : (
							<TouchableOpacity style={S.btnBack} onPress={() => router.back()} activeOpacity={0.8}>
								<Text style={S.btnBackText}>← Back to Home</Text>
							</TouchableOpacity>
						)}
					</View>
				</View>

				{/* ══ SESSION ENDED BANNER ════════════════════════════════════════ */}
				{sessionEnded && (
					<View style={S.endedBanner}>
						<Text style={S.endedBannerText}>🏁 Session ended — you can still override attendance records below</Text>
					</View>
				)}

				{/* ══ STAT STRIP ══════════════════════════════════════════════════ */}
				<View style={S.statStrip}>
					<StatChip value={presentCount} label="Present" color={T.green} icon="✅" />
					<View style={S.statDivider} />
					<StatChip value={absentCount} label="Absent" color={T.red} icon="❌" />
					<View style={S.statDivider} />
					<StatChip value={suspCount} label="Suspicious" color={T.amber} icon="⚠️" />
					<View style={S.statDivider} />
					<StatChip value={pendingCount} label="Pending" color={T.textSec} icon="⏳" />
				</View>

				{/* ══ MAIN TABS ═══════════════════════════════════════════════════ */}
				<View style={S.mainTabRow}>
					<TouchableOpacity
						style={[S.mainTab, mainTab === 'students' && S.mainTabActive]}
						onPress={() => setMainTab('students')}
						activeOpacity={0.8}
					>
						<Text style={[S.mainTabText, mainTab === 'students' && S.mainTabTextActive]}>
							👥  Students ({studentsArr.length})
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[S.mainTab, mainTab === 'chat' && S.mainTabActive]}
						onPress={() => { setMainTab('chat'); setChatUnread(0); }}
						activeOpacity={0.8}
					>
						<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
							<Text style={[S.mainTabText, mainTab === 'chat' && S.mainTabTextActive]}>💬  Chat</Text>
							{chatUnread > 0 && (
								<View style={S.unreadPill}><Text style={S.unreadPillText}>{chatUnread}</Text></View>
							)}
						</View>
					</TouchableOpacity>
				</View>

				{/* ══ STUDENTS TAB ════════════════════════════════════════════════ */}
				{mainTab === 'students' && (
					<>
						{/* Sub-filter chips */}
						<View style={S.chipRow}>
							<FilterChip label={`All  ${studentsArr.length}`} active={studentTab === 'all'} onPress={() => setStudentTab('all')} />
							<FilterChip label={`📶  ${notifiedArr.length}`} active={studentTab === 'notified'} onPress={() => setStudentTab('notified')} />
							<FilterChip label={`⚠️  Outside  ${unnotifiedArr.length}`} active={studentTab === 'unnotified'} onPress={() => setStudentTab('unnotified')} accentColor={T.amber} />
						</View>

						{studentTab === 'unnotified' && (
							<View style={S.hintBar}>
								<Text style={S.hintBarIcon}>📡</Text>
								<Text style={S.hintBarText}>
									{unnotifiedArr.length === 0
										? 'All enrolled students were within range when the session started.'
										: 'These students were outside the classroom range — no push notification was sent. Possible proxies.'}
								</Text>
							</View>
						)}

						<FlatList
							data={visibleStudents}
							extraData={studentsObj}
							keyExtractor={item => item.student_id}
							numColumns={2}
							contentContainerStyle={S.grid}
							columnWrapperStyle={S.gridRow}
							showsVerticalScrollIndicator={false}
							ListEmptyComponent={
								<View style={S.emptyWrap}>
									<Text style={S.emptyIcon}>{studentTab === 'unnotified' ? '✅' : '👥'}</Text>
									<Text style={S.emptyTitle}>{studentTab === 'unnotified' ? 'No students outside range' : 'No students yet'}</Text>
								</View>
							}
							renderItem={({ item }) => (
								<StudentCardItem
									student={item}
									onPress={() => {
										setSelectedStudent(item);
										setOverrideStatus(item.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
										setOverrideReason('');
									}}
									onLongPress={() => item.captured_image_b64 && setFullScreenImage(item.captured_image_b64)}
								/>
							)}
						/>
					</>
				)}

				{/* ══ CHAT TAB ════════════════════════════════════════════════════ */}
				{mainTab === 'chat' && (
					<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
						<FlatList
							ref={chatListRef}
							data={chatMessages}
							keyExtractor={(item, i) => item.message_id + i}
							contentContainerStyle={S.chatList}
							showsVerticalScrollIndicator={false}
							onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
							ListEmptyComponent={
								<View style={S.emptyWrap}>
									<Text style={S.emptyIcon}>💬</Text>
									<Text style={S.emptyTitle}>No messages yet</Text>
									<Text style={S.emptySubtitle}>Students can message you here during the session.</Text>
								</View>
							}
							renderItem={({ item }) => <ChatBubble message={item} isMe={item.sender_type === 'PROFESSOR'} />}
						/>
						<View style={S.chatInputWrap}>
							<TextInput
								style={S.chatInput}
								value={chatInput}
								onChangeText={setChatInput}
								placeholder="Reply to students…"
								placeholderTextColor={T.textMute}
								multiline
								maxLength={500}
								returnKeyType="send"
								onSubmitEditing={handleSendChat}
							/>
							<TouchableOpacity
								style={[S.chatSendBtn, !chatInput.trim() && { opacity: 0.3 }]}
								onPress={handleSendChat}
								disabled={!chatInput.trim()}
								activeOpacity={0.8}
							>
								<Text style={S.chatSendText}>↑</Text>
							</TouchableOpacity>
						</View>
					</KeyboardAvoidingView>
				)}
			</SafeAreaView>

			{/* ══ OVERRIDE MODAL ══════════════════════════════════════════════════ */}
			<Modal visible={!!selectedStudent} transparent animationType="fade" onRequestClose={() => setSelectedStudent(null)}>
				<View style={S.modalOverlay}>
					<View style={S.modalSheet}>
						{selectedStudent && (
							<ScrollView showsVerticalScrollIndicator={false}>
								{/* Handle */}
								<View style={S.modalHandle} />

								{/* Header */}
								<View style={S.modalHeaderRow}>
									<View style={{ flex: 1 }}>
										<Text style={S.modalStudentName}>{selectedStudent.name}</Text>
										<Text style={S.modalStudentRoll}>{selectedStudent.roll_number}</Text>
									</View>
									<TouchableOpacity onPress={() => setSelectedStudent(null)} style={S.modalCloseBtn}>
										<Text style={S.modalCloseTxt}>✕</Text>
									</TouchableOpacity>
								</View>

								{/* Proxy warning */}
								{selectedStudent.notified === false && (
									<View style={S.proxyBanner}>
										<Text style={S.proxyBannerIcon}>⚠️</Text>
										<Text style={S.proxyBannerText}>Was outside classroom range — possible proxy</Text>
									</View>
								)}

								{/* Captured image */}
								{selectedStudent.captured_image_b64 ? (
									<TouchableOpacity onPress={() => setFullScreenImage(selectedStudent.captured_image_b64!)} activeOpacity={0.9}>
										<Image
											source={{ uri: `data:image/jpeg;base64,${selectedStudent.captured_image_b64}` }}
											style={S.modalImage}
										/>
										<View style={S.modalImageOverlay}>
											<Text style={S.modalImageHint}>🔍  Tap to enlarge</Text>
										</View>
									</TouchableOpacity>
								) : (
									<View style={S.modalNoImage}>
										<Text style={S.modalNoImageIcon}>📷</Text>
										<Text style={S.modalNoImageText}>No capture available</Text>
									</View>
								)}

								{/* Score chips */}
								<View style={S.scoreRow}>
									<ScoreChip label="Face" value={selectedStudent.face_score} threshold={0.65} />
									<ScoreChip label="Liveness" value={selectedStudent.liveness_score} threshold={0.70} />
									<ScoreChip label="Scene" value={selectedStudent.scene_score} threshold={0.60} />
								</View>

								{/* Current status */}
								<View style={[S.currentStatusBanner, { borderColor: getCardAccent(selectedStudent) + '55', backgroundColor: getCardAccent(selectedStudent) + '10' }]}>
									<Text style={S.currentStatusIcon}>{getStatusIcon(selectedStudent)}</Text>
									<View style={{ flex: 1 }}>
										<Text style={[S.currentStatusText, { color: getCardAccent(selectedStudent) }]}>
											Currently {selectedStudent.status === 'PRESENT' ? 'Present' : 'Absent'}
										</Text>
										{selectedStudent.marked_by === 'PROFESSOR' && (
											<Text style={S.currentStatusSub}>Manual override{(selectedStudent as any).override_reason ? `: ${(selectedStudent as any).override_reason}` : ''}</Text>
										)}
									</View>
								</View>

								{/* Override toggle */}
								<Text style={S.overrideHeading}>Change to</Text>
								<View style={S.overrideToggleRow}>
									{(['PRESENT', 'ABSENT'] as const).map(st => (
										<TouchableOpacity
											key={st}
											style={[
												S.overrideToggleBtn,
												overrideStatus === st && { borderColor: st === 'PRESENT' ? T.green : T.red, backgroundColor: st === 'PRESENT' ? T.greenDim : T.redDim },
											]}
											onPress={() => setOverrideStatus(st)}
											activeOpacity={0.8}
										>
											<Text style={[S.overrideToggleTxt, overrideStatus === st && { color: st === 'PRESENT' ? T.green : T.red }]}>
												{st === 'PRESENT' ? '✅  Present' : '❌  Absent'}
											</Text>
										</TouchableOpacity>
									))}
								</View>

								{/* Reason input */}
								<TextInput
									style={S.reasonInput}
									value={overrideReason}
									onChangeText={setOverrideReason}
									placeholder="Reason (required) — e.g. physically verified, student appeal…"
									placeholderTextColor={T.textMute}
									multiline
									maxLength={500}
								/>

								{/* Submit */}
								<TouchableOpacity
									style={[S.overrideSubmitBtn, overriding && { opacity: 0.5 }]}
									onPress={handleOverrideSubmit}
									disabled={overriding}
									activeOpacity={0.8}
								>
									{overriding ? <ActivityIndicator color={T.white} /> : <Text style={S.overrideSubmitTxt}>Apply Override & Notify</Text>}
								</TouchableOpacity>

								<TouchableOpacity style={S.modalCancelBtn} onPress={() => setSelectedStudent(null)}>
									<Text style={S.modalCancelTxt}>Close</Text>
								</TouchableOpacity>
							</ScrollView>
						)}
					</View>
				</View>
			</Modal>

			{/* ══ FULL SCREEN IMAGE ═══════════════════════════════════════════════ */}
			<Modal visible={!!fullScreenImage} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
				<View style={S.fullScreen}>
					<TouchableOpacity style={S.fullScreenClose} onPress={() => setFullScreenImage(null)} activeOpacity={0.8}>
						<Text style={S.fullScreenCloseTxt}>✕</Text>
					</TouchableOpacity>
					{fullScreenImage && (
						<Image
							source={{ uri: `data:image/jpeg;base64,${fullScreenImage}` }}
							style={S.fullScreenImg}
							resizeMode="contain"
						/>
					)}
				</View>
			</Modal>
		</View>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── StatChip ─────────────────────────────────────────────────────────────────
function StatChip({ value, label, color, icon }: { value: number; label: string; color: string; icon: string }) {
	return (
		<View style={[S.statChip, { backgroundColor: color + '14' }]}>
			<Text style={[S.statValue, { color }]}>{value}</Text>
			<Text style={[S.statLabel, { color: color + 'BB' }]}>{label}</Text>
		</View>
	);
}

// ── FilterChip ───────────────────────────────────────────────────────────────
function FilterChip({ label, active, onPress, accentColor }: { label: string; active: boolean; onPress: () => void; accentColor?: string }) {
	const ac = accentColor || T.accent;
	return (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.75}
			style={[
				S.filterChip,
				active && { borderColor: ac, backgroundColor: ac + '18' },
			]}
		>
			<Text style={[S.filterChipTxt, active && { color: ac, fontWeight: '700' }]}>{label}</Text>
		</TouchableOpacity>
	);
}

// ── StudentCardItem ───────────────────────────────────────────────────────────
function StudentCardItem({ student, onPress, onLongPress }: { student: StudentCard; onPress: () => void; onLongPress?: () => void; }) {
	const accent = getCardAccent(student);
	const statusIcon = getStatusIcon(student);
	const entranceAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.spring(entranceAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
	}, [student.verification_status, student.status]);

	const initials = (student.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

	return (
		<TouchableOpacity onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
			<Animated.View style={[S.card, { opacity: entranceAnim, transform: [{ scale: Animated.add(0.95, Animated.multiply(entranceAnim, 0.05)) }] }]}>
				{/* Accent top strip */}
				<View style={[S.cardTopStrip, { backgroundColor: accent }]} />

				{/* Outside-range badge */}
				{student.notified === false && (
					<View style={S.outBadge}>
						<Text style={S.outBadgeText}>OUT</Text>
					</View>
				)}

				{/* Status badge */}
				<View style={[S.statusBadge, { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
					<Text style={S.statusBadgeText}>{statusIcon}</Text>
				</View>

				{/* Photo or initials */}
				<View style={S.photoWrap}>
					{student.captured_image_b64 ? (
						<Image
							source={{ uri: `data:image/jpeg;base64,${student.captured_image_b64}` }}
							style={[S.photo, { borderColor: accent }]}
						/>
					) : (
						<View style={[S.initialsCircle, { borderColor: accent, backgroundColor: accent + '1A' }]}>
							<Text style={[S.initialsText, { color: accent }]}>{initials}</Text>
						</View>
					)}
				</View>

				{/* Name & roll */}
				<Text style={S.cardName} numberOfLines={2}>{student.name}</Text>
				<Text style={S.cardRoll}>{student.roll_number}</Text>

				{/* Score chips */}
				{student.face_score != null && (
					<View style={S.cardScoreRow}>
						<ScoreMiniPill label="F" value={student.face_score} threshold={0.65} />
						{student.liveness_score != null && <ScoreMiniPill label="L" value={student.liveness_score} threshold={0.70} />}
						{student.scene_score != null && <ScoreMiniPill label="S" value={student.scene_score} threshold={0.60} />}
					</View>
				)}

				{/* Manual tag */}
				{student.marked_by === 'PROFESSOR' && (
					<View style={S.manualBadge}>
						<Text style={S.manualBadgeText}>✋ Manual</Text>
					</View>
				)}
			</Animated.View>
		</TouchableOpacity>
	);
}

// ── ScoreMiniPill ─────────────────────────────────────────────────────────────
function ScoreMiniPill({ label, value, threshold }: { label: string; value: number; threshold: number }) {
	const color = value >= threshold ? T.green : T.red;
	return (
		<View style={[S.miniPill, { backgroundColor: color + '18', borderColor: color + '44' }]}>
			<Text style={[S.miniPillText, { color }]}>{label}:{Math.round(value * 100)}%</Text>
		</View>
	);
}

// ── ScoreChip (modal) ─────────────────────────────────────────────────────────
function ScoreChip({ label, value, threshold }: { label: string; value?: number; threshold: number }) {
	const pct = value != null ? Math.round(value * 100) : null;
	const color = pct == null ? T.textMute : value! >= threshold ? T.green : T.red;
	return (
		<View style={[S.scoreChip, { borderColor: color + '40', backgroundColor: color + '12' }]}>
			<Text style={[S.scoreChipValue, { color }]}>{pct != null ? `${pct}%` : '—'}</Text>
			<Text style={[S.scoreChipLabel, { color: T.textSec }]}>{label}</Text>
		</View>
	);
}

// ── ChatBubble ────────────────────────────────────────────────────────────────
function ChatBubble({ message, isMe }: { message: ChatMessage; isMe: boolean }) {
	return (
		<View style={[S.chatRow, isMe ? S.chatRowRight : S.chatRowLeft]}>
			<View style={[S.chatBubble, isMe ? S.chatBubbleMe : S.chatBubbleOther]}>
				{!isMe && (
					<Text style={S.chatSender}>{message.student_name} · {message.roll_number}</Text>
				)}
				<Text style={[S.chatMsg, isMe && { color: T.white }]}>{message.message}</Text>
				<Text style={[S.chatTime, isMe && { color: 'rgba(255,255,255,0.45)' }]}>{formatTime(message.created_at)}</Text>
			</View>
		</View>
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const S = StyleSheet.create({
	root: { flex: 1, backgroundColor: T.bg },
	loadScreen: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },
	loadText: { color: T.textSec, fontSize: 14, marginTop: 14, fontWeight: '500' },

	// ── HEADER ──────────────────────────────────────────────────────────────
	header: {
		backgroundColor: T.surface,
		paddingHorizontal: 20,
		paddingTop: 14,
		paddingBottom: 16,
		borderBottomWidth: 1,
		borderBottomColor: T.border,
	},
	liveDot: {
		width: 8, height: 8, borderRadius: 4,
		backgroundColor: T.green,
		alignSelf: 'flex-end',
		marginBottom: 10,
		shadowColor: T.green,
		shadowRadius: 6,
		shadowOpacity: 0.8,
		elevation: 4,
	},
	headerContent: { flexDirection: 'row', alignItems: 'flex-start' },
	headerCode: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
	headerTitle: { fontSize: 19, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.3, lineHeight: 24 },
	creditPill: {
		alignSelf: 'flex-start', marginTop: 6,
		backgroundColor: T.accentGlow, borderRadius: 99,
		paddingHorizontal: 10, paddingVertical: 3,
		borderWidth: 1, borderColor: T.accent + '33',
	},
	creditPillText: { fontSize: 10, fontWeight: '700', color: T.accent, letterSpacing: 0.5 },
	timerBlock: {
		backgroundColor: T.surface2, borderRadius: 12,
		paddingHorizontal: 14, paddingVertical: 10,
		alignItems: 'center', minWidth: 80,
		borderWidth: 1, borderColor: T.border,
	},
	timerBlockDanger: { borderColor: T.red + '55', backgroundColor: T.redDim },
	timerLabel: { fontSize: 8, fontWeight: '800', color: T.textMute, letterSpacing: 1.5, textTransform: 'uppercase' },
	timerValue: { fontSize: 20, fontWeight: '900', color: T.textPrimary, letterSpacing: 1, marginTop: 2 },
	endedBadge: {
		backgroundColor: T.surface2, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8,
		borderWidth: 1, borderColor: T.borderBright,
	},
	endedBadgeText: { fontSize: 10, fontWeight: '800', color: T.textSec, letterSpacing: 2 },
	actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
	btnEnd: {
		flex: 1, backgroundColor: T.green, borderRadius: 12,
		paddingVertical: 11, alignItems: 'center',
		shadowColor: T.green, shadowRadius: 8, shadowOpacity: 0.3, elevation: 4,
	},
	btnEndText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.3 },
	btnCancel: {
		backgroundColor: T.surface2, borderRadius: 12,
		paddingVertical: 11, paddingHorizontal: 18, alignItems: 'center',
		borderWidth: 1, borderColor: T.border,
	},
	btnCancelText: { color: T.textSec, fontWeight: '600', fontSize: 13 },
	btnBack: {
		flex: 1, backgroundColor: T.surface2, borderRadius: 12,
		paddingVertical: 12, alignItems: 'center',
		borderWidth: 1, borderColor: T.borderBright,
	},
	btnBackText: { color: T.textPrimary, fontWeight: '700', fontSize: 13 },

	endedBanner: {
		backgroundColor: T.amberDim, paddingHorizontal: 16, paddingVertical: 10,
		borderBottomWidth: 1, borderBottomColor: T.amber + '22',
	},
	endedBannerText: { color: T.amber, fontSize: 12, fontWeight: '600' },

	// ── STAT STRIP ──────────────────────────────────────────────────────────
	statStrip: {
		flexDirection: 'row', alignItems: 'center',
		backgroundColor: T.surface, borderBottomWidth: 1, borderBottomColor: T.border,
		paddingHorizontal: 8, paddingVertical: 8,
	},
	statChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
	statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
	statLabel: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
	statDivider: { width: 1, height: 32, backgroundColor: T.border },

	// ── MAIN TABS ────────────────────────────────────────────────────────────
	mainTabRow: {
		flexDirection: 'row', backgroundColor: T.surface,
		borderBottomWidth: 1, borderBottomColor: T.border,
	},
	mainTab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: 'transparent' },
	mainTabActive: { borderBottomColor: T.accent },
	mainTabText: { fontSize: 13, fontWeight: '600', color: T.textSec },
	mainTabTextActive: { color: T.accent, fontWeight: '700' },
	unreadPill: {
		backgroundColor: T.red, borderRadius: 99, minWidth: 18, height: 18,
		alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
	},
	unreadPillText: { color: T.white, fontSize: 10, fontWeight: '800' },

	// ── FILTER CHIPS ─────────────────────────────────────────────────────────
	chipRow: {
		flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12,
		backgroundColor: T.bg,
	},
	filterChip: {
		paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
		borderWidth: 1, borderColor: T.border, backgroundColor: T.surface2,
	},
	filterChipTxt: { fontSize: 12, fontWeight: '600', color: T.textSec },

	// ── HINT BAR ─────────────────────────────────────────────────────────────
	hintBar: {
		flexDirection: 'row', alignItems: 'flex-start', gap: 8,
		backgroundColor: T.amberDim, borderBottomWidth: 1, borderBottomColor: T.amber + '22',
		paddingHorizontal: 16, paddingVertical: 10,
	},
	hintBarIcon: { fontSize: 14 },
	hintBarText: { flex: 1, fontSize: 12, color: T.amber, lineHeight: 18, fontWeight: '500' },

	// ── GRID ─────────────────────────────────────────────────────────────────
	grid: { padding: 12, paddingBottom: 40 },
	gridRow: { gap: 12, justifyContent: 'flex-start', marginBottom: 12 },
	emptyWrap: { alignItems: 'center', paddingTop: 80 },
	emptyIcon: { fontSize: 52 },
	emptyTitle: { fontSize: 16, fontWeight: '700', color: T.textSec, marginTop: 12 },
	emptySubtitle: { fontSize: 13, color: T.textMute, marginTop: 6, textAlign: 'center' },

	// ── CARD ─────────────────────────────────────────────────────────────────
	card: {
		width: CARD_W,
		backgroundColor: T.surface,
		borderRadius: 18,
		borderWidth: 1,
		borderColor: T.border,
		overflow: 'hidden',
		paddingBottom: 14,
		alignItems: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.25,
		shadowRadius: 12,
		elevation: 6,
	},
	cardTopStrip: { width: '100%', height: 3, marginBottom: 14 },
	outBadge: {
		position: 'absolute', top: 12, left: 10, zIndex: 10,
		backgroundColor: T.amber, borderRadius: 6,
		paddingHorizontal: 6, paddingVertical: 2,
	},
	outBadgeText: { fontSize: 8, fontWeight: '900', color: '#000', letterSpacing: 0.5 },
	statusBadge: {
		position: 'absolute', top: 10, right: 10, zIndex: 10,
		width: 28, height: 28, borderRadius: 14,
		alignItems: 'center', justifyContent: 'center',
		borderWidth: 1,
	},
	statusBadgeText: { fontSize: 14 },
	photoWrap: { marginBottom: 10 },
	photo: {
		width: 72, height: 72, borderRadius: 36,
		borderWidth: 2.5,
	},
	initialsCircle: {
		width: 72, height: 72, borderRadius: 36,
		borderWidth: 2, alignItems: 'center', justifyContent: 'center',
	},
	initialsText: { fontSize: 24, fontWeight: '800' },
	cardName: { fontSize: 13, fontWeight: '700', color: T.textPrimary, textAlign: 'center', paddingHorizontal: 8, lineHeight: 18 },
	cardRoll: { fontSize: 10.5, color: T.textSec, marginTop: 2, letterSpacing: 0.3 },
	cardScoreRow: { flexDirection: 'row', gap: 4, marginTop: 8, paddingHorizontal: 8, flexWrap: 'wrap', justifyContent: 'center' },
	miniPill: {
		paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
	},
	miniPillText: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.3 },
	manualBadge: {
		marginTop: 8, backgroundColor: T.accentGlow, borderRadius: 99,
		paddingHorizontal: 8, paddingVertical: 3,
		borderWidth: 1, borderColor: T.accent + '44',
	},
	manualBadgeText: { fontSize: 9, fontWeight: '700', color: T.accent, letterSpacing: 0.5 },

	// ── CHAT ─────────────────────────────────────────────────────────────────
	chatList: { padding: 16, gap: 10, flexGrow: 1 },
	chatRow: { flexDirection: 'row', marginBottom: 6 },
	chatRowLeft: { justifyContent: 'flex-start' },
	chatRowRight: { justifyContent: 'flex-end' },
	chatBubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
	chatBubbleOther: { backgroundColor: T.surface, borderWidth: 1, borderColor: T.border, borderBottomLeftRadius: 4 },
	chatBubbleMe: { backgroundColor: T.accent, borderBottomRightRadius: 4 },
	chatSender: { fontSize: 10, fontWeight: '800', color: T.accent, marginBottom: 4 },
	chatMsg: { fontSize: 14, color: T.textPrimary, lineHeight: 20 },
	chatTime: { fontSize: 10, color: T.textSec, marginTop: 4, textAlign: 'right' },
	chatInputWrap: {
		flexDirection: 'row', alignItems: 'flex-end', gap: 10,
		padding: 14, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.surface,
	},
	chatInput: {
		flex: 1, backgroundColor: T.surface2, borderRadius: 14,
		paddingHorizontal: 16, paddingVertical: 10,
		fontSize: 14, maxHeight: 90, color: T.textPrimary,
		borderWidth: 1, borderColor: T.border,
	},
	chatSendBtn: {
		width: 44, height: 44, borderRadius: 22, backgroundColor: T.accent,
		alignItems: 'center', justifyContent: 'center',
		shadowColor: T.accent, shadowRadius: 8, shadowOpacity: 0.4, elevation: 4,
	},
	chatSendText: { color: T.white, fontSize: 20, fontWeight: '800', marginTop: -2 },

	// ── OVERRIDE MODAL ───────────────────────────────────────────────────────
	modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
	modalSheet: {
		backgroundColor: T.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
		paddingHorizontal: 20, paddingBottom: 40,
		maxHeight: SCREEN_H * 0.92,
		borderTopWidth: 1, borderColor: T.border,
	},
	modalHandle: { width: 40, height: 4, backgroundColor: T.borderBright, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
	modalHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
	modalStudentName: { fontSize: 22, fontWeight: '800', color: T.textPrimary, letterSpacing: -0.3 },
	modalStudentRoll: { fontSize: 13, color: T.textSec, marginTop: 3 },
	modalCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.border },
	modalCloseTxt: { fontSize: 14, color: T.textSec, fontWeight: '700' },
	proxyBanner: {
		flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14,
		backgroundColor: T.amberDim, borderRadius: 12, padding: 12,
		borderWidth: 1, borderColor: T.amber + '33',
	},
	proxyBannerIcon: { fontSize: 16 },
	proxyBannerText: { flex: 1, fontSize: 12, color: T.amber, fontWeight: '600', lineHeight: 18 },
	modalImage: { width: '100%', height: 190, borderRadius: 16, marginBottom: 4, backgroundColor: T.surface2 },
	modalImageOverlay: {
		position: 'absolute', bottom: 12, right: 10,
		backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 99,
		paddingHorizontal: 10, paddingVertical: 5,
	},
	modalImageHint: { color: T.white, fontSize: 11, fontWeight: '700' },
	modalNoImage: {
		height: 90, backgroundColor: T.surface2, borderRadius: 16,
		alignItems: 'center', justifyContent: 'center',
		borderWidth: 1, borderColor: T.border, marginBottom: 14, gap: 6,
	},
	modalNoImageIcon: { fontSize: 24 },
	modalNoImageText: { fontSize: 12, color: T.textMute, fontWeight: '600' },
	scoreRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 14 },
	scoreChip: {
		flex: 1, alignItems: 'center', borderRadius: 12, paddingVertical: 12,
		borderWidth: 1,
	},
	scoreChipValue: { fontSize: 20, fontWeight: '900' },
	scoreChipLabel: { fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
	currentStatusBanner: {
		flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12,
		padding: 12, marginBottom: 20, borderWidth: 1,
	},
	currentStatusIcon: { fontSize: 22 },
	currentStatusText: { fontSize: 14, fontWeight: '800' },
	currentStatusSub: { fontSize: 11, color: T.textSec, marginTop: 2 },
	overrideHeading: { fontSize: 11, fontWeight: '700', color: T.textMute, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
	overrideToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
	overrideToggleBtn: {
		flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: T.border,
		paddingVertical: 13, alignItems: 'center', backgroundColor: T.surface2,
	},
	overrideToggleTxt: { fontSize: 14, fontWeight: '700', color: T.textSec },
	reasonInput: {
		backgroundColor: T.surface2, borderRadius: 12, borderWidth: 1, borderColor: T.border,
		padding: 14, fontSize: 14, color: T.textPrimary, minHeight: 80,
		marginBottom: 16, textAlignVertical: 'top',
	},
	overrideSubmitBtn: {
		backgroundColor: T.accent, borderRadius: 14, paddingVertical: 15,
		alignItems: 'center', marginBottom: 10,
		shadowColor: T.accent, shadowRadius: 10, shadowOpacity: 0.35, elevation: 5,
	},
	overrideSubmitTxt: { color: T.white, fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },
	modalCancelBtn: { paddingVertical: 12, alignItems: 'center' },
	modalCancelTxt: { color: T.textSec, fontSize: 14, fontWeight: '600' },

	// ── FULL SCREEN ──────────────────────────────────────────────────────────
	fullScreen: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
	fullScreenImg: { width: '100%', height: '100%' },
	fullScreenClose: {
		position: 'absolute', top: 56, right: 20, zIndex: 100,
		backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 99,
		width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
		borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
	},
	fullScreenCloseTxt: { color: T.white, fontSize: 14, fontWeight: '800' },
});