import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
	View, Text, StyleSheet, ScrollView, TouchableOpacity,
	Modal, Animated, RefreshControl, ActivityIndicator,
	Alert, TextInput, Pressable, Dimensions, FlatList,
	PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfessorAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

const { height: SH, width: SW } = Dimensions.get('window');

// ── Types ──────────────────────────────────────────────────────────────────

interface Course {
	course_id: string; name: string; code: string; section: string;
}

interface SessionSummary {
	session_id: string; course_id: string; course_name: string;
	course_code: string; section: string; status: 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'CANCELLED';
	started_at: string; ended_at: string | null; expires_at: string;
	present_count: number; absent_count: number; total_enrolled: number;
	attendance_credits: number; class_duration_minutes: number;
	radius_meters: number;
}

interface RosterStudent {
	student_id: string; name: string; roll_number: string;
	face_enrolled: boolean; status: 'PRESENT' | 'ABSENT';
	verification_method: string | null; override_reason: string | null;
	marked_at: string | null; attempt_count: number;
}

interface SessionDetail {
	session: SessionSummary & { course_name: string; course_code: string };
	students: RosterStudent[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
	const d = new Date(iso);
	return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
		' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function statusColor(s: SessionSummary['status']) {
	return s === 'ACTIVE' ? '#16a34a' : s === 'ENDED' ? '#2563eb' :
		s === 'EXPIRED' ? '#d97706' : '#dc2626';
}
function statusLabel(s: SessionSummary['status']) {
	return s === 'ACTIVE' ? '🟢 Active' : s === 'ENDED' ? '🔵 Ended' :
		s === 'EXPIRED' ? '🟡 Expired' : '🔴 Cancelled';
}

// ── Override Modal ───────────────────────────────────────────────────────────

function OverrideModal({
	student, sessionId, onClose, onDone,
}: {
	student: RosterStudent; sessionId: string;
	onClose: () => void; onDone: (studentId: string, status: 'PRESENT' | 'ABSENT') => void;
}) {
	const slideAnim = useRef(new Animated.Value(SH)).current;
	const backdrop = useRef(new Animated.Value(0)).current;
	const [reason, setReason] = useState('');
	const [newStatus, setStatus] = useState<'PRESENT' | 'ABSENT'>(
		student.status === 'PRESENT' ? 'ABSENT' : 'PRESENT'
	);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		Animated.parallel([
			Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200 }),
			Animated.timing(backdrop, { toValue: 1, duration: 220, useNativeDriver: true }),
		]).start();
	}, []);

	function close() {
		Animated.parallel([
			Animated.timing(slideAnim, { toValue: SH, duration: 240, useNativeDriver: true }),
			Animated.timing(backdrop, { toValue: 0, duration: 200, useNativeDriver: true }),
		]).start(() => onClose());
	}

	async function save() {
		if (!reason.trim()) { Alert.alert('Reason required', 'Please enter a reason for the override.'); return; }
		setSaving(true);
		try {
			await ProfessorAPI.overrideAttendance(sessionId, {
				student_id: student.student_id, status: newStatus, override_reason: reason.trim(),
			});
			onDone(student.student_id, newStatus);
			close();
		} catch (e: any) {
			Alert.alert('Error', e.response?.data?.error || 'Override failed');
		} finally { setSaving(false); }
	}

	return (
		<Modal transparent animationType="none" onRequestClose={close}>
			<Animated.View style={[ovS.backdrop, { opacity: backdrop }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={close} />
			</Animated.View>
			<Animated.View style={[ovS.sheet, { transform: [{ translateY: slideAnim }] }]}>
				<View style={ovS.handle} />
				<Text style={ovS.title}>Override Attendance</Text>
				<Text style={ovS.subtitle}>{student.name} · {student.roll_number}</Text>

				{/* Toggle */}
				<View style={ovS.toggleRow}>
					{(['PRESENT', 'ABSENT'] as const).map(s => (
						<TouchableOpacity key={s} onPress={() => setStatus(s)}
							style={[ovS.toggleBtn,
							{
								backgroundColor: newStatus === s
									? (s === 'PRESENT' ? '#dcfce7' : '#fee2e2')
									: '#f8fafc',
								borderColor: newStatus === s
									? (s === 'PRESENT' ? '#16a34a' : '#dc2626')
									: '#e2e8f0',
							}]}>
							<Text style={[ovS.toggleTxt,
							{
								color: newStatus === s
									? (s === 'PRESENT' ? '#15803d' : '#b91c1c')
									: '#94a3b8'
							}]}>
								{s === 'PRESENT' ? '✅ Present' : '❌ Absent'}
							</Text>
						</TouchableOpacity>
					))}
				</View>

				{/* Reason input */}
				<Text style={ovS.label}>Reason for override</Text>
				<TextInput
					style={ovS.input} placeholder="e.g. Student was present but GPS failed…"
					placeholderTextColor="#94a3b8" value={reason} onChangeText={setReason}
					multiline numberOfLines={3} textAlignVertical="top"
				/>

				<TouchableOpacity style={[ovS.saveBtn, saving && { opacity: 0.7 }]}
					onPress={save} disabled={saving}>
					{saving
						? <ActivityIndicator color="#fff" />
						: <Text style={ovS.saveTxt}>Save Override & Notify Student</Text>}
				</TouchableOpacity>
			</Animated.View>
		</Modal>
	);
}

// ── Roster Modal ─────────────────────────────────────────────────────────────

function RosterModal({
	sessionId, onClose,
}: { sessionId: string; onClose: () => void }) {
	const slideAnim = useRef(new Animated.Value(SH)).current;
	const backdrop = useRef(new Animated.Value(0)).current;
	const [detail, setDetail] = useState<SessionDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [selectedStudent, setSelectedStudent] = useState<RosterStudent | null>(null);

	useEffect(() => {
		Animated.parallel([
			Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 180 }),
			Animated.timing(backdrop, { toValue: 1, duration: 250, useNativeDriver: true }),
		]).start();
		load();
	}, []);

	async function load() {
		setLoading(true);
		try {
			const res = await ProfessorAPI.getSessionRoster(sessionId);
			setDetail(res.data.data);
		} catch { Alert.alert('Error', 'Failed to load session roster'); }
		finally { setLoading(false); }
	}

	function close() {
		Animated.parallel([
			Animated.timing(slideAnim, { toValue: SH, duration: 260, useNativeDriver: true }),
			Animated.timing(backdrop, { toValue: 0, duration: 220, useNativeDriver: true }),
		]).start(() => onClose());
	}

	function handleOverrideDone(studentId: string, newStatus: 'PRESENT' | 'ABSENT') {
		setDetail(prev => prev ? {
			...prev,
			students: prev.students.map(s =>
				s.student_id === studentId ? { ...s, status: newStatus } : s
			),
		} : prev);
	}

	const present = detail?.students.filter(s => s.status === 'PRESENT') ?? [];
	const absent = detail?.students.filter(s => s.status === 'ABSENT') ?? [];

	return (
		<Modal transparent animationType="none" statusBarTranslucent onRequestClose={close}>
			<Animated.View style={[roS.backdrop, { opacity: backdrop }]}>
				<Pressable style={StyleSheet.absoluteFill} onPress={close} />
			</Animated.View>

			<Animated.View style={[roS.sheet, { transform: [{ translateY: slideAnim }] }]}>
				<View style={roS.handle} />

				{loading || !detail ? (
					<View style={roS.center}>
						<ActivityIndicator color={COLORS.primary} size="large" />
					</View>
				) : (
					<>
						{/* Header */}
						<View style={roS.header}>
							<View style={{ flex: 1 }}>
								<Text style={roS.title} numberOfLines={1}>{detail.session.course_name}</Text>
								<Text style={roS.sub}>{detail.session.course_code} · {formatDate(detail.session.started_at)}</Text>
								<View style={roS.statusChip}>
									<Text style={[roS.statusTxt, { color: statusColor(detail.session.status) }]}>
										{statusLabel(detail.session.status)}
									</Text>
								</View>
							</View>
							<TouchableOpacity onPress={close} style={roS.closeBtn}>
								<Text style={roS.closeTxt}>✕</Text>
							</TouchableOpacity>
						</View>

						{/* Stats bar */}
						<View style={roS.statsRow}>
							<View style={[roS.statBox, { backgroundColor: '#dcfce7', borderColor: '#86efac' }]}>
								<Text style={[roS.statNum, { color: '#16a34a' }]}>{present.length}</Text>
								<Text style={roS.statLbl}>Present</Text>
							</View>
							<View style={[roS.statBox, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}>
								<Text style={[roS.statNum, { color: '#dc2626' }]}>{absent.length}</Text>
								<Text style={roS.statLbl}>Absent</Text>
							</View>
							<View style={[roS.statBox, { flex: 1.2, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
								<Text style={[roS.statNum, { color: '#2563eb' }]}>
									{detail.students.length > 0
										? Math.round((present.length / detail.students.length) * 100) : 0}%
								</Text>
								<Text style={roS.statLbl}>Rate</Text>
							</View>
						</View>

						{/* Student list */}
						<ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
							{[
								{ label: '✅ Present', list: present, bg: '#f0fdf4', border: '#bbf7d0' },
								{ label: '❌ Absent', list: absent, bg: '#fff1f2', border: '#fecdd3' },
							].map(({ label, list, bg, border }) => (
								list.length > 0 && (
									<View key={label} style={{ marginBottom: 8 }}>
										<Text style={roS.groupLabel}>{label}</Text>
										{list.map(student => (
											<TouchableOpacity key={student.student_id}
												style={[roS.studentCard, { backgroundColor: bg, borderColor: border }]}
												onPress={() => setSelectedStudent(student)}
												activeOpacity={0.8}>
												<View style={roS.studentLeft}>
													<Text style={roS.studentName}>{student.name}</Text>
													<Text style={roS.studentRoll}>{student.roll_number}</Text>
													{student.override_reason && (
														<Text style={roS.overrideNote}>
															✏️ Overridden: {student.override_reason}
														</Text>
													)}
													{student.marked_at && (
														<Text style={roS.markedAt}>
															🕐 {new Date(student.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
														</Text>
													)}
												</View>
												<View style={roS.studentRight}>
													{!student.face_enrolled && (
														<Text style={roS.noFaceBadge}>No face</Text>
													)}
													<Text style={roS.overrideHint}>Tap to override ›</Text>
												</View>
											</TouchableOpacity>
										))}
									</View>
								)
							))}
							<View style={{ height: 32 }} />
						</ScrollView>
					</>
				)}
			</Animated.View>

			{selectedStudent && detail && (
				<OverrideModal
					student={selectedStudent}
					sessionId={sessionId}
					onClose={() => setSelectedStudent(null)}
					onDone={handleOverrideDone}
				/>
			)}
		</Modal>
	);
}


// ── Swipeable Session Card ───────────────────────────────────────────────────

// ── Swipeable Session Card (Seamless & 2-Way) ───────────────────────────────

function SwipeableSessionCard({
	session, onPress, onDelete
}: {
	session: SessionSummary;
	onPress: () => void;
	onDelete: () => void;
}) {
	const panX = useRef(new Animated.Value(0)).current;
	const isSwiped = useRef(false);

	const panResponder = useRef(
		PanResponder.create({
			onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
			onPanResponderMove: (_, g) => {
				// Allow swipe in both directions
				panX.setValue(g.dx);
			},
			onPanResponderRelease: (_, g) => {
				if (g.dx < -60) {
					// Snapped left
					Animated.spring(panX, { toValue: -80, useNativeDriver: true, bounciness: 12 }).start();
					isSwiped.current = true;
				} else if (g.dx > 60) {
					// Snapped right
					Animated.spring(panX, { toValue: 80, useNativeDriver: true, bounciness: 12 }).start();
					isSwiped.current = true;
				} else {
					// Snap closed
					Animated.spring(panX, { toValue: 0, useNativeDriver: true, bounciness: 12 }).start();
					isSwiped.current = false;
				}
			},
			onPanResponderTerminate: () => {
				Animated.spring(panX, { toValue: 0, useNativeDriver: true, bounciness: 12 }).start();
				isSwiped.current = false;
			}
		})
	).current;

	const handlePress = () => {
		if (isSwiped.current) {
			Animated.spring(panX, { toValue: 0, useNativeDriver: true, bounciness: 12 }).start();
			isSwiped.current = false;
		} else {
			onPress();
		}
	};

	const sc = statusColor(session.status);
	const pct = session.total_enrolled > 0
		? Math.round((session.present_count / session.total_enrolled) * 100) : 0;

	return (
		<View style={ss.swipeWrap}>
			{/* 🟢 Seamless Full-Width Background Strip */}
			<View style={ss.deleteBg}>
				<TouchableOpacity style={ss.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
					<Text style={ss.deleteIcon}>🗑️</Text>
					<Text style={ss.deleteTxt}>Delete</Text>
				</TouchableOpacity>
				<TouchableOpacity style={ss.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
					<Text style={ss.deleteIcon}>🗑️</Text>
					<Text style={ss.deleteTxt}>Delete</Text>
				</TouchableOpacity>
			</View>

			{/* Foreground Interactive Card */}
			<Animated.View
				{...panResponder.panHandlers}
				style={[ss.card, { borderLeftColor: sc, transform: [{ translateX: panX }] }]}
			>
				<TouchableOpacity activeOpacity={1} onPress={handlePress} style={{ width: '100%' }}>
					<View style={ss.cardTop}>
						<View style={{ flex: 1 }}>
							<Text style={ss.cardTitle} numberOfLines={1}>{session.course_name}</Text>
							<Text style={ss.cardSub}>{formatDate(session.started_at)}</Text>
						</View>
						<View style={[ss.statusBadge, { backgroundColor: sc + '18', borderColor: sc + '55' }]}>
							<Text style={[ss.statusBadgeTxt, { color: sc }]}>
								{statusLabel(session.status)}
							</Text>
						</View>
					</View>

					<View style={ss.barBg}>
						<View style={[ss.barFill,
						{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626' }]} />
					</View>

					<View style={ss.cardBottom}>
						<Text style={[ss.cardStat, { color: '#16a34a' }]}>✅ {session.present_count} present</Text>
						<Text style={[ss.cardStat, { color: '#dc2626' }]}>❌ {session.absent_count} absent</Text>
						<Text style={ss.cardStat}>👥 {session.total_enrolled} enrolled</Text>
						<Text style={[ss.cardStat, { color: '#2563eb' }]}>{pct}%</Text>
					</View>

					<View style={ss.cardMeta}>
						<Text style={ss.cardMetaTxt}>⏱ {session.class_duration_minutes}min</Text>
						<Text style={ss.cardMetaTxt}>📍 {session.radius_meters}m radius</Text>
						<Text style={ss.cardMetaTxt}>⭐ {session.attendance_credits} credits</Text>
					</View>
				</TouchableOpacity>
			</Animated.View>
		</View>
	);
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function SessionsScreen() {
	const [courses, setCourses] = useState<Course[]>([]);
	const [activeCourse, setActiveCourse] = useState<Course | null>(null);
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const [selectedSession, setSelectedSession] = useState<string | null>(null);
	const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'CANCELLED'>('ALL');

	useEffect(() => { loadCourses(); }, []);

	async function loadCourses() {
		try {
			const res = await ProfessorAPI.getCourses();
			const list: Course[] = res.data.data;
			setCourses(list);
			if (list.length > 0) { setActiveCourse(list[0]); loadSessions(list[0].course_id); }
		} catch { Alert.alert('Error', 'Failed to load courses'); }
	}

	async function loadSessions(courseId: string) {
		setLoading(true);
		try {
			const res = await ProfessorAPI.getCourseSessions(courseId);
			setSessions(res.data.data);
		} catch { Alert.alert('Error', 'Failed to load sessions'); }
		finally { setLoading(false); }
	}

	async function onRefresh() {
		setRefreshing(true);
		if (activeCourse) await loadSessions(activeCourse.course_id);
		setRefreshing(false);
	}

	function selectCourse(course: Course) {
		setActiveCourse(course);
		setSessions([]);
		setFilter('ALL');
		loadSessions(course.course_id);
	}

	const filtered = filter === 'ALL' ? sessions : sessions.filter(s => s.status === filter);

	// 🟢 NEW: Bulk Delete Handler
	const handleBulkDelete = () => {
		const toDelete = filtered.filter(s => s.status !== 'ACTIVE').map(s => s.session_id);
		if (toDelete.length === 0) {
			Alert.alert('Notice', 'No deletable sessions found in this filter (Active sessions cannot be deleted).');
			return;
		}
		Alert.alert(
			'Delete All?',
			`Are you sure you want to permanently delete ${toDelete.length} session(s)?`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						try {
							await ProfessorAPI.bulkDeleteSessions(toDelete);
							setSessions(prev => prev.filter(s => !toDelete.includes(s.session_id)));
						} catch (e: any) {
							Alert.alert('Error', e.response?.data?.error || 'Failed to delete sessions');
						}
					}
				}
			]
		);
	};

	return (
		<View style={ss.root}>
			<SafeAreaView style={ss.safe}>

				{/* Header */}
				<View style={ss.header}>
					<Text style={ss.headerTitle}>Sessions</Text>
					<Text style={ss.headerSub}>Tap a session to view & manage attendance</Text>
				</View>

				{/* Course tabs */}
				<ScrollView horizontal showsHorizontalScrollIndicator={false}
					style={ss.courseTabsScroll} contentContainerStyle={ss.courseTabs}>
					{courses.map(c => (
						<TouchableOpacity key={c.course_id} onPress={() => selectCourse(c)}
							style={[ss.courseTab, activeCourse?.course_id === c.course_id && ss.courseTabActive]}>
							<Text style={[ss.courseTabTxt,
							activeCourse?.course_id === c.course_id && ss.courseTabTxtActive]}>
								{c.code}{c.section ? ` §${c.section}` : ''}
							</Text>
						</TouchableOpacity>
					))}
				</ScrollView>

				{/* Filter chips */}
				<ScrollView horizontal showsHorizontalScrollIndicator={false}
					contentContainerStyle={ss.filterRow} style={{ maxHeight: 50 }}>
					{(['ALL', 'ACTIVE', 'ENDED', 'EXPIRED', 'CANCELLED'] as const).map(f => (
						<TouchableOpacity key={f} onPress={() => setFilter(f)}
							style={[ss.filterChip, filter === f && ss.filterChipActive]}>
							<Text style={[ss.filterChipTxt, filter === f && ss.filterChipTxtActive]}>{f}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>

				{/* Sessions list */}
				{loading ? (
					<View style={ss.center}>
						<ActivityIndicator color={COLORS.primary} size="large" />
					</View>
				) : (
					<ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACING.md }}
						refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
						showsVerticalScrollIndicator={false}>
						{/* 🟢 NEW: List Header with Bulk Delete */}
						{filtered.length > 0 && (
							<View style={ss.listHeader}>
								<Text style={ss.listCountTxt}>{filtered.length} Session{filtered.length !== 1 ? 's' : ''}</Text>
								<TouchableOpacity onPress={handleBulkDelete} style={ss.bulkDeleteBtn}>
									<Text style={ss.bulkDeleteTxt}>🗑️ Delete Filtered</Text>
								</TouchableOpacity>
							</View>
						)}
						{filtered.length === 0 ? (
							<View style={ss.empty}>
								<Text style={ss.emptyIcon}>📋</Text>
								<Text style={ss.emptyTxt}>No sessions found</Text>
							</View>
							
						) : filtered.map(session => (
							<SwipeableSessionCard
								key={session.session_id}
								session={session}
								onPress={() => setSelectedSession(session.session_id)}
								onDelete={() => {
									Alert.alert(
										'Delete Session?',
										'This will permanently delete this session and wipe all attendance records for it.',
										[
											{ text: 'Cancel', style: 'cancel' },
											{
												text: 'Delete',
												style: 'destructive',
												onPress: async () => {
													try {
														await ProfessorAPI.deleteSession(session.session_id);
														// Instantly remove from UI
														setSessions(prev => prev.filter(s => s.session_id !== session.session_id));
													} catch (e: any) {
														Alert.alert('Error', e.response?.data?.error || 'Failed to delete');
													}
												}
											}
										]
									);
								}}
							/>
						))}
						<View style={{ height: 24 }} />
					</ScrollView>
				)}
			</SafeAreaView>

			{selectedSession && (
				<RosterModal
					sessionId={selectedSession}
					onClose={() => setSelectedSession(null)}
				/>
			)}
		</View>
	);
}

// ── Styles ───────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
	root: { flex: 1, backgroundColor: '#f0f4f8' },
	safe: { flex: 1 },
	center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
	header: {
		backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.md,
	},
	headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
	headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

	courseTabsScroll: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
	courseTabs: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
	courseTab: {
		paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99,
		backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0',
	},
	courseTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
	courseTabTxt: { fontSize: 12, fontWeight: '700', color: '#64748b' },
	courseTabTxtActive: { color: '#fff' },

	filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 10 },
	filterChip: {
		paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
		backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: '#e2e8f0',
	},
	filterChipActive: { backgroundColor: COLORS.primary + '15', borderColor: COLORS.primary },
	filterChipTxt: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
	filterChipTxtActive: { color: COLORS.primary },

	card: {
		backgroundColor: '#fff', borderRadius: 14, padding: 14,
		borderLeftWidth: 4,
		shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
	},
	cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
	cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
	cardSub: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
	statusBadge: {
		paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
		borderWidth: 1, marginLeft: 8, alignSelf: 'flex-start',
	},
	statusBadgeTxt: { fontSize: 10, fontWeight: '700' },
	barBg: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 10 },
	barFill: { height: 5, borderRadius: 99 },
	cardBottom: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginBottom: 6 },
	cardStat: { fontSize: 12, fontWeight: '600', color: '#475569' },
	cardMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
	cardMetaTxt: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },

	empty: { alignItems: 'center', paddingTop: 80 },
	emptyIcon: { fontSize: 48 },
	emptyTxt: { fontSize: 15, color: '#94a3b8', marginTop: 12, fontWeight: '500' },
	// ── Swipe & Delete Styles ──
  swipeWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  // Replaces the old 'deleteStrip'
  deleteBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  deleteBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: { fontSize: 20, marginBottom: 2 },
  deleteTxt: { color: '#dc2626', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  // List header & Bulk Delete
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listCountTxt: { fontSize: 12, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 },
  bulkDeleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  bulkDeleteTxt: { color: '#dc2626', fontSize: 11, fontWeight: '700' },

	// Note: Remove marginBottom: 12 from your original `card` style since `swipeWrap` handles it now!
	// Change `card: { ... }` to no longer have `marginBottom: 12`
});

const roS = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,8,23,0.6)' },
	sheet: {
		position: 'absolute', bottom: 0, left: 0, right: 0,
		backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
		paddingTop: 10, maxHeight: SH * 0.92,
		shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.15, shadowRadius: 20, elevation: 30,
	},
	handle: { alignSelf: 'center', width: 44, height: 5, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 16 },
	center: { height: 200, justifyContent: 'center', alignItems: 'center' },
	header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, marginBottom: 12 },
	title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
	sub: { fontSize: 12, color: '#64748b', marginTop: 3 },
	statusChip: { marginTop: 4 },
	statusTxt: { fontSize: 12, fontWeight: '700' },
	closeBtn: {
		width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9',
		alignItems: 'center', justifyContent: 'center', marginLeft: 8,
	},
	closeTxt: { fontSize: 13, color: '#475569', fontWeight: '700' },

	statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 14 },
	statBox: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1.5 },
	statNum: { fontSize: 22, fontWeight: '900' },
	statLbl: { fontSize: 10, color: '#94a3b8', fontWeight: '600', marginTop: 2, textTransform: 'uppercase' },

	groupLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', paddingHorizontal: 16, marginBottom: 6, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
	studentCard: {
		marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 12,
		borderWidth: 1.5, flexDirection: 'row', alignItems: 'center',
	},
	studentLeft: { flex: 1 },
	studentName: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
	studentRoll: { fontSize: 11, color: '#64748b', marginTop: 1 },
	overrideNote: { fontSize: 10, color: '#d97706', marginTop: 3, fontStyle: 'italic' },
	markedAt: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
	studentRight: { alignItems: 'flex-end', gap: 4 },
	noFaceBadge: { fontSize: 9, color: '#dc2626', backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, fontWeight: '700' },
	overrideHint: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
});

const ovS = StyleSheet.create({
	backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,8,23,0.5)' },
	sheet: {
		position: 'absolute', bottom: 0, left: 0, right: 0,
		backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
		paddingTop: 10, paddingHorizontal: 20, paddingBottom: 40,
		shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
		shadowOpacity: 0.2, shadowRadius: 20, elevation: 40,
	},
	handle: { alignSelf: 'center', width: 44, height: 5, backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 20 },
	title: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
	subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },

	toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
	toggleBtn: {
		flex: 1, paddingVertical: 14, borderRadius: 14,
		borderWidth: 2, alignItems: 'center',
	},
	toggleTxt: { fontSize: 14, fontWeight: '800' },

	label: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
	input: {
		borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 12,
		padding: 12, fontSize: 14, color: '#0f172a', minHeight: 90, marginBottom: 20,
		backgroundColor: '#f8fafc',
	},
	saveBtn: {
		backgroundColor: COLORS.primary, borderRadius: 14,
		paddingVertical: 16, alignItems: 'center',
	},
	saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});