import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AttendanceAPI } from '../../src/services/api';
import { COLORS, SPACING, RADIUS } from '../../src/constants';

interface HistoryRecord {
  record_id: string;
  status: string;
  verification_status: string;
  face_score: number;
  liveness_score: number;
  scene_score: number;
  marked_by: string;
  course_name: string;
  course_code: string;
  professor_name: string;
  started_at: string;
}

export default function AttendanceScreen() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadHistory() {
    try {
      const res = await AttendanceAPI.getHistory();
      setRecords(res.data.data);
    } catch (err) {
      console.error('History error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHistory(); }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }

  function getStatusColor(status: string) {
    if (status === 'PRESENT') return COLORS.success;
    if (status === 'MANUAL_OVERRIDE') return COLORS.suspicious;
    return COLORS.danger;
  }

  function getStatusLabel(status: string) {
    if (status === 'PRESENT') return '✅ Present';
    if (status === 'MANUAL_OVERRIDE') return '✋ Manual';
    return '❌ Absent';
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ' • ' + d.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance History</Text>
        <Text style={styles.headerSub}>{records.length} records</Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.record_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor={COLORS.primary} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No attendance records yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const color = getStatusColor(item.status);
          return (
            <View style={[styles.card, { borderLeftColor: color }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <Text style={styles.courseName}>{item.course_name}</Text>
                  <Text style={styles.courseCode}>{item.course_code}</Text>
                  <Text style={styles.professor}>Prof. {item.professor_name}</Text>
                  <Text style={styles.date}>{formatDate(item.started_at)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: color + '18' }]}>
                  <Text style={[styles.statusText, { color }]}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              {/* Scores */}
              {/* Scores - Use !! to ensure a boolean result */}
              {item.status === 'PRESENT' && !!item.face_score && (
                <View style={styles.scores}>
                  <ScorePill label="Face" value={item.face_score} />
                  <ScorePill label="Live" value={item.liveness_score} />
                  <ScorePill label="Scene" value={item.scene_score} />
                </View>
              )}

            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 70 ? COLORS.success : pct >= 55 ? COLORS.warning : COLORS.danger;
  return (
    <View style={[scorePillStyles.pill, { backgroundColor: color + '18' }]}>
      <Text style={[scorePillStyles.label, { color }]}>{label}</Text>
      <Text style={[scorePillStyles.value, { color }]}>{pct}%</Text>
    </View>
  );
}

const scorePillStyles = StyleSheet.create({
  pill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: { fontSize: 11, fontWeight: '600' },
  value: { fontSize: 11, fontWeight: '700' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  list: { padding: SPACING.md, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLeft: { flex: 1, marginRight: SPACING.sm },
  courseName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  courseCode: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  professor: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  date: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  statusBadge: {
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs, justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  scores: {
    flexDirection: 'row', gap: SPACING.xs,
    marginTop: SPACING.sm, flexWrap: 'wrap',
  },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14 },
});