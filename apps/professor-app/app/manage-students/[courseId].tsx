// D:\smartattend\apps\professor-app\app\manage-students\[courseId].tsx
// NEW FILE — Professor can enroll students by roll number, CSV, JSON, Excel

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS, SPACING, RADIUS } from '../../src/constants';
import { ProfessorAPI } from '../../src/services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EnrolledStudent {
  student_id: string;
  name: string;
  roll_number: string;
  semester: number;
  dept_name: string;
  email: string;
  face_enrolled: boolean;
  enrolled_at: string;
}

interface SearchResult {
  student_id: string;
  name: string;
  roll_number: string;
  semester: number;
  dept_name: string;
  email: string;
  already_enrolled: boolean;
  face_enrolled: boolean;
}

interface ImportResult {
  enrolled: number;
  already_enrolled: number;
  not_added: { roll_number: string; reason: string }[];
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ManageStudentsScreen() {
  const { courseId, courseName } = useLocalSearchParams<{
    courseId: string;
    courseName: string;
  }>();

  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'enrolled' | 'add'>('enrolled');

  // Manual search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Remove student
  const [removing, setRemoving] = useState<string | null>(null);

  // ── Load enrolled students ───────────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    try {
      const res = await ProfessorAPI.getCourseStudents(courseId);
      setEnrolledStudents(res.data.data);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [courseId]);

  useEffect(() => { loadStudents(); }, []);

