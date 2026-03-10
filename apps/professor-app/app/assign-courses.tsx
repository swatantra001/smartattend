// D:\smartattend\apps\professor-app\app\assign-courses.tsx
// NEW FILE — Professor browses all college courses and self-assigns

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ProfessorAPI } from '../src/services/api';
import { COLORS, SPACING, RADIUS } from '../src/constants';

interface Course {
  course_id:         string;
  name:              string;
  code:              string;
  section:           string | null;
  semester:          number;
  dept_name:         string;
  is_mine:           boolean;
  my_student_count:  number;
  total_student_count: number;
}

export default function AssignCoursesScreen() {
  const [courses,    setCourses]    = useState<Course[]>([]);
  const [filtered,   setFiltered]   = useState<Course[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [assigning,  setAssigning]  = useState<string | null>(null);
  const [removing,   setRemoving]   = useState<string | null>(null);
  const [showMine,   setShowMine]   = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await ProfessorAPI.getAvailableCourses();
      const data: Course[] = res.data.data || [];
      setCourses(data);
      applyFilter(data, search, showMine);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to load courses');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, showMine]);

  useEffect(() => { load(); }, []);

  function applyFilter(data: Course[], q: string, mineOnly: boolean) {
    let result = data;
    if (mineOnly) result = result.filter(c => c.is_mine);
    if (q.trim()) {
      const lq = q.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(lq) ||
        c.code.toLowerCase().includes(lq) ||
        (c.section || '').toLowerCase().includes(lq) ||
        c.dept_name.toLowerCase().includes(lq)
      );
    }
    setFiltered(result);
  }

  useEffect(() => { applyFilter(courses, search, showMine); }, [search, showMine, courses]);

  async function handleAssign(course: Course) {
    if (course.is_mine) return;
    setAssigning(course.course_id);
    try {
      await ProfessorAPI.assignCourse(course.course_id);
      setCourses(prev => prev.map(c =>
        c.course_id === course.course_id ? { ...c, is_mine: true } : c
      ));
      Alert.alert('✅ Assigned', `You are now assigned to ${course.name}${course.section ? ` (${course.section})` : ''}`);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to assign course');
    } finally {
      setAssigning(null);
    }
  }

  async function handleUnassign(course: Course) {
    Alert.alert(
      'Remove Course',
      `Remove ${course.name}${course.section ? ` (${course.section})` : ''} from your courses?\n\nStudent enrollment records will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setRemoving(course.course_id);
            try {
              await ProfessorAPI.unassignCourse(course.course_id);
              setCourses(prev => prev.map(c =>
                c.course_id === course.course_id ? { ...c, is_mine: false, my_student_count: 0 } : c
              ));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove course');
            } finally {
              setRemoving(null);
            }
          },
        },
      ]
    );
  }

  const mineCount = courses.filter(c => c.is_mine).length;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Course Assignment</Text>
          <Text style={s.headerSub}>
            {mineCount} assigned · {courses.length} total
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── FILTER TOGGLE ── */}
      <View style={s.filterRow}>
        <TouchableOpacity
          style={[s.filterBtn, !showMine && s.filterBtnActive]}
          onPress={() => setShowMine(false)}
        >
          <Text style={[s.filterBtnTxt, !showMine && s.filterBtnTxtActive]}>All Courses</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterBtn, showMine && s.filterBtnActive]}
          onPress={() => setShowMine(true)}
        >
          <Text style={[s.filterBtnTxt, showMine && s.filterBtnTxtActive]}>My Courses ({mineCount})</Text>
        </TouchableOpacity>
      </View>

      {/* ── SEARCH ── */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, code, department..."
          placeholderTextColor={COLORS.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
            <Text style={s.clearBtnTxt}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── LIST ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.course_id}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>{showMine ? '📚' : '🔍'}</Text>
            <Text style={s.emptyTxt}>
              {showMine ? 'No assigned courses yet.\nSwitch to "All Courses" to assign yourself.' : 'No courses found.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const actionLoading = assigning === item.course_id || removing === item.course_id;
          return (
            <View style={[s.card, item.is_mine && s.cardMine]}>

              {/* Left: course info */}
              <View style={s.cardInfo}>
                <View style={s.cardTitleRow}>
                  <Text style={s.courseName} numberOfLines={1}>{item.name}</Text>
                  {item.is_mine && (
                    <View style={s.mineBadge}>
                      <Text style={s.mineBadgeTxt}>MINE</Text>
                    </View>
                  )}
                </View>
                <Text style={s.courseMeta}>
                  {item.code}{item.section ? ` · ${item.section}` : ''} · Sem {item.semester}
                </Text>
                <Text style={s.courseDept}>{item.dept_name}</Text>
                {item.is_mine && (
                  <Text style={s.studentCount}>
                    👥 {item.my_student_count} student{item.my_student_count !== 1 ? 's' : ''} enrolled
                  </Text>
                )}
              </View>

              {/* Right: action */}
              <View style={s.cardAction}>
                {actionLoading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : item.is_mine ? (
                  <View style={s.mineActions}>
                    <TouchableOpacity
                      style={s.manageBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/manage-students/[courseId]',
                          params: {
                            courseId: item.course_id,
                            courseName: `${item.name}${item.section ? ` (${item.section})` : ''}`,
                          },
                        })
                      }
                    >
                      <Text style={s.manageBtnTxt}>👥 Students</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={() => handleUnassign(item)}
                    >
                      <Text style={s.removeBtnTxt}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.assignBtn}
                    onPress={() => handleAssign(item)}
                  >
                    <Text style={s.assignBtnTxt}>+ Assign</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm,
  },
  backBtnText:   { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub:     { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  filterRow: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  filterBtn: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  filterBtnActive: { borderBottomColor: COLORS.primary },
  filterBtnTxt:    { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  filterBtnTxtActive: { color: COLORS.primary },

  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  searchInput: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: 8, fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  clearBtn:    { padding: 6 },
  clearBtnTxt: { color: COLORS.textMuted, fontSize: 16 },

  listContent: { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  cardMine: { borderColor: COLORS.primary + '55', backgroundColor: COLORS.primary + '05' },

  cardInfo:     { flex: 1, marginRight: SPACING.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  courseName:   { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  courseMeta:   { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  courseDept:   { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  studentCount: { fontSize: 11, color: COLORS.primary, marginTop: 4, fontWeight: '600' },

  mineBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
  },
  mineBadgeTxt: { color: COLORS.white, fontSize: 9, fontWeight: '800' },

  cardAction: { alignItems: 'flex-end', minWidth: 80 },

  assignBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
  },
  assignBtnTxt: { color: COLORS.white, fontSize: 13, fontWeight: '700' },

  mineActions: { gap: 6, alignItems: 'flex-end' },
  manageBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 5,
  },
  manageBtnTxt: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  removeBtn: {
    borderWidth: 1.5, borderColor: COLORS.danger,
    borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 5,
  },
  removeBtnTxt: { color: COLORS.danger, fontSize: 11, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyTxt:  { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});