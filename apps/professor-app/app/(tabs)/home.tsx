
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { useSessionStore } from '../../src/store/session.store';
import { ProfessorAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

// ─── ADD these imports at the top (merge with existing import block) ───────
import {
Animated, Modal,
  TextInput, Easing, Dimensions,
} from 'react-native';

// ── At top, replace the dimension/radar constants: ──────────────────────────
const { width: SW, height: SH } = Dimensions.get('window');
const RADAR_SIZE = Math.min(SW - 48, 300);
const RADAR_R    = RADAR_SIZE / 2;

const P  = '#2D6A4F';   // deep forest green (matches header)
const PL = '#40916C';   // lighter green (matches button border/outline)
const PA = '#D8F3DC';   // light green tint (matches subtle backgrounds)

interface Course {
  course_id: string;
  name: string;
  code: string;
  section: string;
  semester: number;
  dept_name: string;
  student_count?: number;
}

export default function ProfessorHomeScreen() {
  const { user } = useAuthStore();
  const { activeSession, setActiveSession, clearSession } = useSessionStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [startingFor, setStartingFor] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [checkingActive, setCheckingActive] = useState(true);

  // ── Session config modal state ────────────────────────────────────────────
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configCourse, setConfigCourse] = useState<Course | null>(null);
  const [cfgRadius,   setCfgRadius]   = useState('200');
  const [cfgDuration, setCfgDuration] = useState('60');
  const [cfgCredits,  setCfgCredits]  = useState('1');
  const [isFetching,  setIsFetching]  = useState(false);

  // ── Radar modal state ─────────────────────────────────────────────────────
  const [radarVisible,   setRadarVisible]   = useState(false);
  const [radarStudents,  setRadarStudents]  = useState<any[]>([]);
  const [radarTotal,     setRadarTotal]     = useState(0);
  const [radarInRange,   setRadarInRange]   = useState(0);
  const [profLat,        setProfLat]        = useState(0);
  const [profLng,        setProfLng]        = useState(0);
  const [isStartingFinal, setIsStartingFinal] = useState(false);

 // Radar sweep animation
  const sweepAngle    = useRef(new Animated.Value(0)).current;
  const radarSlide    = useRef(new Animated.Value(SH)).current;
  const configSlide   = useRef(new Animated.Value(SH)).current;
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Selected blip for detail popup
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const blipScales = useRef<Map<string, Animated.Value>>(new Map()).current;

 function getBlipScale(id: string): Animated.Value {
    if (!blipScales.has(id)) {
      const av = new Animated.Value(1);
      blipScales.set(id, av);
    }
    return blipScales.get(id)!;
  }

  // Start blinking animation for a blip
  function startBlinking(id: string) {
    const av = getBlipScale(id);
    Animated.loop(
      Animated.sequence([
        Animated.timing(av, { toValue: 1.6, duration: 500, useNativeDriver: true }),
        Animated.timing(av, { toValue: 0.7, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }

  useEffect(() => {
    if (radarVisible) {
      // Start sweep
      Animated.loop(
        Animated.timing(sweepAngle, {
          toValue: 1, duration: 3000,
          easing: Easing.linear, useNativeDriver: true,
        })
      ).start();

      // Start blinking for all blips
      radarStudents.forEach(s => {
        if (s.distance_meters != null) startBlinking(s.student_id);
      });

      // Continuous rescan every 10s
      scanIntervalRef.current = setInterval(() => {
        rescanStudents();
      }, 10000);

      return () => {
        sweepAngle.setValue(0);
        if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      };
    }
  }, [radarVisible, radarStudents.length]);

  async function rescanStudents() {
    if (!configCourse || profLat === 0) return;
    try {
      const res = await ProfessorAPI.previewStudentsInRange({
        course_id: configCourse.course_id,
        lat: profLat,
        lng: profLng,
        radius_meters: parseInt(cfgRadius) || 200,
      });
      const { students, in_range } = res.data.data;
      setRadarStudents(students);
      setRadarInRange(in_range);
      // Start blinking for newly appeared students
      students.forEach((s: any) => {
        if (s.distance_meters != null) startBlinking(s.student_id);
      });
    } catch { /* silent rescan fail */ }
  }


  // ── Load courses + check active session ──────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [coursesRes, activeRes] = await Promise.all([
        ProfessorAPI.getCourses(),
        ProfessorAPI.getActiveSession(),
      ]);

      setCourses(coursesRes.data.data || []);

      const session = activeRes.data.data;
      if (session) {
        setActiveSession({
          session_id: session.session_id,
          course_id: session.course_id,
          course_name: session.course_name,
          started_at: session.started_at,
          expires_at: session.expires_at,
          students_notified: 0,
          challenges: session.challenges || [],
        });
      } else {
        clearSession();
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setCheckingActive(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ── Start session ─────────────────────────────────────────────────────────
  // async function handleStartSession(course: Course) {
  //   if (activeSession) {
  //     Alert.alert(
  //       'Session Active',
  //       'You already have an active session. Please end it before starting a new one.',
  //       [
  //         { text: 'Cancel', style: 'cancel' },
  //         { text: 'View Dashboard', onPress: () => router.push(`/dashboard/${activeSession.session_id}`) },
  //       ]
  //     );
  //     return;
  //   }
  //   Alert.alert(
  //     'Start Attendance',
  //     `Start attendance for:\n${course.name}${course.section ? ` (${course.section})` : ''}?\n\nMake sure you are inside the classroom.`,
  //     [
  //       { text: 'Cancel', style: 'cancel' },
  //       { text: 'Start', onPress: () => startSession(course) },
  //     ]
  //   );
  // }
  // ── REPLACE handleStartSession ────────────────────────────────────────────
  async function handleStartSession(course: Course) {
    if (activeSession) {
      Alert.alert(
        'Session Active',
        'You already have an active session. End it before starting a new one.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Dashboard', onPress: () => router.push(`/dashboard/${activeSession.session_id}`) },
        ]
      );
      return;
    }
    // Open config modal
    setConfigCourse(course);
    setCfgRadius('200');
    setCfgDuration('60');
    setCfgCredits('1');
    setConfigModalVisible(true);
    Animated.spring(configSlide, {
      toValue: 0, useNativeDriver: true, damping: 22, stiffness: 160,
    }).start();
  }

  function closeConfigModal() {
    Animated.timing(configSlide, {
      toValue: SH, duration: 240, useNativeDriver: true,
    }).start(() => setConfigModalVisible(false));
  }

  // ── Fetch students → show radar ───────────────────────────────────────────
  async function handleFetchStudents() {
    if (!configCourse) return;
    const radius = parseInt(cfgRadius) || 200;
    if (radius < 50 || radius > 500) {
      Alert.alert('Invalid Radius', 'Radius must be between 50 and 500 meters.');
      return;
    }

    setIsFetching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Grant location permission first.');
        return;
      }

      let best: any = null;
      for (let i = 0; i < 3; i++) {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          const acc = loc.coords.accuracy ?? 999;
          if (!best || acc < (best.coords.accuracy ?? 999)) best = loc;
          if (acc <= 40) break;
          await new Promise(r => setTimeout(r, 1200));
        } catch { break; }
      }

      if (!best) {
        Alert.alert('GPS Error', 'Could not get location. Try again.');
        return;
      }

      const { latitude, longitude } = best.coords;
      setProfLat(latitude);
      setProfLng(longitude);

      const res = await ProfessorAPI.previewStudentsInRange({
        course_id: configCourse.course_id,
        lat: latitude,
        lng: longitude,
        radius_meters: radius,
      });

      const { students, total_enrolled, in_range } = res.data.data;
      setRadarStudents(students);
      setRadarTotal(total_enrolled);
      setRadarInRange(in_range);

      // Transition: close config, open radar
      Animated.timing(configSlide, {
        toValue: SH, duration: 200, useNativeDriver: true,
      }).start(() => {
        setConfigModalVisible(false);
        setRadarVisible(true);
        Animated.spring(radarSlide, {
          toValue: 0, useNativeDriver: true, damping: 20, stiffness: 140,
        }).start();
      });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to fetch students.');
    } finally {
      setIsFetching(false);
    }
  }


   // ── Final: confirm & start session from radar screen ─────────────────────
  async function handleConfirmStart() {
    if (!configCourse) return;
    setIsStartingFinal(true);
    try {
      const res = await ProfessorAPI.startSession({
        course_id: configCourse.course_id,
        lat: profLat,
        lng: profLng,
        radius_meters: parseInt(cfgRadius) || 200,
        class_duration_minutes: parseInt(cfgDuration) || 60,
      });
      const data = res.data.data;
      setActiveSession({
        session_id: data.session_id,
        course_id: configCourse.course_id,
        course_name: configCourse.name,
        started_at: data.started_at,
        expires_at: data.expires_at,
        students_notified: data.students_notified,
        challenges: data.challenges,
      });
      // Close radar
      Animated.timing(radarSlide, {
        toValue: SH, duration: 250, useNativeDriver: true,
      }).start(() => setRadarVisible(false));

      Alert.alert(
        '✅ Session Live',
        `${data.students_notified} students notified.`,
        [{ text: 'Open Dashboard', onPress: () => router.push(`/dashboard/${data.session_id}`) }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start session.');
    } finally {
      setIsStartingFinal(false);
    }
  }

  function closeRadarModal() {
    Animated.timing(radarSlide, {
      toValue: SH, duration: 240, useNativeDriver: true,
    }).start(() => setRadarVisible(false));
  }

  async function startSession(course: Course) {
    setStartingFor(course.course_id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Location permission is needed to set the classroom geofence.');
        return;
      }
      // const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      // const { latitude, longitude } = location.coords;

      // ── NEW: High Accuracy GPS Lock Loop for Professor ──
      let bestLocation = null;
      for (let i = 0; i < 3; i++) {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          const acc = loc.coords.accuracy ?? 999;

          if (!bestLocation || acc < (bestLocation.coords.accuracy ?? 999)) {
            bestLocation = loc;
          }
          if (acc <= 40) break; // Perfect lock achieved

          await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for satellites
        } catch (e) {
          break;
        }
      }

      if (!bestLocation) {
        Alert.alert('GPS Error', 'Could not get a precise location. Step near a window and try again.');
        setStartingFor(null);
        return;
      }

      const { latitude, longitude } = bestLocation.coords;

      const res = await ProfessorAPI.startSession({ course_id: course.course_id, lat: latitude, lng: longitude, radius_meters: 200 });
      const data = res.data.data;

      setActiveSession({
        session_id: data.session_id,
        course_id: course.course_id,
        course_name: course.name,
        started_at: data.started_at,
        expires_at: data.expires_at,
        students_notified: data.students_notified,
        challenges: data.challenges,
      });

      Alert.alert(
        '✅ Session Started',
        `${data.students_notified} students notified.\n${data.students_in_range} in range, ${data.students_stale_location} with stale location.`,
        [{ text: 'Open Dashboard', onPress: () => router.push(`/dashboard/${data.session_id}`) }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start session.');
    } finally {
      setStartingFor(null);
    }
  }

  // ── End session ───────────────────────────────────────────────────────────
  async function handleEndSession() {
    if (!activeSession) return;
    Alert.alert(
      'End Session',
      'Are you sure? Remaining students will be marked absent.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: endSession },
      ]
    );
  }

  async function endSession() {
    if (!activeSession) return;
    setEndingSession(true);
    try {
      const res = await ProfessorAPI.endSession(activeSession.session_id);
      const stats = res.data.data.stats;
      clearSession();
      Alert.alert('📊 Session Ended', `Present: ${stats.present}\nAbsent: ${stats.absent}\nManual: ${stats.manual_override}\nTotal: ${stats.total}`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to end session.');
    } finally {
      setEndingSession(false);
    }
  }

  if (checkingActive) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Hello, Prof. {user?.name?.split(' ')[0]} 👋</Text>
            <Text style={styles.subGreeting}>{user?.employee_code}</Text>
          </View>
          {/* Manage Courses button */}
          <TouchableOpacity
            style={styles.manageCoursesBtn}
            onPress={() => router.push('/assign-courses')}
          >
            <Text style={styles.manageCoursesBtnText}>⚙ Courses</Text>
          </TouchableOpacity>
        </View>

        {/* ── ACTIVE SESSION BANNER ── */}
        {activeSession && (
          <View style={styles.activeBanner}>
            <View style={styles.activeDot} />
            <View style={styles.activeInfo}>
              <Text style={styles.activeTitle}>🔴 Live Session</Text>
              <Text style={styles.activeCourse}>{activeSession.course_name}</Text>
              <Text style={styles.activeTime}>Started {new Date(activeSession.started_at).toLocaleTimeString()}</Text>
            </View>
            <View style={styles.activeBtns}>
              <TouchableOpacity style={styles.viewDashBtn} onPress={() => router.push(`/dashboard/${activeSession.session_id}`)}>
                <Text style={styles.viewDashBtnText}>Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.endBtn} onPress={handleEndSession} disabled={endingSession}>
                {endingSession
                  ? <ActivityIndicator size="small" color={COLORS.white} />
                  : <Text style={styles.endBtnText}>End</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── COURSES ── */}
        <Text style={styles.sectionTitle}>My Courses</Text>
        <Text style={styles.sectionSubtitle}>Tap a course to start attendance</Text>

        {courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyText}>No courses assigned yet.</Text>
            <TouchableOpacity style={styles.assignBtn} onPress={() => router.push('/assign-courses')}>
              <Text style={styles.assignBtnText}>⚙ Assign Yourself a Course</Text>
            </TouchableOpacity>
          </View>
        ) : (
          courses.map((course) => (
            <CourseCard
              key={course.course_id}
              course={course}
              isActive={activeSession?.course_id === course.course_id}
              loading={startingFor === course.course_id}
              onPress={() => handleStartSession(course)}
              onDashboard={
                activeSession?.course_id === course.course_id
                  ? () => router.push(`/dashboard/${activeSession.session_id}`)
                  : undefined
              }
              onManageStudents={() =>
                router.push({
                  pathname: '/manage-students/[courseId]',
                  params: {
                    courseId: course.course_id,
                    courseName: `${course.name}${course.section ? ` (${course.section})` : ''}`,
                  },
                })
              }
            />
          ))
        )}
      </ScrollView>
       {/* ════════════════════════════════════════════
          SESSION CONFIG MODAL
      ════════════════════════════════════════════ */}
      {configModalVisible && (
        <Modal visible transparent animationType="none" statusBarTranslucent>
          <View style={ms.backdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeConfigModal} />
            <Animated.View style={[ms.sheet, { transform: [{ translateY: configSlide }] }]}>
              <View style={ms.handle} />

              {/* Header */}
              <View style={ms.sheetHeader}>
                <View style={ms.sheetIconWrap}>
                  <Text style={ms.sheetIcon}>📡</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.sheetTitle}>Start Attendance Session</Text>
                  <Text style={ms.sheetCourse} numberOfLines={1}>
                    {configCourse?.name}{configCourse?.section ? ` · ${configCourse.section}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeConfigModal} style={ms.sheetClose}>
                  <Text style={ms.sheetCloseText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Radius field */}
              <View style={ms.fieldBlock}>
                <View style={ms.fieldLabelRow}>
                  <Text style={ms.fieldLabel}>Geofence Radius</Text>
                  <View style={ms.fieldBadge}>
                    <Text style={ms.fieldBadgeTxt}>{cfgRadius}m</Text>
                  </View>
                </View>
                <View style={ms.inputRow}>
                  <TouchableOpacity style={ms.stepper}
                    onPress={() => setCfgRadius(r => String(Math.max(50, parseInt(r||'200') - 25)))}>
                    <Text style={ms.stepperTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={ms.input}
                    value={cfgRadius}
                    onChangeText={setCfgRadius}
                    keyboardType="numeric"
                    selectionColor={P}
                  />
                  <TouchableOpacity style={ms.stepper}
                    onPress={() => setCfgRadius(r => String(Math.min(500, parseInt(r||'200') + 25)))}>
                    <Text style={ms.stepperTxt}>+</Text>
                  </TouchableOpacity>
                </View>
                {/* Visual slider track */}
                <View style={ms.sliderTrack}>
                  <View style={[ms.sliderFill,
                    { width: `${Math.max(2, ((parseInt(cfgRadius)||200) - 50) / 450 * 100)}%` as any }]} />
                  <View style={[ms.sliderThumb,
                    { left: `${Math.max(0, ((parseInt(cfgRadius)||200) - 50) / 450 * 100 - 1.5)}%` as any }]} />
                </View>
                <View style={ms.fieldHintRow}>
                  <Text style={ms.fieldHint}>50m tight</Text>
                  <Text style={ms.fieldHint}>200m standard</Text>
                  <Text style={ms.fieldHint}>500m wide</Text>
                </View>
              </View>

              {/* Duration field */}
              <View style={ms.fieldBlock}>
                <View style={ms.fieldLabelRow}>
                  <Text style={ms.fieldLabel}>Class Duration</Text>
                  <View style={ms.fieldBadge}>
                    <Text style={ms.fieldBadgeTxt}>
                      {cfgDuration}min · {parseInt(cfgDuration) > 75 ? '2 credits' : '1 credit'}
                    </Text>
                  </View>
                </View>
                <View style={ms.inputRow}>
                  <TouchableOpacity style={ms.stepper}
                    onPress={() => setCfgDuration(d => String(Math.max(30, parseInt(d||'60') - 15)))}>
                    <Text style={ms.stepperTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={ms.input}
                    value={cfgDuration}
                    onChangeText={setCfgDuration}
                    keyboardType="numeric"
                    selectionColor={P}
                  />
                  <TouchableOpacity style={ms.stepper}
                    onPress={() => setCfgDuration(d => String(Math.min(300, parseInt(d||'60') + 15)))}>
                    <Text style={ms.stepperTxt}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[ms.fieldHint, { textAlign: 'center', marginTop: 6 }]}>
                  Sessions &gt;75 min automatically award 2 attendance credits
                </Text>
              </View>

              <TouchableOpacity
                style={[ms.primaryBtn, isFetching && { opacity: 0.7 }]}
                onPress={handleFetchStudents}
                disabled={isFetching}
                activeOpacity={0.85}
              >
                {isFetching
                  ? <><ActivityIndicator color="#fff" size="small" /><Text style={[ms.primaryBtnTxt, { marginLeft: 8 }]}>Getting Location…</Text></>
                  : <Text style={ms.primaryBtnTxt}>Scan Students →</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={closeConfigModal} style={ms.ghostBtn}>
                <Text style={ms.ghostBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* ════════════════════════════════════════════
          RADAR MODAL
      ════════════════════════════════════════════ */}
      {radarVisible && (
        <Modal visible transparent animationType="none" statusBarTranslucent>
          <Animated.View style={[ms.radarBg, { transform: [{ translateY: radarSlide }] }]}>

            {/* Top bar */}
            <View style={ms.radarTopBar}>
              <TouchableOpacity onPress={closeRadarModal} style={ms.radarBackBtn}>
                <Text style={ms.radarBackTxt}>‹</Text>
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={ms.radarTopLabel}>ATTENDANCE RADAR</Text>
                <Text style={ms.radarTopCourse} numberOfLines={1}>{configCourse?.name}</Text>
              </View>
              <View style={ms.radarStatChip}>
                <View style={ms.radarStatDot} />
                <Text style={ms.radarStatTxt}>{radarInRange}/{radarTotal} in range</Text>
              </View>
            </View>

            {/* RADAR */}
            <View style={ms.radarWrap}>
              {/* Green scan tint background */}
              <View style={ms.radarScreen} />

              {/* Rings */}
              {[0.25, 0.5, 0.75, 1.0].map(r => (
                <View key={r} style={[ms.radarRing, {
                  width: RADAR_SIZE * r, height: RADAR_SIZE * r,
                  borderRadius: (RADAR_SIZE * r) / 2,
                  left: RADAR_R - (RADAR_SIZE * r) / 2,
                  top:  RADAR_R - (RADAR_SIZE * r) / 2,
                  borderColor: r === 1.0
                    ? 'rgba(27,58,92,0.6)'
                    : 'rgba(27,58,92,0.25)',
                }]} />
              ))}

              {/* Crosshairs */}
              <View style={ms.crossH} />
              <View style={ms.crossV} />

              {/* Degree ticks at 0/90/180/270 */}
              {['N','E','S','W'].map((dir, i) => {
                const angle = i * 90 * Math.PI / 180;
                const tx = RADAR_R + Math.sin(angle) * (RADAR_R - 10);
                const ty = RADAR_R - Math.cos(angle) * (RADAR_R - 10);
                return (
                  <Text key={dir} style={[ms.compassLbl, { left: tx - 6, top: ty - 8 }]}>
                    {dir}
                  </Text>
                );
              })}

              {/* Sweep */}
              <Animated.View style={[ms.sweepContainer, {
                transform: [{
                  rotate: sweepAngle.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })
                }]
              }]}>
                {/* Trailing glow wedge */}
                <View style={ms.sweepTrail3} />
                <View style={ms.sweepTrail2} />
                <View style={ms.sweepTrail1} />
                {/* Main sweep line */}
                <View style={ms.sweepLine} />
              </Animated.View>

              {/* Center — professor */}
              <View style={ms.profDot}>
                <View style={ms.profDotCore} />
                <View style={ms.profDotRing} />
              </View>
              <Text style={ms.profLabel}>YOU</Text>

              {/* Student blips */}
              {radarStudents.map((student) => {
                if (student.distance_meters == null || student.bearing_degrees == null) return null;

                const maxDist   = parseInt(cfgRadius) || 200;
                const distPct   = Math.min(student.distance_meters / maxDist, 0.93);
                const bearingRad = (student.bearing_degrees * Math.PI) / 180;
                const px = RADAR_R + Math.sin(bearingRad) * distPct * RADAR_R;
                const py = RADAR_R - Math.cos(bearingRad) * distPct * RADAR_R;

                const isInRange = student.location_status === 'IN_RANGE';
                const isStale   = student.location_status === 'STALE';
                const blipColor = isInRange ? '#22c55e' : isStale ? '#f59e0b' : '#94a3b8';
                const scale     = getBlipScale(student.student_id);
                const isSelected = selectedStudent?.student_id === student.student_id;

                return (
                  <TouchableOpacity
                    key={student.student_id}
                    onPress={() => setSelectedStudent(isSelected ? null : student)}
                    style={[ms.blipTouch, { left: px - 14, top: py - 14 }]}
                    activeOpacity={0.7}
                  >
                    {/* Outer pulse ring */}
                    <Animated.View style={[ms.blipRingOuter, {
                      borderColor: blipColor,
                      transform: [{ scale }],
                      opacity: isSelected ? 1 : 0.5,
                    }]} />
                    {/* Core dot */}
                    <View style={[ms.blipCore, {
                      backgroundColor: blipColor,
                      shadowColor: blipColor,
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: '#fff',
                    }]} />
                    {/* Roll number label */}
                    <Text style={[ms.blipRoll, { color: blipColor }]} numberOfLines={1}>
                      {/*student.roll_number*/}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Range ring label */}
              <Text style={ms.rangeLbl}>{parseInt(cfgRadius)||200}m</Text>

              {/* Rescan indicator */}
              <View style={ms.rescanBadge}>
                <View style={ms.rescanDot} />
                <Text style={ms.rescanTxt}>LIVE · updates every 10s</Text>
              </View>
            </View>

            {/* Selected student detail card */}
            {selectedStudent && (
              <View style={ms.detailCard}>
                <View style={ms.detailCardHeader}>
                  <View style={[ms.detailStatusDot, {
                    backgroundColor:
                      selectedStudent.location_status === 'IN_RANGE' ? '#22c55e'
                      : selectedStudent.location_status === 'STALE'   ? '#f59e0b'
                      : '#94a3b8'
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={ms.detailName}>{selectedStudent.name}</Text>
                    <Text style={ms.detailRoll}>{selectedStudent.roll_number}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedStudent(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={ms.detailClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={ms.detailRow}>
                  <View style={ms.detailCell}>
                    <Text style={ms.detailCellLabel}>DISTANCE</Text>
                    <Text style={ms.detailCellValue}>{selectedStudent.distance_meters ?? '—'}m</Text>
                  </View>
                  <View style={ms.detailCell}>
                    <Text style={ms.detailCellLabel}>BEARING</Text>
                    <Text style={ms.detailCellValue}>
                      {selectedStudent.bearing_degrees != null
                        ? `${Math.round(selectedStudent.bearing_degrees)}°`
                        : '—'}
                    </Text>
                  </View>
                  <View style={ms.detailCell}>
                    <Text style={ms.detailCellLabel}>STATUS</Text>
                    <Text style={[ms.detailCellValue, {
                      color: selectedStudent.location_status === 'IN_RANGE' ? '#22c55e'
                           : selectedStudent.location_status === 'STALE'   ? '#f59e0b'
                           : '#94a3b8'
                    }]}>
                      {selectedStudent.location_status === 'IN_RANGE' ? 'IN RANGE'
                       : selectedStudent.location_status === 'STALE'   ? 'STALE GPS'
                       : 'NO GPS'}
                    </Text>
                  </View>
                  <View style={ms.detailCell}>
                    <Text style={ms.detailCellLabel}>FACE ID</Text>
                    <Text style={[ms.detailCellValue, { color: selectedStudent.face_enrolled ? '#22c55e' : '#ef4444' }]}>
                      {selectedStudent.face_enrolled ? '✓ YES' : '✗ NO'}
                    </Text>
                  </View>
                </View>
                {selectedStudent.student_lat != null && (
                  <Text style={ms.detailCoords}>
                    {Number(selectedStudent.student_lat).toFixed(5)}, {Number(selectedStudent.student_lng).toFixed(5)}
                  </Text>
                )}
              </View>
            )}

            {/* Student list (compact, scrollable) */}
            {!selectedStudent && (
              <ScrollView style={ms.studentList} showsVerticalScrollIndicator={false}>
                <View style={ms.studentListHeader}>
                  <Text style={ms.studentListHeaderTxt}>ENROLLED STUDENTS ({radarTotal})</Text>
                </View>
                {radarStudents.map(s => (
                  <TouchableOpacity
                    key={s.student_id}
                    style={ms.studentRow}
                    onPress={() => setSelectedStudent(s)}
                    activeOpacity={0.7}
                  >
                    <View style={[ms.studentStatusDot, {
                      backgroundColor:
                        s.location_status === 'IN_RANGE' ? '#22c55e'
                        : s.location_status === 'STALE'  ? '#f59e0b'
                        : '#94a3b8'
                    }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={ms.studentName}>{s.name}</Text>
                      <Text style={ms.studentRoll}>{s.roll_number}</Text>
                    </View>
                    <Text style={ms.studentDist}>
                      {s.distance_meters != null ? `${s.distance_meters}m` : 'No GPS'}
                    </Text>
                    <Text style={ms.studentChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Bottom actions */}
            <View style={ms.radarActions}>
              <TouchableOpacity style={ms.radarCancelBtn} onPress={closeRadarModal}>
                <Text style={ms.radarCancelTxt}>Abort</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[ms.radarStartBtn, isStartingFinal && { opacity: 0.7 }]}
                onPress={handleConfirmStart}
                disabled={isStartingFinal}
              >
                {isStartingFinal
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={ms.radarStartTxt}>▶ Deploy Session</Text>
                }
              </TouchableOpacity>
            </View>

          </Animated.View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function CourseCard({ course, isActive, loading, onPress, onDashboard, onManageStudents }: {
  course: Course; isActive: boolean; loading: boolean;
  onPress: () => void; onDashboard?: () => void; onManageStudents: () => void;
}) {
  return (
    <View style={[styles.courseCard, isActive && styles.courseCardActive]}>
      <View style={styles.courseInfo}>
        <Text style={styles.courseName}>{course.name}</Text>
        <Text style={styles.courseCode}>
          {course.code}{course.section ? ` · ${course.section}` : ''} · Sem {course.semester}
        </Text>
        <Text style={styles.courseDept}>{course.dept_name}</Text>
        {(course.student_count ?? 0) > 0 && (
          <Text style={styles.courseStudentCount}>👥 {course.student_count} students</Text>
        )}
      </View>
      <View style={styles.courseActions}>
        {isActive && onDashboard ? (
          <>
            <View style={styles.liveTag}><Text style={styles.liveTagText}>LIVE</Text></View>
            <TouchableOpacity style={styles.dashBtn} onPress={onDashboard}>
              <Text style={styles.dashBtnText}>View →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={[styles.startBtn, loading && styles.startBtnDisabled]} onPress={onPress} disabled={loading}>
            {loading
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={styles.startBtnText}>▶ Start</Text>
            }
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.studentsBtn} onPress={onManageStudents}>
          <Text style={styles.studentsBtnText}>👥 Students</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary, padding: SPACING.lg,
    paddingTop: SPACING.md, flexDirection: 'row', alignItems: 'center',
  },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  subGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  manageCoursesBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 7,
  },
  manageCoursesBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  activeBanner: {
    backgroundColor: '#FFF0F0', borderLeftWidth: 4, borderLeftColor: COLORS.danger,
    margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.md,
    flexDirection: 'row', alignItems: 'center',
  },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger, marginRight: SPACING.sm },
  activeInfo: { flex: 1 },
  activeTitle: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
  activeCourse: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginTop: 2 },
  activeTime: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  activeBtns: { gap: SPACING.xs },
  viewDashBtn: { backgroundColor: COLORS.accent, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, alignItems: 'center' },
  viewDashBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  endBtn: { backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, alignItems: 'center' },
  endBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, paddingHorizontal: SPACING.md, paddingTop: SPACING.md },
  sectionSubtitle: { fontSize: 13, color: COLORS.textSecondary, paddingHorizontal: SPACING.md, marginBottom: SPACING.sm },

  courseCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
    padding: SPACING.md, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  courseCardActive: { borderWidth: 2, borderColor: COLORS.danger },
  courseInfo: { flex: 1, marginRight: SPACING.sm },
  courseName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  courseCode: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  courseDept: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  courseStudentCount: { fontSize: 11, color: COLORS.primary, marginTop: 3, fontWeight: '600' },
  courseActions: { alignItems: 'flex-end', gap: SPACING.xs },
  liveTag: { backgroundColor: COLORS.danger, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  liveTagText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  dashBtn: { borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4 },
  dashBtnText: { color: COLORS.accent, fontSize: 12, fontWeight: '700' },
  startBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  startBtnDisabled: { opacity: 0.6 },
  startBtnText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  studentsBtn: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 4, marginTop: 2, alignItems: 'center' },
  studentsBtnText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },

  emptyCard: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: RADIUS.md, padding: SPACING.xl, alignItems: 'center' },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14, textAlign: 'center' },
  assignBtn: { marginTop: SPACING.md, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm },
  assignBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  // ── Config modal ────────────────────────────────────────────────────────────
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 20, elevation: 24,
  },
  handle: {
    alignSelf: 'center', width: 40, height: 4,
    backgroundColor: '#e2e8f0', borderRadius: 2, marginVertical: 14,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24,
  },
  sheetIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: PA, alignItems: 'center', justifyContent: 'center',
  },
  sheetIcon: { fontSize: 22 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  sheetCourse: { fontSize: 12, color: '#64748b', marginTop: 2 },
  sheetClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  sheetCloseText: { fontSize: 12, color: '#475569', fontWeight: '700' },

  fieldBlock: { marginBottom: 22 },
  fieldLabelRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#374151', letterSpacing: 0.3 },
  fieldBadge: {
    backgroundColor: PA, borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  fieldBadgeTxt: { fontSize: 11, fontWeight: '700', color: P },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: PA, borderWidth: 1.5, borderColor: PL,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperTxt: { color: P, fontSize: 20, fontWeight: '700', lineHeight: 24 },
  input: {
    flex: 1, height: 48,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 10, textAlign: 'center',
    color: '#0f172a', fontSize: 24, fontWeight: '800',
  },
  sliderTrack: {
    height: 6, backgroundColor: '#e2e8f0',
    borderRadius: 3, marginTop: 12, overflow: 'visible',
    position: 'relative',
  },
  sliderFill: {
    height: 6, backgroundColor: P,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute', top: -5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: P,
    shadowColor: P, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 4,
  },
  fieldHintRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 6,
  },
  fieldHint: { fontSize: 10, color: '#94a3b8' },

  primaryBtn: {
    backgroundColor: P, borderRadius: 12,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  primaryBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  ghostBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  ghostBtnTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  // ── Radar modal ─────────────────────────────────────────────────────────────
  radarBg: {
    flex: 1, backgroundColor: '#f0f4f9',
  },
  radarTopBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e8f0f8',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  radarBackBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: PA, alignItems: 'center', justifyContent: 'center',
  },
  radarBackTxt: { fontSize: 22, color: P, fontWeight: '700', lineHeight: 26 },
  radarTopLabel: { fontSize: 9, letterSpacing: 2, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
  radarTopCourse: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 1 },
  radarStatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 99,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
  },
  radarStatDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  radarStatTxt: { fontSize: 11, fontWeight: '700', color: '#15803d' },

  // Radar display
  radarWrap: {
    width: RADAR_SIZE, height: RADAR_SIZE,
    alignSelf: 'center', marginVertical: 10,
    borderRadius: RADAR_R,
    overflow: 'hidden',
  },
  radarScreen: {
    position: 'absolute', top: 0, left: 0,
    width: RADAR_SIZE, height: RADAR_SIZE,
    borderRadius: RADAR_R,
    backgroundColor: '#0a1628',
    borderWidth: 2, borderColor: P,
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  crossH: {
    position: 'absolute', top: RADAR_R - 0.5,
    left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(45,90,142,0.3)',
  },
  crossV: {
    position: 'absolute', left: RADAR_R - 0.5,
    top: 0, bottom: 0, width: 1,
    backgroundColor: 'rgba(45,90,142,0.3)',
  },
  compassLbl: {
    position: 'absolute',
    fontSize: 8, fontWeight: '800',
    color: 'rgba(45,90,142,0.7)',
  },

  // Sweep
  sweepContainer: {
    position: 'absolute',
    width: RADAR_SIZE, height: RADAR_SIZE,
    top: 0, left: 0,
  },
  sweepLine: {
    position: 'absolute',
    width: 2, height: RADAR_R,
    left: RADAR_R - 1, top: 0,
    backgroundColor: 'rgba(34,197,94,0.9)',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 6,
  },
  sweepTrail1: {
    position: 'absolute',
    width: RADAR_R, height: RADAR_R,
    left: 0, top: 0,
    borderRadius: RADAR_R,
    backgroundColor: 'rgba(34,197,94,0.08)',
    transform: [{ rotate: '-30deg' }, { translateX: RADAR_R / 2 }],
  },
  sweepTrail2: {
    position: 'absolute',
    width: RADAR_R * 0.8, height: RADAR_R,
    left: 0, top: 0,
    borderRadius: RADAR_R,
    backgroundColor: 'rgba(34,197,94,0.05)',
    transform: [{ rotate: '-50deg' }, { translateX: RADAR_R * 0.4 }],
  },
  sweepTrail3: {
    position: 'absolute',
    width: RADAR_R * 0.6, height: RADAR_R,
    left: 0, top: 0,
    borderRadius: RADAR_R,
    backgroundColor: 'rgba(34,197,94,0.03)',
    transform: [{ rotate: '-70deg' }, { translateX: RADAR_R * 0.3 }],
  },

  // Professor center
  profDot: {
    position: 'absolute',
    width: 20, height: 20,
    left: RADAR_R - 10, top: RADAR_R - 10,
    alignItems: 'center', justifyContent: 'center',
  },
  profDotCore: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#60a5fa',
    shadowColor: '#60a5fa', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 6,
  },
  profDotRing: {
    position: 'absolute',
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: 'rgba(96,165,250,0.5)',
  },
  profLabel: {
    position: 'absolute',
    left: RADAR_R + 10, top: RADAR_R - 7,
    fontSize: 7, fontWeight: '800',
    color: 'rgba(96,165,250,0.7)', letterSpacing: 1,
  },

  // Blip
  blipTouch: {
    position: 'absolute',
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  blipRingOuter: {
    position: 'absolute',
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
  },
  blipCore: {
    width: 8, height: 8, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 5, elevation: 5,
  },
  blipRoll: {
    position: 'absolute', top: 16, left: -16,
    width: 60, textAlign: 'center',
    fontSize: 7, fontWeight: '800', letterSpacing: 0.3,
  },

  rangeLbl: {
    position: 'absolute', top: 6, right: RADAR_R + 4,
    fontSize: 8, color: 'rgba(45,90,142,0.5)',
  },
  rescanBadge: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  rescanDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#22c55e' },
  rescanTxt: { fontSize: 8, color: 'rgba(34,197,94,0.7)', fontWeight: '600', letterSpacing: 0.5 },

  // Selected student detail card
  detailCard: {
    marginHorizontal: 16, marginVertical: 8,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 14,
    borderWidth: 1.5, borderColor: PA,
    shadowColor: P, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 4,
  },
  detailCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
  },
  detailStatusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  detailName: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  detailRoll: { fontSize: 11, color: '#64748b', marginTop: 1 },
  detailClose: { fontSize: 16, color: '#94a3b8', fontWeight: '700', padding: 4 },
  detailRow: { flexDirection: 'row', gap: 8 },
  detailCell: {
    flex: 1, backgroundColor: '#f8fafc', borderRadius: 10,
    padding: 8, alignItems: 'center',
  },
  detailCellLabel: { fontSize: 8, fontWeight: '700', color: '#94a3b8', letterSpacing: 1, marginBottom: 3 },
  detailCellValue: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  detailCoords: {
    marginTop: 8, textAlign: 'center',
    fontSize: 10, color: '#94a3b8', fontFamily: 'monospace',
  },

  // Student list
  studentList: { flex: 1, paddingHorizontal: 12 },
  studentListHeader: {
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#e8f0f8',
  },
  studentListHeaderTxt: {
    fontSize: 9, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5,
  },
  studentRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10,
  },
  studentStatusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  studentName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  studentRoll: { fontSize: 10, color: '#64748b', marginTop: 1 },
  studentDist: { fontSize: 11, fontWeight: '700', color: P, minWidth: 50, textAlign: 'right' },
  studentChevron: { fontSize: 16, color: '#cbd5e1', marginLeft: 2 },

  radarActions: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, paddingBottom: 36,
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#e8f0f8',
  },
  radarCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0', alignItems: 'center',
  },
  radarCancelTxt: { color: '#64748b', fontSize: 14, fontWeight: '700' },
  radarStartBtn: {
    flex: 2.5, paddingVertical: 13, borderRadius: 12,
    backgroundColor: P, alignItems: 'center',
    shadowColor: P, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  radarStartTxt: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
});