  // ── Live search as professor types ──────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await ProfessorAPI.searchStudentsForEnrollment(courseId, searchQuery.trim());
        setSearchResults(res.data.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  // ── Enroll single student from search result ─────────────────────────────
  async function enrollSingle(student: SearchResult) {
    if (student.already_enrolled) return;
    try {
      const res = await ProfessorAPI.enrollStudents(courseId, [student.roll_number]);
      const data = res.data.data;
      if (data.enrolled > 0) {
        Alert.alert('✅ Enrolled', `${student.name} added to course.`);
        loadStudents();
        setSearchQuery('');
        setSearchResults([]);
        setActiveTab('enrolled');
      } else {
        const reason = data.not_added?.[0]?.reason ?? 'Unknown error';
        Alert.alert('Could not enroll', reason);
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Enrollment failed');
    }
  }

  // ── Remove student from course ───────────────────────────────────────────
  async function handleRemove(student: EnrolledStudent) {
    Alert.alert(
      'Remove Student',
      `Remove ${student.name} (${student.roll_number}) from this course?\n\nPast attendance records will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            setRemoving(student.student_id);
            try {
              await ProfessorAPI.removeStudentFromCourse(courseId, student.student_id);
              setEnrolledStudents(prev => prev.filter(s => s.student_id !== student.student_id));
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to remove student');
            } finally {
              setRemoving(null);
            }
          }
        }
      ]
    );
  }

  // ── Bulk enroll from text input ──────────────────────────────────────────
  async function handleBulkEnrollFromText() {
    const rolls = parseBulkText(bulkText);
    if (rolls.length === 0) {
      Alert.alert('No Roll Numbers', 'Enter at least one roll number, separated by commas or new lines.');
      return;
    }
    await runBulkEnroll(rolls);
  }

  // ── Pick file (CSV / JSON / Excel) ───────────────────────────────────────
  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/plain',
          'application/json',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;
      const file = result.assets[0];
      const ext = file.name.split('.').pop()?.toLowerCase();

      let rolls: string[] = [];

      if (ext === 'json') {
        rolls = await parseJsonFile(file.uri);
      } else if (ext === 'csv' || ext === 'txt') {
        rolls = await parseCsvFile(file.uri);
      } else if (ext === 'xlsx' || ext === 'xls') {
        Alert.alert(
          'Excel File',
          'Excel files are not directly parseable on mobile.\n\nPlease export as CSV or copy-paste the roll numbers in the text box below.',
        );
        return;
      } else {
        // Try parsing as plain text / CSV anyway
        rolls = await parseCsvFile(file.uri);
      }

      if (rolls.length === 0) {
        Alert.alert(
          'No Roll Numbers Found',
          'Could not find any roll numbers in the file.\n\nExpected format:\n• CSV: one column named "roll_number"\n• JSON: array of strings or objects with "roll_number" key'
        );
        return;
      }

      Alert.alert(
        `Found ${rolls.length} Roll Numbers`,
        `Preview: ${rolls.slice(0, 5).join(', ')}${rolls.length > 5 ? ` ... and ${rolls.length - 5} more` : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Enroll ${rolls.length} Students`,
            onPress: () => runBulkEnroll(rolls),
          }
        ]
      );
    } catch (err: any) {
      Alert.alert('File Error', 'Could not read the file. Please try again.');
    }
  }

  async function runBulkEnroll(rolls: string[]) {
    setImporting(true);
    setImportResult(null);
    try {
      const res = await ProfessorAPI.enrollStudents(courseId, rolls);
      const data: ImportResult = res.data.data;
      setImportResult(data);
      if (data.enrolled > 0) {
        loadStudents();
      }
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Bulk enrollment failed');
    } finally {
      setImporting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>Manage Students</Text>
          <Text style={styles.headerSub} numberOfLines={1}>{courseName}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── TABS ───────────────────────────────────────────────────────── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'enrolled' && styles.tabActive]}
          onPress={() => setActiveTab('enrolled')}
        >
          <Text style={[styles.tabText, activeTab === 'enrolled' && styles.tabTextActive]}>
            👥 Enrolled ({enrolledStudents.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'add' && styles.tabActive]}
          onPress={() => setActiveTab('add')}
        >
          <Text style={[styles.tabText, activeTab === 'add' && styles.tabTextActive]}>
            ➕ Add Students
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════ ENROLLED TAB ════════════════════════════════════ */}
      {activeTab === 'enrolled' && (
        <FlatList
          data={enrolledStudents}
          keyExtractor={item => item.student_id}
          contentContainerStyle={styles.listContent}
          onRefresh={() => { setRefreshing(true); loadStudents(); }}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text style={styles.emptyText}>No students enrolled yet.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setActiveTab('add')}
              >
                <Text style={styles.emptyBtnText}>➕ Add Students</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.studentRow}>
              <View style={styles.studentAvatar}>
                <Text style={styles.studentAvatarText}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentMeta}>
                  {item.roll_number} • Sem {item.semester} • {item.dept_name}
                </Text>
                <View style={styles.studentBadgeRow}>
                  {item.face_enrolled
                    ? <View style={styles.badgeGreen}><Text style={styles.badgeText}>✅ Face Enrolled</Text></View>
                    : <View style={styles.badgeYellow}><Text style={styles.badgeText}>⚠️ No Face</Text></View>
                  }
                </View>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => handleRemove(item)}
                disabled={removing === item.student_id}
              >
                {removing === item.student_id
                  ? <ActivityIndicator size="small" color={COLORS.danger} />
                  : <Text style={styles.removeBtnText}>✕</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* ══════════════ ADD STUDENTS TAB ════════════════════════════════ */}
      {activeTab === 'add' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <ScrollView contentContainerStyle={styles.addContent} keyboardShouldPersistTaps="handled">

            {/* ── SECTION 1: Search & add one by one ────────────────── */}
            <Text style={styles.sectionTitle}>🔍 Search & Add</Text>
            <Text style={styles.sectionSub}>Search by roll number, name, or email</Text>

            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="e.g. 22CS001 or Rahul..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              returnKeyType="search"
            />

            {searching && (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
            )}

            {searchResults.map(student => (
              <View key={student.student_id} style={styles.searchResultRow}>
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName}>{student.name}</Text>
                  <Text style={styles.searchResultMeta}>
                    {student.roll_number} • Sem {student.semester} • {student.dept_name}
                  </Text>
                </View>
                {student.already_enrolled ? (
                  <View style={styles.enrolledTag}>
                    <Text style={styles.enrolledTagText}>Enrolled</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => enrollSingle(student)}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <Text style={styles.noResults}>
                No students found for "{searchQuery}".{'\n'}
                If the student doesn't appear, ask admin to register them first.
              </Text>
            )}

            <View style={styles.divider} />

            {/* ── SECTION 2: Bulk by roll numbers (text) ────────────── */}
            <Text style={styles.sectionTitle}>📋 Bulk Add by Roll Numbers</Text>
            <Text style={styles.sectionSub}>
              Paste roll numbers separated by commas or new lines
            </Text>

            <TextInput
              style={styles.bulkInput}
              value={bulkText}
              onChangeText={setBulkText}
              placeholder={'22CS001, 22CS002, 22CS003\nor one per line:\n22CS001\n22CS002'}
              placeholderTextColor={COLORS.textMuted}
              multiline
              autoCapitalize="characters"
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.bulkBtn, importing && { opacity: 0.6 }]}
              onPress={handleBulkEnrollFromText}
              disabled={importing || !bulkText.trim()}
            >
              {importing
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.bulkBtnText}>Enroll Students</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* ── SECTION 3: Import from file ───────────────────────── */}
            <Text style={styles.sectionTitle}>📁 Import from File</Text>
            <Text style={styles.sectionSub}>
              CSV or JSON file with roll numbers
            </Text>

            <View style={styles.fileFormatBox}>
              <Text style={styles.fileFormatTitle}>Accepted formats:</Text>
              <Text style={styles.fileFormatText}>
                {'• CSV: header row with "roll_number" column\n'}
                {'  e.g: roll_number,name\n       22CS001,Rahul\n\n'}
                {'• JSON: array of strings or objects\n'}
                {'  e.g: ["22CS001","22CS002"]\n'}
                {'  or: [{roll_number:"22CS001"},...]\n\n'}
                {'• Excel: export as CSV first'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.filePickBtn}
              onPress={handlePickFile}
              disabled={importing}
            >
              <Text style={styles.filePickBtnText}>📎 Pick File (CSV / JSON)</Text>
            </TouchableOpacity>

            {/* ── Import result ─────────────────────────────────────── */}
            {importResult && (
              <View style={styles.importResultBox}>
                <Text style={styles.importResultTitle}>Import Result</Text>
                <View style={styles.importResultRow}>
                  <Text style={styles.importResultGreen}>✅ Enrolled: {importResult.enrolled}</Text>
                  <Text style={styles.importResultGray}>⏭ Already enrolled: {importResult.already_enrolled}</Text>
                </View>
                {importResult.not_added.length > 0 && (
                  <>
                    <Text style={styles.importResultRed}>
                      ❌ Not added ({importResult.not_added.length}):
                    </Text>
                    {importResult.not_added.map((item, i) => (
                      <Text key={i} style={styles.importNotAddedRow}>
                        • {item.roll_number} — {item.reason}
                      </Text>
                    ))}
                  </>
                )}
                <TouchableOpacity onPress={() => setImportResult(null)} style={styles.clearResultBtn}>
                  <Text style={styles.clearResultBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

    </SafeAreaView>
  );
}

// ─── File parsing helpers ─────────────────────────────────────────────────────

function parseBulkText(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length > 1);
}

async function parseCsvFile(uri: string): Promise<string[]> {
  const content = await FileSystem.readAsStringAsync(uri);
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  // Check if first line is a header
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('roll') || header.includes('reg') || header.includes('id');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  // Find the column index of roll_number in header
  let rollIdx = 0;
  if (hasHeader) {
    const headers = header.split(',').map(h => h.trim().replace(/"/g, ''));
    const found = headers.findIndex(h =>
      h.includes('roll') || h.includes('reg') || h === 'id' || h === 'no'
    );
    if (found >= 0) rollIdx = found;
  }

  const rolls: string[] = [];
  for (const line of dataLines) {
    const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
    if (cols[rollIdx]) {
      rolls.push(cols[rollIdx].toUpperCase());
    }
  }
  return [...new Set(rolls.filter(r => r.length > 1))];
}

async function parseJsonFile(uri: string): Promise<string[]> {
  const content = await FileSystem.readAsStringAsync(uri);
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed)) {
    if (typeof parsed[0] === 'string') {
      // ["22CS001", "22CS002"]
      return parsed.map((r: string) => r.trim().toUpperCase()).filter(Boolean);
    }
    if (typeof parsed[0] === 'object') {
      // [{ roll_number: "22CS001" }, ...]
      const key = Object.keys(parsed[0]).find(k =>
        k.toLowerCase().includes('roll') || k.toLowerCase().includes('reg')
      ) ?? 'roll_number';
      return parsed
        .map((r: any) => String(r[key] || '').trim().toUpperCase())
        .filter((r: string) => r.length > 1);
    }
  }
  return [];
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: RADIUS.sm,
  },
  backBtnText: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  // Tabs
  tabs: {
    flexDirection: 'row', backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: SPACING.sm,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },

  // Enrolled list
  listContent: { padding: SPACING.md, gap: SPACING.sm, flexGrow: 1 },
  studentRow: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  studentAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: SPACING.sm,
  },
  studentAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  studentInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  studentMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  studentBadgeRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  badgeGreen: {
    backgroundColor: '#D1FAE5', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeYellow: {
    backgroundColor: '#FEF3C7', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '600', color: COLORS.textPrimary },
  removeBtn: {
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
    borderRadius: 16, backgroundColor: '#FFF0F0',
  },
  removeBtnText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },

  // Empty
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.textMuted, marginTop: SPACING.sm, fontSize: 14 },
  emptyBtn: {
    marginTop: SPACING.md, backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
  },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  // Add students tab
  addContent: { padding: SPACING.md },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: COLORS.textPrimary,
    marginBottom: 2,
  },
  sectionSub: { fontSize: 12, color: COLORS.textMuted, marginBottom: SPACING.sm },
  searchInput: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: 14, color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
  },
  searchResultRow: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.sm, flexDirection: 'row', alignItems: 'center',
    marginTop: SPACING.xs,
    borderWidth: 1, borderColor: COLORS.border,
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  searchResultMeta: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  enrolledTag: {
    backgroundColor: '#D1FAE5', borderRadius: RADIUS.sm,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  enrolledTagText: { color: '#059669', fontSize: 11, fontWeight: '700' },
  addBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
  },
  addBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  noResults: {
    marginTop: SPACING.sm, color: COLORS.textMuted,
    fontSize: 13, lineHeight: 20,
  },
  divider: {
    height: 1, backgroundColor: COLORS.border,
    marginVertical: SPACING.lg,
  },

  // Bulk text
  bulkInput: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: 13, color: COLORS.textPrimary,
    backgroundColor: COLORS.white,
    height: 100, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  bulkBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.md,
    padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
  },
  bulkBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  // File import
  fileFormatBox: {
    backgroundColor: '#F8FAFC', borderRadius: RADIUS.md,
    padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  fileFormatTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  fileFormatText: {
    fontSize: 11, color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  filePickBtn: {
    borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: 'dashed',
    borderRadius: RADIUS.md, padding: SPACING.md,
    alignItems: 'center',
  },
  filePickBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  // Import result
  importResultBox: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  importResultTitle: {
    fontSize: 14, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm,
  },
  importResultRow: { flexDirection: 'row', gap: SPACING.md, flexWrap: 'wrap', marginBottom: SPACING.xs },
  importResultGreen: { fontSize: 14, fontWeight: '700', color: COLORS.success },
  importResultGray: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  importResultRed: { fontSize: 13, fontWeight: '700', color: COLORS.danger, marginTop: SPACING.xs },
  importNotAddedRow: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, marginLeft: 4 },
  clearResultBtn: { marginTop: SPACING.sm, alignSelf: 'flex-end' },
  clearResultBtnText: { color: COLORS.textMuted, fontSize: 13 },
});