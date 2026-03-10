import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
  ActivityIndicator, Animated, Modal,
  Pressable, Dimensions, PanResponder
} from 'react-native';

import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useAuthStore } from '../../src/store/auth.store';
import { StudentAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Socket } from 'socket.io-client';
import {
  connectSocket, disconnectSocket,
  joinSession, leaveSession,
} from '../../src/services/socket';
import SessionChat from '../../src/components/SessionChat';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Course {
  course_id: string;
  name: string;
  code: string;
  section: string;
  professor_name: string;
  attendance_pct: number;
  attended: number;
  total_sessions: number;
}

interface NearbySession {
  session_id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  professor_name: string;
  expires_at: string;
  challenges: string[];
  distance_meters: number;
  // Fields added by the patched getNearbyActiveSession backend
  my_status: 'PRESENT' | 'ABSENT' | null;
  my_verification: string | null;
  attempt_count: number;
}

type ScanState = 'idle' | 'locating' | 'checking' | 'found' | 'none' | 'error';

// ─────────────────────────────────────────────────────────────────────────────
// Constants / helpers
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Zero-padded YYYY-MM-DD string, matching what the backend returns */
function toYMD(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Today as a YYYY-MM-DD string — timezone-safe */
function todayYMD(): string {
  const d = new Date();
  return toYMD(d.getFullYear(), d.getMonth(), d.getDate());
}
const CAL_H_PAD = 14;
// Total usable width ÷ 7, no gap tricks — margin is applied per-cell
const CELL_W = Math.floor((SCREEN_WIDTH - CAL_H_PAD * 2) / 7);
const CELL_H = CELL_W;
const CELL_R = 10;
const CELL_MX = 5; // no horizontal margin — cells are exactly CELL_W each

interface CalendarModalProps {
  course: Course;
  onClose: () => void;
}

function CourseCalendarModal({ course, onClose }: CalendarModalProps) {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const monthSlide = useRef(new Animated.Value(0)).current;
  const monthOpacity = useRef(new Animated.Value(1)).current;

  const todayStr = todayYMD();
  const todayDate = new Date();

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());
  const [dateMap, setDateMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // ── Keep refs in sync with state for use inside PanResponder ──────────
  const viewYearRef = useRef(viewYear);
  const viewMonthRef = useRef(viewMonth);
  useEffect(() => { viewYearRef.current = viewYear; }, [viewYear]);
  useEffect(() => { viewMonthRef.current = viewMonth; }, [viewMonth]);

  const isAnimating = useRef(false);

  // ── Slide-in on mount ─────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, damping: 24, stiffness: 180,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1, duration: 250, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Fetch calendar data ───────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    StudentAPI.getCourseAttendanceCalendar(course.course_id)
      .then((res: any) => setDateMap(res.data.data ?? {}))
      .catch(() => setDateMap({}))
      .finally(() => setLoading(false));
  }, [course.course_id]);

  // ── Slide-out + close ─────────────────────────────────────────────────
  function handleClose() {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: SCREEN_HEIGHT, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  // ── Animated month transition ─────────────────────────────────────────
  function animateMonthChange(direction: 'left' | 'right', callback: () => void) {
    if (isAnimating.current) return;
    isAnimating.current = true;
    const outX = direction === 'left' ? -SCREEN_WIDTH * 0.4 : SCREEN_WIDTH * 0.4;
    const inX = direction === 'left' ? SCREEN_WIDTH * 0.4 : -SCREEN_WIDTH * 0.4;
    Animated.parallel([
      Animated.timing(monthSlide, { toValue: outX, duration: 150, useNativeDriver: true }),
      Animated.timing(monthOpacity, { toValue: 0, duration: 130, useNativeDriver: true }),
    ]).start(() => {
      monthSlide.setValue(inX);
      callback();
      Animated.parallel([
        Animated.spring(monthSlide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }),
        Animated.timing(monthOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]).start(() => { isAnimating.current = false; });
    });
  }

  // ── These use refs — safe to call from PanResponder ───────────────────
  function goToPrevMonth() {
    const m = viewMonthRef.current;
    const y = viewYearRef.current;
    animateMonthChange('right', () => {
      if (m === 0) { setViewYear(y - 1); setViewMonth(11); }
      else setViewMonth(m - 1);
    });
  }

  function goToNextMonth() {
    const m = viewMonthRef.current;
    const y = viewYearRef.current;
    const atCurrent =
      y === todayDate.getFullYear() && m === todayDate.getMonth();
    if (atCurrent) return;
    animateMonthChange('left', () => {
      if (m === 11) { setViewYear(y + 1); setViewMonth(0); }
      else setViewMonth(m + 1);
    });
  }

  // ── PanResponder — refs fix the stale-closure bug ────────────────────
  const swipeStartX = useRef(0);
  // ── PanResponder — Bulletproof Touch Math ────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => {
        // Hijack the touch ONLY if it's clearly a horizontal swipe (prevents blocking vertical scrolls)
        return Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) goToNextMonth();
        else if (g.dx > 40) goToPrevMonth();
      },
      // ADDED: Android sometimes "terminates" the gesture instead of releasing it
      onPanResponderTerminate: (_, g) => {
        if (g.dx < -40) goToNextMonth();
        else if (g.dx > 40) goToPrevMonth();
      },
    })
  ).current;

  const isAtCurrentMonth =
    viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth();

  // ── Build grid cells ──────────────────────────────────────────────────
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: Array<{ day: number | null; ymd: string | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, ymd: null });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, ymd: toYMD(viewYear, viewMonth, d) });

  // ── Month-level P/A counts ────────────────────────────────────────────
  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-`;
  let mPresent = 0, mAbsent = 0;
  for (const [d, s] of Object.entries(dateMap)) {
    if (!d.startsWith(monthPrefix)) continue;
    if (s === 'PRESENT') mPresent++;
    else if (s === 'ABSENT') mAbsent++;
  }

  const pct = Number(course.attendance_pct) || 0;
  const pctColor = pct >= 75 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>

      {/* Backdrop */}
      <Animated.View style={[calS.backdrop, { opacity: backdropAnim }]} pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[calS.sheet, { transform: [{ translateY: slideAnim }] }]}>

        {/* Handle */}
        <View style={calS.handle} />

        {/* Course title */}
        <View style={calS.hero}>
          <View style={{ flex: 1 }}>
            <Text style={calS.heroTitle} numberOfLines={1}>{course.name}</Text>
            <Text style={calS.heroSub}>
              {course.code}{course.section ? ` · §${course.section}` : ''} · {course.professor_name}
            </Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={calS.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={calS.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={calS.statsRow}>
          <View style={[calS.statCard, { borderColor: 'rgba(34,197,94,0.35)', backgroundColor: 'rgba(34,197,94,0.07)' }]}>
            <Text style={[calS.statNum, { color: '#16a34a' }]}>{course.attended}</Text>
            <Text style={calS.statLbl}>Present</Text>
          </View>
          <View style={[calS.statCard, { borderColor: 'rgba(239,68,68,0.35)', backgroundColor: 'rgba(239,68,68,0.07)' }]}>
            <Text style={[calS.statNum, { color: '#dc2626' }]}>{course.total_sessions - course.attended}</Text>
            <Text style={calS.statLbl}>Absent</Text>
          </View>
          <View style={[calS.statCard, { borderColor: `${pctColor}55`, backgroundColor: `${pctColor}11`, flex: 1.2 }]}>
            <Text style={[calS.statNum, { color: pctColor, fontSize: 22 }]}>{pct}%</Text>
            <Text style={calS.statLbl}>Attendance</Text>
          </View>
        </View>

        {/* Swipeable calendar area */}
        {/* Swipeable calendar area */}
        <View
          {...panResponder.panHandlers}
          collapsable={false}
          style={{ backgroundColor: 'transparent', width: '100%' }}
        >

          {/* Month navigator */}
          <View style={calS.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} style={calS.navBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={calS.navArrow}>‹</Text>
            </TouchableOpacity>

            <Animated.View style={[calS.monthCenter,
            { transform: [{ translateX: monthSlide }], opacity: monthOpacity }]}>
              <Text style={calS.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
              {(mPresent > 0 || mAbsent > 0) && (
                <View style={calS.monthPills}>
                  {mPresent > 0 && (
                    <View style={[calS.pill, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
                      <View style={[calS.pillDot, { backgroundColor: '#16a34a' }]} />
                      <Text style={[calS.pillTxt, { color: '#15803d' }]}>{mPresent}P</Text>
                    </View>
                  )}
                  {mAbsent > 0 && (
                    <View style={[calS.pill, { backgroundColor: 'rgba(220,38,38,0.10)' }]}>
                      <View style={[calS.pillDot, { backgroundColor: '#ef4444' }]} />
                      <Text style={[calS.pillTxt, { color: '#dc2626' }]}>{mAbsent}A</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>

            <TouchableOpacity onPress={goToNextMonth}
              style={[calS.navBtn, isAtCurrentMonth && { opacity: 0.25 }]}
              disabled={isAtCurrentMonth}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={calS.navArrow}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day-of-week header */}
          <View style={calS.weekRow}>
            {DAY_LABELS.map(l => (
              <Text key={l} style={calS.weekLbl}>{l}</Text>
            ))}
          </View>

          {/* Calendar grid */}
          {loading ? (
            <View style={calS.loadingBox}>
              <ActivityIndicator color={COLORS.primary} size="large" />
              <Text style={calS.loadingTxt}>Loading…</Text>
            </View>
          ) : (
            <Animated.View style={[calS.grid,
            { transform: [{ translateX: monthSlide }], opacity: monthOpacity }]}>
              {cells.map((cell, idx) => {
                if (!cell.day || !cell.ymd)
                  return <View key={`sp-${idx}`} style={calS.cellEmpty} />;

                const status = dateMap[cell.ymd];
                const isToday = cell.ymd === todayStr;
                const isFuture = cell.ymd > todayStr;
                const isPresent = status === 'PRESENT';
                const isAbsent = status === 'ABSENT';

                return (
                  <View key={cell.ymd} style={[
                    calS.cell,
                    isPresent ? calS.cellPresent
                      : isAbsent ? calS.cellAbsent
                        : isToday ? calS.cellToday
                          : calS.cellNeutral,
                  ]}>
                    <Text style={[
                      calS.cellTxt,
                      isPresent || isAbsent ? calS.cellTxtFilled
                        : isToday ? calS.cellTxtToday
                          : isFuture ? calS.cellTxtFuture
                            : calS.cellTxtDefault,
                    ]}>
                      {cell.day}
                    </Text>
                    {isToday && (isPresent || isAbsent) && (
                      <View style={calS.todayDot} />
                    )}
                  </View>
                );
              })}
            </Animated.View>
          )}
        </View>

        {/* Legend */}
        <View style={calS.legend}>
          {([
            { color: '#16a34a', label: 'Present' },
            { color: '#ef4444', label: 'Absent' },
            { color: '#f1f5f9', label: 'No class', border: '#e2e8f0' },
          ] as const).map(item => (
            <View key={item.label} style={calS.legendItem}>
              <View style={[calS.legendSwatch, { backgroundColor: item.color },
              'border' in item ? { borderWidth: 1.5, borderColor: item.border } : null]} />
              <Text style={calS.legendLbl}>{item.label}</Text>
            </View>
          ))}
          <View style={calS.legendItem}>
            <View style={[calS.legendSwatch,
            { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: 'transparent' }]} />
            <Text style={calS.legendLbl}>Today</Text>
          </View>
        </View>

        <Text style={calS.swipeHint}>← swipe to change month →</Text>
        <View style={{ height: 24 }} />
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user, accessToken } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [faceEnrolled, setFaceEnrolled] = useState(!!user?.face_enrolled_at);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [nearbySession, setNearbySession] = useState<NearbySession | null>(null);
  const [scanMessage, setScanMessage] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activeSessionIdRef = useRef<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);


  const [chatSocket, setChatSocket] = useState<Socket | null>(null);

  // FIX 3: forceOpen → passed to SessionChat so the panel opens immediately
  // when the in-card 💬 button is tapped.
  const [chatForceOpen, setChatForceOpen] = useState(false);

  // FIX 1: calCourse drives conditional rendering of the modal
  const [calCourse, setCalCourse] = useState<Course | null>(null);

  // ── NEW: Location Tracking State ──────────────────────────────────────────
  const [lastLocName, setLastLocName] = useState<string>('Fetching location...');
  const [lastLocTime, setLastLocTime] = useState<Date | null>(null);


  // Ultra-precise reverse geocoding using Expo's native location engine
  const decodeAndSetAddress = async (lat: number, lng: number, timestamp: Date) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const r = result[0];
        const address = [r.name, r.street, r.subregion, r.city].filter(Boolean).join(', ');
        setLastLocName(address || 'Unknown Area');
      } else {
        setLastLocName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setLastLocTime(timestamp);
    } catch (err) {
      setLastLocName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setLastLocTime(timestamp);
    }
  };

  // Fetch location from DB on mount
  const fetchSavedLocation = async () => {
    try {
      const res = await StudentAPI.getLastLocation();
      if (res.data.data) {
        const { lat, lng, updated_at } = res.data.data;
        // The DB returns UTC; JS Date automatically converts it to local device time (IST)
        await decodeAndSetAddress(lat, lng, new Date(updated_at));
      } else {
        setLastLocName('Location not set');
      }
    } catch (err) {
      setLastLocName('Location unavailable');
    }
  };

  // Add fetchSavedLocation to your existing mount useEffect
  useEffect(() => {
    if (accessToken) {
      loadData();
      fetchSavedLocation();
    }
  }, [accessToken]);

  // Ultra-precise reverse geocoding using Expo's native location engine
  const updateLocationAddress = async (lat: number, lng: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (result.length > 0) {
        const r = result[0];
        // Combine available fields for the most precise human-readable name
        const address = [r.name, r.street, r.subregion, r.city].filter(Boolean).join(', ');
        setLastLocName(address || 'Unknown Area');
      } else {
        setLastLocName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
      setLastLocTime(new Date());
    } catch (err) {
      setLastLocName(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setLastLocTime(new Date());
    }
  };

  // ── Socket cleanup ────────────────────────────────────────────────────────
  useEffect(() => { return () => { disconnectSocket(); }; }, []);

  // ── Connect socket ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;
    const sock = connectSocket(accessToken);
    const onConnect = () => setChatSocket(sock);
    if (sock.connected) onConnect();
    else sock.once('connect', onConnect);
    return () => {
      sock.off('connect', onConnect);
      if (activeSessionIdRef.current) {
        leaveSession(activeSessionIdRef.current);
        activeSessionIdRef.current = null;
      }
      setChatSocket(null);
      disconnectSocket();
    };
  }, [accessToken]);

  // ── Join session room + socket events ─────────────────────────────────────
  useEffect(() => {
    if (scanState !== 'found' || !nearbySession || !chatSocket) return;

    const sessionId = nearbySession.session_id;
    joinSession(sessionId);
    activeSessionIdRef.current = sessionId;

    const onEnded = () => {
      setScanState('none');
      setScanMessage('The attendance session has ended.');
      setNearbySession(null);
      setChatForceOpen(false);
      activeSessionIdRef.current = null;
      setTimeout(() => { setScanState('idle'); setScanMessage(''); }, 5000);
    };

    const onCancelled = () => {
      setNearbySession(null);
      setChatForceOpen(false);
      activeSessionIdRef.current = null;
      Alert.alert('Session Cancelled', 'The professor cancelled this session. No attendance recorded.');
      setScanState('idle');
      setScanMessage('');
    };

    const onOverride = (event: any) => {
      const data = event?.data ?? event;
      const absent = data?.status === 'ABSENT';
      if (!absent) {
        setNearbySession(prev => prev
          ? { ...prev, my_status: 'PRESENT', my_verification: 'VERIFIED' }
          : prev
        );
      }
      Alert.alert(
        absent ? 'Marked Absent' : 'Marked Present',
        absent
          ? `Attendance changed to Absent.\nReason: ${data?.override_reason || 'No reason given'}\n\nYou can re-verify if the session is still active.`
          : 'Your attendance was manually marked Present by the professor.'
      );
    };

    chatSocket.on('SESSION_ENDED', onEnded);
    chatSocket.on('SESSION_EXPIRED', onEnded);
    chatSocket.on('SESSION_CANCELLED', onCancelled);
    chatSocket.on('STUDENT_MANUAL_OVERRIDE', onOverride);

    return () => {
      chatSocket.off('SESSION_ENDED', onEnded);
      chatSocket.off('SESSION_EXPIRED', onEnded);
      chatSocket.off('SESSION_CANCELLED', onCancelled);
      chatSocket.off('STUDENT_MANUAL_OVERRIDE', onOverride);
      leaveSession(sessionId);
      activeSessionIdRef.current = null;
    };
  }, [scanState, nearbySession?.session_id, chatSocket]);

  // ── Data loading ──────────────────────────────────────────────────────────
  async function loadData() {
    try {
      const [coursesRes, enrollRes] = await Promise.all([
        StudentAPI.getMyCourses(),
        StudentAPI.getEnrollmentStatus(),
      ]);
      setCourses(coursesRes.data.data);
      setFaceEnrolled(enrollRes.data.data.is_enrolled);
    } catch (err) {
      console.error('Load error:', err);
    }
  }

  useEffect(() => { if (accessToken) loadData(); }, [accessToken]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  // ── Pulse animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (scanState === 'locating' || scanState === 'checking') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [scanState]);

  const getCoordinates = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setScanState('error');
      setScanMessage('Location permission required to check nearby sessions.');
      return;
    }

    let bestLocation: Awaited<ReturnType<typeof Location.getCurrentPositionAsync>> | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const acc = loc.coords.accuracy ?? 999;
        if (!bestLocation || acc < (bestLocation.coords.accuracy ?? 999)) bestLocation = loc;
        if (acc <= 40) break;
        await new Promise(r => setTimeout(r, 1500));
      } catch { break; }
    }

    if (!bestLocation) {
      Alert.alert('GPS Error', 'Could not get a precise location. Step near a window and try again.');
      setScanState('idle');
      return;
    }

    return bestLocation;

  }

  // ── Check nearby session ──────────────────────────────────────────────────
  const checkNearbySession = useCallback(async () => {
    if (scanState === 'locating' || scanState === 'checking') return;

    setNearbySession(null);
    setChatForceOpen(false);
    setScanState('locating');
    setScanMessage('Getting your location…');

    let lat: number, lng: number;
    try {

      const bestLocation = await getCoordinates();
      if (!bestLocation) return;

      lat = bestLocation.coords.latitude;
      lng = bestLocation.coords.longitude;

      // 🟢 NEW: Update UI with reverse geocoded address
      updateLocationAddress(lat, lng);
    } catch {
      setScanState('error');
      setScanMessage('Could not get your location. Please try again.');
      return;
    }

    try {
      await StudentAPI.pingLocation(lat, lng); // 🟢 ADD THIS LINE directly after the ping succeeds so the UI updates instantly:
      decodeAndSetAddress(lat, lng, new Date());
    } catch { /* non-fatal */ }

    setScanState('checking');
    setScanMessage('Scanning for active attendance sessions…');

    try {
      const res = await StudentAPI.getNearbyActiveSession(lat, lng);
      const session: NearbySession | null = res.data.data;

      if (session) {
        setNearbySession(session);
        setScanState('found');
        setScanMessage('');
      } else {
        setScanState('none');
        setScanMessage('No active attendance session found nearby.');
        setTimeout(() => { setScanState('idle'); setScanMessage(''); }, 4000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Could not check for sessions. Try again.';
      setScanState('error');
      setScanMessage(msg);
      setTimeout(() => { setScanState('idle'); setScanMessage(''); }, 4000);
    }
  }, [scanState]);


  async function handlePingLocation() {
    if (isPinging) return;
    setIsPinging(true);
    try {
      const bestLocation = await getCoordinates();
      if (!bestLocation) return;

      await StudentAPI.pingLocation(bestLocation.coords.latitude, bestLocation.coords.longitude, bestLocation.coords.accuracy ?? undefined);
      // 🟢 ADD THIS LINE directly after the ping succeeds so the UI updates instantly:
      decodeAndSetAddress(bestLocation.coords.latitude, bestLocation.coords.longitude, new Date());
      Alert.alert('📍 Location Updated', 'Your professor can now see your position on the radar.');
    } catch {
      Alert.alert('Error', 'Could not update location. Please try again.');
    } finally {
      setIsPinging(false);
    }
  }

  // ── Mark attendance button state ──────────────────────────────────────────
  type MarkState = { disabled: boolean; label: string; reason: 'none' | 'already_marked' | 'max_attempts'; btnStyle: object };

  function getMarkState(): MarkState {
    if (!nearbySession) return { disabled: false, label: 'Mark Attendance →', reason: 'none', btnStyle: {} };
    if (nearbySession.my_status === 'PRESENT') {
      return { disabled: true, label: '✅ Already Marked', reason: 'already_marked', btnStyle: { backgroundColor: '#16a34a', opacity: 0.82 } };
    }
    if (nearbySession.attempt_count >= 3) {
      return { disabled: true, label: '🚫 Max Attempts Exhausted', reason: 'max_attempts', btnStyle: { backgroundColor: '#dc2626', opacity: 0.82 } };
    }
    return { disabled: false, label: 'Mark Attendance →', reason: 'none', btnStyle: {} };
  }

  function handleMarkPress() {
    if (!nearbySession) return;
    const ms = getMarkState();
    if (ms.reason === 'already_marked') {
      Alert.alert('✅ Already Marked', 'You have already successfully marked your attendance for this session.');
      return;
    }
    if (ms.reason === 'max_attempts') {
      Alert.alert('🚫 Max Attempts Exhausted', 'You have used all 3 verification attempts. Ask your professor for a manual override.');
      return;
    }
    if (!faceEnrolled) {
      Alert.alert(
        'Face Not Enrolled',
        'You must complete face enrollment before marking attendance.',
        [
          { text: 'Enroll Now', onPress: () => router.push('/enroll-face') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    router.push({
      pathname: '/verify',
      params: {
        session_id: nearbySession.session_id,
        course_name: nearbySession.course_name,
        professor_name: nearbySession.professor_name,
        expires_at: nearbySession.expires_at,
        challenges: JSON.stringify(nearbySession.challenges),
      },
    });
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  const isScanning = scanState === 'locating' || scanState === 'checking';

  const scanBtnColor =
    scanState === 'found' ? COLORS.success :
      scanState === 'none' ? COLORS.warning :
        scanState === 'error' ? COLORS.danger : COLORS.primary;

  const scanBtnLabel =
    scanState === 'locating' ? 'Getting location…' :
      scanState === 'checking' ? 'Scanning sessions…' :
        scanState === 'found' ? '✅ Session Found!' :
          scanState === 'none' ? '🔍 No Session Found' :
            scanState === 'error' ? '⚠️ Scan Failed' :
              '🔍 Check Active Session';

  const markState = getMarkState();
  const sessionActive = scanState === 'found' && !!nearbySession && !!chatSocket;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
              <Text style={styles.subGreeting}>{user?.roll_number} • Semester {user?.semester}</Text>
            </View>
          </View>

          {/* Nearby session card */}
          <View style={styles.nearbyCard}>
            <Text style={styles.nearbyTitle}>Missed the notification?</Text>
            <Text style={styles.nearbySubtitle}>
              Accidentally dismissed it or pressed back? Tap below to check if
              there's an active attendance session within 200m of you.
            </Text>

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.scanBtn, { backgroundColor: scanBtnColor }, isScanning && styles.scanBtnDisabled]}
                onPress={checkNearbySession}
                disabled={isScanning}
                activeOpacity={0.85}
              >
                {isScanning && (
                  <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.scanBtnText}>{scanBtnLabel}</Text>
              </TouchableOpacity>
            </Animated.View>

            {scanMessage !== '' && (
              <Text style={[
                styles.scanMessage,
                scanState === 'error' && { color: COLORS.danger },
                scanState === 'none' && { color: COLORS.warning },
              ]}>
                {scanMessage}
              </Text>
            )}

            {/* Manual location ping button */}
            <TouchableOpacity
              style={styles.pingBtn}
              onPress={handlePingLocation}
              disabled={isPinging}
              activeOpacity={0.85}
            >
              {isPinging
                ? <ActivityIndicator color={COLORS.primary} size="small" />
                : <Text style={styles.pingBtnIcon}>📍</Text>
              }
              <View>
                <Text style={styles.pingBtnTitle}>{isPinging ? 'Updating location…' : 'Update My Location'}</Text>
                <Text style={styles.pingBtnSub}>Let your professor see you on radar</Text>
              </View>
            </TouchableOpacity>

            {/* 🟢 NEW: Real-time Last Location Indicator */}
            <View style={styles.locationIndicatorRow}>
              <Text style={styles.locationIndicatorText} numberOfLines={2}>
                {/* what could be best to replace Last? */}
                <Text style={{ fontWeight: '700', color: COLORS.textPrimary }}>Last Location: </Text>
                {lastLocName}
              </Text>
              <Text style={styles.locationIndicatorTime}>
                {lastLocTime ? lastLocTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
              </Text>
            </View>

            {/* Found session card */}
            {scanState === 'found' && nearbySession && (
              <View style={styles.foundCard}>
                <View style={styles.foundCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.foundCourseName} numberOfLines={1}>
                      {nearbySession.course_name}
                    </Text>
                    <Text style={styles.foundMeta}>
                      {nearbySession.course_code} • Prof. {nearbySession.professor_name}
                    </Text>
                    <Text style={styles.foundMeta}>
                      📍 ~{nearbySession.distance_meters < 0
                        ? 'Nearby'
                        : `${Math.round(nearbySession.distance_meters)}m away`}
                    </Text>
                    {nearbySession.attempt_count > 0 && (
                      <Text style={[
                        styles.foundMeta,
                        { color: nearbySession.attempt_count >= 3 ? '#dc2626' : '#d97706' },
                      ]}>
                        🔄 {nearbySession.attempt_count}/3 attempts used
                      </Text>
                    )}
                  </View>
                  <SessionCountdown expiresAt={nearbySession.expires_at} />
                </View>

                <View style={styles.foundBtnRow}>
                  <TouchableOpacity
                    style={[styles.joinBtn, { flex: 1 }, markState.btnStyle]}
                    onPress={handleMarkPress}
                    activeOpacity={markState.disabled ? 0.75 : 0.85}
                  >
                    <Text style={styles.joinBtnText}>{markState.label}</Text>
                  </TouchableOpacity>

                </View>

                {markState.disabled && (
                  <Text style={styles.disabledHint}>
                    {markState.reason === 'already_marked'
                      ? '✅ Attendance successfully recorded for this session.'
                      : "🚫 All 3 attempts used. Ask your professor for a manual override."}
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Face enrollment banner */}
          {!faceEnrolled && (
            <TouchableOpacity
              style={styles.enrollBanner}
              onPress={() => router.push('/enroll-face')}
              activeOpacity={0.85}
            >
              <Text style={styles.enrollBannerIcon}>📷</Text>
              <View style={styles.enrollBannerText}>
                <Text style={styles.enrollBannerTitle}>Complete Face Enrollment</Text>
                <Text style={styles.enrollBannerSub}>Required to mark attendance. Tap to enroll now.</Text>
              </View>
              <Text style={styles.enrollBannerArrow}>›</Text>
            </TouchableOpacity>
          )}

          {/* My Courses */}
          <Text style={styles.sectionTitle}>My Courses</Text>

          {courses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>📚</Text>
              <Text style={styles.emptyText}>No courses enrolled yet</Text>
            </View>
          ) : (
            courses.map(course => (
              <TouchableOpacity
                key={course.course_id}
                activeOpacity={0.85}
                onPress={() => setCalCourse(course)}
              >
                <CourseCard course={course} />
              </TouchableOpacity>
            ))
          )}

          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>

      {calCourse !== null && (
        <CourseCalendarModal
          course={calCourse}
          onClose={() => setCalCourse(null)}
        />
      )}

      {sessionActive && (
        <SessionChat
          sessionId={nearbySession!.session_id}
          socket={chatSocket!}
          courseName={nearbySession!.course_name}
          professorName={nearbySession!.professor_name}
          forceOpen={chatForceOpen}
        />
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SessionCountdown — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function SessionCountdown({ expiresAt }: { expiresAt: string }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const urgent = secondsLeft < 60;

  if (secondsLeft <= 0) return (
    <View style={[styles.timerBadge, { backgroundColor: '#fef2f2' }]}>
      <Text style={[styles.timerText, { color: COLORS.danger }]}>Expired</Text>
    </View>
  );

  return (
    <View style={[styles.timerBadge, urgent && { backgroundColor: '#fff7ed' }]}>
      <Text style={[styles.timerText, urgent && { color: '#c2410c' }]}>
        ⏱ {mins}:{secs.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CourseCard — tap handled by wrapping TouchableOpacity in HomeScreen
// ─────────────────────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  const pct = Number(course.attendance_pct) || 0;
  const color = pct >= 75 ? COLORS.success : pct >= 60 ? COLORS.warning : COLORS.danger;

  return (
    <View style={styles.courseCard}>
      <View style={styles.courseHeader}>
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{course.name}</Text>
          <Text style={styles.courseCode}>
            {course.code}{course.section ? ` • Section ${course.section}` : ''}
          </Text>
          <Text style={styles.courseProfessor}>Prof. {course.professor_name}</Text>
        </View>
        <View style={[styles.pctBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.pctText, { color }]}>{pct}%</Text>
        </View>
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.attended}>{course.attended} / {course.total_sessions} sessions attended</Text>
      <Text style={styles.tapHint}>📅 Tap to view attendance calendar</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar styles
// ─────────────────────────────────────────────────────────────────────────────


const calS = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,8,23,0.60)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    maxHeight: SCREEN_HEIGHT * 0.91,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 24,
    elevation: 30,
  },
  handle: {
    alignSelf: 'center', width: 44, height: 5,
    backgroundColor: '#e2e8f0', borderRadius: 3, marginBottom: 18,
  },
  hero: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: CAL_H_PAD, marginBottom: 16,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5, lineHeight: 26 },
  heroSub: { fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: '500' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
    marginLeft: 10, marginTop: 2,
  },
  closeBtnText: { fontSize: 13, color: '#475569', fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: CAL_H_PAD, marginBottom: 20 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5 },
  statNum: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  statLbl: {
    fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5
  },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: CAL_H_PAD, marginBottom: 12,
  },
  navBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  navArrow: { fontSize: 22, color: '#334155', fontWeight: '700', lineHeight: 26 },
  monthCenter: { alignItems: 'center', flex: 1 },
  monthTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', letterSpacing: -0.3 },
  monthPills: { flexDirection: 'row', gap: 6, marginTop: 5 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, gap: 4,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  // KEY FIX: weekRow uses paddingHorizontal matching grid, each label is exactly CELL_W
  weekRow: { flexDirection: 'row', paddingHorizontal: CAL_H_PAD, marginBottom: 4 },
  weekLbl: {
    width: CELL_W,           // exactly matches cell width — no margin
    textAlign: 'center',
    fontSize: 10, fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // KEY FIX: grid uses paddingHorizontal, cells have NO marginHorizontal
  // vertical spacing done with marginBottom on each cell (not rowGap)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: CAL_H_PAD,
    marginBottom: 16,
  },
  cell: {
    width: CELL_W - 5,
    height: CELL_H - 5,
    marginBottom: 2,         // vertical gap between rows — reliable on all RN versions
    marginHorizontal: 2,
    borderRadius: CELL_R * 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellEmpty: {
    width: CELL_W,
    height: CELL_H,
    marginBottom: 4,
  },
  cellPresent: {
    backgroundColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30, shadowRadius: 5, elevation: 4,
  },
  cellAbsent: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 5, elevation: 4,
  },
  cellToday: { backgroundColor: 'transparent', borderWidth: 2, borderColor: COLORS.primary },
  cellNeutral: { backgroundColor: '#f8fafc' },

  cellTxt: { fontSize: 13, fontWeight: '600' },
  cellTxtFilled: { color: '#ffffff', fontWeight: '700' },
  cellTxtToday: { color: COLORS.primary, fontWeight: '800' },
  cellTxtFuture: { color: '#cbd5e1' },
  cellTxtDefault: { color: '#374151' },
  todayDot: {
    position: 'absolute', bottom: 4,
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },

  loadingBox: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  loadingTxt: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },

  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    paddingHorizontal: CAL_H_PAD, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#f1f5f9', flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4 },
  legendLbl: { fontSize: 11, color: '#64748b', fontWeight: '500' },

  swipeHint: {
    textAlign: 'center', fontSize: 10, color: '#cbd5e1',
    fontWeight: '500', marginTop: 2, letterSpacing: 0.3,
  },
});


// ─────────────────────────────────────────────────────────────────────────────
// Main styles
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1 },

  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg, paddingTop: SPACING.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  subGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  nearbyCard: {
    margin: SPACING.md, backgroundColor: COLORS.white,
    borderRadius: RADIUS.md, padding: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
    borderLeftWidth: 4, borderLeftColor: COLORS.primary,
  },
  nearbyTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  nearbySubtitle: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 12 },

  scanBtn: {
    borderRadius: RADIUS.sm, paddingVertical: 12, paddingHorizontal: SPACING.md,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  scanBtnDisabled: { opacity: 0.8 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scanMessage: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 18 },

  foundCard: {
    marginTop: 12, backgroundColor: '#f0fdf4',
    borderRadius: RADIUS.sm, padding: 12,
    borderWidth: 1, borderColor: '#86efac',
  },
  foundCardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  foundCourseName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  foundMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  timerBadge: {
    backgroundColor: '#f0fdf4', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    alignItems: 'center', justifyContent: 'center', minWidth: 64,
  },
  timerText: { fontSize: 13, fontWeight: '700', color: COLORS.success },

  foundBtnRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },

  joinBtn: {
    backgroundColor: COLORS.success, borderRadius: RADIUS.sm,
    paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  chatInCardBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  chatInCardBtnActive: { backgroundColor: '#4338ca' },
  chatInCardIcon: { fontSize: 16 },
  chatInCardLabel: { color: '#fff', fontSize: 10, fontWeight: '700' },

  disabledHint: {
    fontSize: 11, color: COLORS.textSecondary,
    marginTop: 8, textAlign: 'center', lineHeight: 16, fontStyle: 'italic',
  },

  enrollBanner: {
    backgroundColor: COLORS.warning, margin: SPACING.md,
    borderRadius: RADIUS.md, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center',
  },
  enrollBannerIcon: { fontSize: 28, marginRight: SPACING.sm },
  enrollBannerText: { flex: 1 },
  enrollBannerTitle: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  enrollBannerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 },
  enrollBannerArrow: { color: COLORS.white, fontSize: 24, fontWeight: '300' },

  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: COLORS.textPrimary,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  courseCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm, padding: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  courseHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  courseInfo: { flex: 1, marginRight: SPACING.sm },
  courseName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  courseCode: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  courseProfessor: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  pctBadge: {
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs, justifyContent: 'center',
    alignItems: 'center', minWidth: 56,
  },
  pctText: { fontSize: 18, fontWeight: '800' },
  barBg: {
    height: 4, backgroundColor: COLORS.border,
    borderRadius: RADIUS.full, marginTop: SPACING.sm, overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: RADIUS.full },
  attended: { fontSize: 11, color: COLORS.textMuted, marginTop: SPACING.xs },
  tapHint: { fontSize: 11, color: COLORS.primary, marginTop: 5, fontWeight: '500', opacity: 0.75 },

  emptyCard: {
    backgroundColor: COLORS.white, margin: SPACING.md,
    borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center',
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14 },

  pingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 10, padding: 12, borderRadius: RADIUS.sm,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5, borderColor: '#bbf7d0',
  },
  pingBtnIcon: { fontSize: 22 },
  pingBtnTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  pingBtnSub: { fontSize: 10, color: '#4ade80', marginTop: 1, fontWeight: '500' },

  // 🟢 NEW STYLES
  locationIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  locationIndicatorText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
    marginRight: 10,
    lineHeight: 16,
  },
  locationIndicatorTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
});