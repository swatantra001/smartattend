import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, ScrollView, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import api, { AssignmentAPI } from '../src/services/api';
import { router } from 'expo-router';

type Assignment = { id: string; title: string; description: string; deadline: string; professor_files: string[]; };
type Submission = { id: string; student_name: string; roll_no: string; email: string; student_files: string[]; is_flagged: boolean; flag_reason: string; submitted_at: string; };
type FileAction = { url: string; fileName: string } | null;

export default function ProfAssignmentDetailScreen({ route, navigation }: { route: any; navigation: any }) {
  const { assignmentId } = route.params;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // File Preview & Download State
  const [fileMenu, setFileMenu] = useState<FileAction>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editExistingFiles, setEditExistingFiles] = useState<string[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [evalProgress, setEvalProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { fetchDetails(); }, []);

  // 🟢 FIX 1: The Bulletproof React Polling Pattern
  // This automatically starts when isEvaluating is true, 
  // and perfectly cleans itself up when false, unmounted, or hot-reloaded!
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isEvaluating) {
      interval = setInterval(async () => {
        try {
          const res = await AssignmentAPI.getEvaluationProgress(assignmentId);
          setEvalProgress(res.data.progress);
        } catch (e) { }
      }, 1000);
    }
    return () => clearInterval(interval); // Auto-cleanup!
  }, [isEvaluating, assignmentId]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/assignments/${assignmentId}`);

      // 1. Parse Professor Files
      let assignData = res.data.assignment;
      if (typeof assignData.professor_files === 'string') {
        try { assignData.professor_files = JSON.parse(assignData.professor_files); } catch (e) { assignData.professor_files = []; }
      }
      setAssignment(assignData);

      // 2. Parse Student Submission Files (🟢 FIX for empty submissions list!)
      const parsedSubs = res.data.submissions.map((sub: any) => {
        if (typeof sub.student_files === 'string') {
          try { sub.student_files = JSON.parse(sub.student_files); } catch (e) { sub.student_files = []; }
        }
        return sub;
      });
      setSubmissions(parsedSubs);
    } catch (err) { Alert.alert("Error", "Could not load assignment details"); }
    finally { setLoading(false); }
  };

  // ─── EDIT ASSIGNMENT LOGIC ────────────────────────────────────────────────
  const openEditModal = () => {
    if (!assignment) return;
    setEditTitle(assignment.title);
    setEditDesc(assignment.description || '');
    // Simple formatting for input, ideally use a DatePicker library in production
    const d = new Date(assignment.deadline);
    setEditDeadline(d.toISOString().slice(0, 19).replace('T', ' '));
    setEditExistingFiles(assignment.professor_files || []);
    setEditNewFiles([]);
    setIsEditing(true);
  };

  const handlePickNewFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled) setEditNewFiles(prev => [...prev, ...result.assets]);
    } catch (e) { Alert.alert("Error", "Failed to pick files."); }
  };

  const saveEdits = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', editTitle);
      formData.append('description', editDesc);
      formData.append('deadline', new Date(editDeadline).toISOString());
      formData.append('existing_files', JSON.stringify(editExistingFiles)); // Keep these

      editNewFiles.forEach((file) => {
        formData.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/pdf' } as any);
      });

      await AssignmentAPI.updateAssignment(assignmentId, formData);
      Alert.alert("Success", "Assignment updated!");
      setIsEditing(false);
      fetchDetails(); // Refresh
    } catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Failed to update."); }
    finally { setIsSaving(false); }
  };

  // ─── FILE PREVIEW & DOWNLOAD LOGIC ────────────────────────────────────────
  const getCleanFileName = (url: string, fallback: string) => {
    try {
      const rawName = decodeURIComponent(url).split('/').pop() || fallback;
      return rawName.includes('_') ? rawName.split('_').slice(1).join('_') : rawName;
    } catch { return fallback; }
  };

  const handlePreview = () => {
    if (!fileMenu) return;
    let urlToPreview = fileMenu.url;
    if (Platform.OS === 'android') {
      urlToPreview = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(urlToPreview)}&no_cache=${Date.now()}`;
    }
    setPreviewUrl(urlToPreview);
    setFileMenu(null);
  };

  const handleDownload = async () => {
    if (!fileMenu) return;
    const { url, fileName } = fileMenu;
    setFileMenu(null);
    try {
      const fileUri = FileSystem.documentDirectory + fileName;
      const downloadResumable = FileSystem.createDownloadResumable(url, fileUri, {});
      const result = await downloadResumable.downloadAsync();

      if (result?.uri) {
        if (Platform.OS === 'android') {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64Data = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, fileName, `application/pdf`);
            await FileSystem.writeAsStringAsync(newUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            Alert.alert("✅ Download Complete");
          } else { await Sharing.shareAsync(result.uri); }
        } else { await Sharing.shareAsync(result.uri); }
      }
    } catch (e) { Alert.alert("Error", "Failed to download."); }
  };

  // ─── AI TRIGGER ───────────────────────────────────────────────────────────
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvalProgress(0);

    try {
      await api.post(
        `/assignments/${assignmentId}/evaluate`,
        {},
        { timeout: 300000 } // 300,000 ms = 5 minutes
      );
      // Force 100% on success before moving screens
      setEvalProgress(100);
      setTimeout(() => {
        Alert.alert("Success", "AI Analysis Complete!");
        // 🟢 FIX: Use Expo Router so the Report Screen actually receives the ID!
        router.push({
            pathname: '/EvaluationReport',
            params: { assignmentId: assignmentId }
        });
      }, 500);
      setIsEvaluating(false); // 🟢 This instantly kills the interval above!
    } catch (e) { 
      Alert.alert("Error", "Failed to run AI evaluation."); 
      setIsEvaluating(false); // Kill interval on error too
    }
  };

  if (loading || !assignment) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#2b2d42" />;

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{assignment.title}</Text>
              <Text style={styles.deadline}>Deadline: {new Date(assignment.deadline).toLocaleString()}</Text>
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={openEditModal}>
              <Text style={styles.editBtnText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>{assignment.description}</Text>

          {/* Professor Files */}
          {assignment.professor_files?.length > 0 && (
            <View style={styles.refFilesContainer}>
              <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Attached Resources:</Text>
              {assignment.professor_files.map((url, idx) => {
                const fName = getCleanFileName(url, `Resource ${idx + 1}`);
                return (
                  <TouchableOpacity key={idx} onPress={() => setFileMenu({ url, fileName: fName })} style={styles.fileChip}>
                    <Text style={styles.fileChipText} numberOfLines={1}>📄 {fName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* 🟢 NEW: Dynamic Progress Bar & Button */}
          <View style={{ marginTop: 15 }}>
            {isEvaluating ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressTextRow}>
                  <Text style={{ fontWeight: 'bold', color: '#6d28d9' }}>AI Processing Documents...</Text>
                  <Text style={{ fontWeight: 'bold', color: '#6d28d9' }}>{evalProgress}%</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${evalProgress}%` }]} />
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.evaluateBtn} onPress={handleEvaluate}>
                <Text style={styles.btnText}>✨ Trigger AI Clustering</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={styles.subHeader}>Student Submissions ({submissions.length})</Text>

        {submissions.length === 0 ? (
          <Text style={{ textAlign: 'center', color: 'gray', marginTop: 20 }}>No submissions yet.</Text>
        ) : (
          <FlatList
            data={submissions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => (
              <View style={[styles.studentCard, item.is_flagged && { borderColor: '#ef4444', borderWidth: 1 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.studentName}>{item.student_name} ({item.roll_no})</Text>
                  {item.is_flagged && <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>⚠️ Flagged</Text>}
                </View>
                <Text style={{ color: 'gray', fontSize: 13 }}>{item.email}</Text>

                <View style={{ marginTop: 10 }}>
                  {item.student_files && item.student_files.map((file, idx) => {
                    const fName = getCleanFileName(file, `Solution ${idx + 1}`);
                    return (
                      <TouchableOpacity key={idx} onPress={() => setFileMenu({ url: file, fileName: fName })} style={styles.studentFileBtn}>
                        <Text style={styles.studentFileText} numberOfLines={1}>📄 {fName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          />
        )}
      </View>

      {/* ─── MODALS ─── */}

      {/* 1. File Action Modal */}
      <Modal visible={!!fileMenu} transparent animationType="fade" onRequestClose={() => setFileMenu(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFileMenu(null)}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>File Options</Text>
            <TouchableOpacity style={styles.menuBtn} onPress={handlePreview}><Text style={styles.menuBtnTxt}>👁️ Preview File</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.menuBtn, { borderBottomWidth: 0 }]} onPress={handleDownload}><Text style={styles.menuBtnTxt}>⬇️ Download File</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 2. Full Screen Preview Modal */}
      <Modal visible={!!previewUrl} animationType="slide" onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewUrl(null)} style={styles.previewCloseBtn}><Text style={{ color: '#fff', fontWeight: 'bold' }}>✕ Close Preview</Text></TouchableOpacity>
        </View>
        {previewUrl && <WebView source={{ uri: previewUrl }} style={{ flex: 1 }} />}
      </Modal>

      {/* 3. Edit Assignment Modal */}
      <Modal visible={isEditing} animationType="slide">
        <View style={styles.modalHeader}>
          <Text style={styles.modalHeaderTitle}>Edit Assignment</Text>
          <TouchableOpacity onPress={() => setIsEditing(false)}><Text style={{ fontSize: 16, color: '#dc2626' }}>Cancel</Text></TouchableOpacity>
        </View>
        <ScrollView style={{ padding: 20 }}>

          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} />

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, { height: 80 }]} multiline value={editDesc} onChangeText={setEditDesc} />

          <Text style={styles.label}>Deadline (YYYY-MM-DD HH:MM:SS)</Text>
          <TextInput style={styles.input} value={editDeadline} onChangeText={setEditDeadline} />

          <Text style={styles.label}>Existing Files</Text>
          {editExistingFiles.map((url, idx) => (
            <View key={idx} style={styles.editFileRow}>
              <Text style={{ flex: 1 }} numberOfLines={1}>📄 {getCleanFileName(url, 'File')}</Text>
              <TouchableOpacity onPress={() => setEditExistingFiles(prev => prev.filter((_, i) => i !== idx))}>
                <Text style={{ color: 'red', fontWeight: 'bold' }}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <Text style={[styles.label, { marginTop: 15 }]}>New Files to Attach</Text>
          {editNewFiles.map((f, idx) => (
            <View key={idx} style={styles.editFileRow}>
              <Text style={{ flex: 1 }} numberOfLines={1}>➕ {f.name}</Text>
              <TouchableOpacity onPress={() => setEditNewFiles(prev => prev.filter((_, i) => i !== idx))}>
                <Text style={{ color: 'red', fontWeight: 'bold' }}>✕ Remove</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.attachBtn} onPress={handlePickNewFiles}>
            <Text style={{ textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>📎 Select Additional Files</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.saveBtn} onPress={saveEdits} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>💾 Save Changes</Text>}
          </TouchableOpacity>
          <View style={{ height: 100 }} />
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  desc: { fontSize: 14, color: '#475569', marginVertical: 8 },
  deadline: { color: '#dc2626', fontWeight: '600', marginTop: 4 },
  editBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  editBtnText: { color: '#0f172a', fontWeight: 'bold' },

  refFilesContainer: { marginVertical: 10, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  fileChip: { padding: 8, backgroundColor: '#e0f2fe', borderRadius: 6, marginBottom: 5 },
  fileChipText: { color: '#0369a1', fontWeight: '600' },

  evaluateBtn: { backgroundColor: '#8a2be2', padding: 15, borderRadius: 8, marginTop: 10 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },

  subHeader: { padding: 20, fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  studentCard: { backgroundColor: '#fff', marginHorizontal: 20, marginBottom: 15, padding: 15, borderRadius: 10, elevation: 1 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  studentFileBtn: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 6, marginTop: 5, borderWidth: 1, borderColor: '#e2e8f0' },
  studentFileText: { color: '#334155', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContainer: { backgroundColor: '#fff', width: '80%', borderRadius: 12, paddingVertical: 10 },
  menuTitle: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', textAlign: 'center', marginBottom: 10 },
  menuBtn: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuBtnTxt: { fontSize: 16, fontWeight: '600' },

  previewHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 15, paddingTop: Platform.OS === 'ios' ? 50 : 15, backgroundColor: '#0f172a' },
  previewCloseBtn: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#334155', borderRadius: 8 },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 50, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  modalHeaderTitle: { fontSize: 18, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#334155', marginTop: 15, marginBottom: 5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15 },
  editFileRow: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: '#f1f5f9', borderRadius: 6, marginBottom: 8 },
  attachBtn: { padding: 15, backgroundColor: '#e2e8f0', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#94a3b8', marginTop: 5 },
  saveBtn: { backgroundColor: '#10b981', padding: 15, borderRadius: 8, marginTop: 30 },

  progressContainer: { backgroundColor: '#f3e8ff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#d8b4fe' },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressBarBg: { height: 8, backgroundColor: '#e9d5ff', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#8b5cf6' },
});