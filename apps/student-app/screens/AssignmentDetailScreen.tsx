import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator, Platform, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { WebView } from 'react-native-webview';
import api, { AssignmentAPI } from '../src/services/api';

type Assignment = {
  id: string;
  title: string;
  description: string;
  deadline: string;
  professor_files: string[];
};

type Submission = {
  is_flagged: boolean;
  flag_reason: string;
  submitted_at: string;
  student_files: string[];
};

type FileAction = { url: string; prefix: string; idx: number; isMySubmission: boolean } | null;

export default function AssignmentDetailScreen({ route }: { route: any }) {
  const { assignmentId } = route.params;
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  const [fileMenu, setFileMenu] = useState<FileAction>(null);
  // 🟢 NEW: State to hold the URL currently being previewed
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchDetails();
  }, []);

  const fetchDetails = async () => {
    try {
      const res = await api.get(`/assignments/${assignmentId}`);
      setAssignment(res.data.assignment);

      let subData = res.data.submission;
      if (subData && typeof subData.student_files === 'string') {
        try { subData.student_files = JSON.parse(subData.student_files); } catch (e) { subData.student_files = []; }
      }
      setSubmission(subData);
    } catch (e) { console.error(e); }
  };

  const isPastDeadline = assignment ? new Date() > new Date(assignment.deadline) : false;

  // ─── FILE ACTIONS (PREVIEW, DOWNLOAD, DELETE) ──────────────────────────────

  const handlePreview = () => {
    if (!fileMenu) return;
    let urlToPreview = fileMenu.url;

    // 🟢 FIX: Android can't natively render PDFs in WebViews. 
    // We route it through the Google Docs Viewer API to force it to render in-app!
    if (Platform.OS === 'android') {
      urlToPreview = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(urlToPreview)}`;
    }

    setPreviewUrl(urlToPreview);
    setFileMenu(null); // Close the action menu
  };

  const handleDownload = async () => {
    if (!fileMenu) return;
    const { url: fileUrl, prefix, idx } = fileMenu;
    const progressKey = `${prefix}_${idx}`;
    setFileMenu(null);

    try {
      const cleanTitle = assignment?.title.replace(/[^a-zA-Z0-9]/g, '_') || 'File';
      const shortUUID = Math.random().toString(36).substring(2, 6);
      const extensionMatch = fileUrl.match(/\.([a-zA-Z0-9]+)(\?.*)?$/);
      const extension = extensionMatch ? extensionMatch[1] : 'pdf';
      const finalFileName = `${cleanTitle}_${prefix}_${idx + 1}_.${extension}`;
      const fileUri = FileSystem.documentDirectory + finalFileName;

      const downloadResumable = FileSystem.createDownloadResumable(
        fileUrl, fileUri, {},
        (progressInfo) => {
          const percent = (progressInfo.totalBytesWritten / progressInfo.totalBytesExpectedToWrite) * 100;
          setDownloadProgress(prev => ({ ...prev, [progressKey]: percent }));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result?.uri) {
        if (Platform.OS === 'android') {
          const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const base64Data = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
            const newUri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, finalFileName, `application/${extension}`);
            await FileSystem.writeAsStringAsync(newUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            Alert.alert("✅ Download Complete", `Saved as:\n${finalFileName}`);
          } else { await Sharing.shareAsync(result.uri); }
        } else { await Sharing.shareAsync(result.uri); }
      }
      setDownloadProgress(prev => ({ ...prev, [progressKey]: 0 }));
    } catch (e) {
      Alert.alert("Error", "Failed to download file.");
      setDownloadProgress(prev => ({ ...prev, [progressKey]: 0 }));
    }
  };

  const handleDetach = async () => {
    Alert.alert("Confirm", "Revoke your entire submission? This will clear all files.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke", style: 'destructive', onPress: async () => {
          try {
            await AssignmentAPI.detachSubmission(assignmentId);
            setSubmission(null);
          } catch (e) {
            Alert.alert("Error", "Failed to detach submission.");
          }
        }
      }
    ]);
  };

  const handleRemoveIndividualFile = async () => {
    if (!fileMenu) return;
    const fileUrlToDelete = fileMenu.url;
    setFileMenu(null);

    Alert.alert("Confirm Delete", "Are you sure you want to permanently delete this file from your submission?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: 'destructive', onPress: async () => {
          try {
            await AssignmentAPI.deleteIndividualFile(assignmentId, fileUrlToDelete);
            fetchDetails();
            Alert.alert("Success", "File removed.");
          } catch (e) { Alert.alert("Error", "Failed to remove file."); }
        }
      }
    ]);
  };

  // ─── UPLOAD LOGIC ───────────────────────────────────────────────────────────
  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled) setSelectedFiles(prev => [...prev, ...result.assets]);
    } catch (e) { Alert.alert("Error", "Failed to pick files."); }
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('files', {
          uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream'
        } as any);
      });
      await AssignmentAPI.submitAssignment(assignmentId, formData);
      Alert.alert("Success", "Assignment submitted successfully!");
      setSelectedFiles([]);
      fetchDetails();
    } catch (e: any) { Alert.alert("Error", e.response?.data?.error || "Upload failed."); }
    finally { setIsSubmitting(false); }
  };

  if (!assignment) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#2b2d42" />;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.desc}>{assignment.description}</Text>

        {isPastDeadline ? (
          <View style={styles.deadlineBoxPast}>
            <Text style={styles.deadlineTxtPast}>❌ Deadline Over. Submissions are closed.</Text>
            <Text style={{ color: '#991b1b', marginTop: 5, fontSize: 13 }}>Passed on {new Date(assignment.deadline).toLocaleString()}</Text>
          </View>
        ) : (
          <View style={styles.deadlineBox}>
            <Text style={styles.deadlineTxt}>⏰ Due: {new Date(assignment.deadline).toLocaleString()}</Text>
          </View>
        )}

        {/* Reference Files */}
        {assignment.professor_files?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reference Files</Text>
            {assignment.professor_files.map((fileUrl, idx) => {
              const progress = downloadProgress[`Ref_${idx}`] || 0;
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setFileMenu({ url: fileUrl, prefix: 'Ref', idx, isMySubmission: false })}
                  style={styles.linkBtn}
                  disabled={progress > 0}
                >
                  <Text style={styles.linkText}>
                    {progress > 0 ? `Downloading... ${progress.toFixed(0)}%` : `📄 View Reference File ${idx + 1}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Flagged Banner */}
        {submission?.is_flagged && (
          <View style={styles.flagBox}>
            <Text style={styles.flagTitle}>⚠️ Academic Integrity Alert</Text>
            <Text style={styles.flagText}>Your submission has been flagged by the professor.</Text>
            <Text style={styles.flagReason}>Reason: {submission.flag_reason}</Text>
          </View>
        )}

        {/* My Submission Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Submission</Text>

          {submission ? (
            <View style={styles.submitBox}>
              <Text style={styles.successText}>✅ Submitted on {new Date(submission.submitted_at).toLocaleString()}</Text>

              {submission.student_files && submission.student_files.length === 0 && (
                <Text style={{ color: 'gray', fontStyle: 'italic', marginBottom: 10 }}>No files attached.</Text>
              )}

              {submission.student_files && submission.student_files.map((fileUrl, idx) => {
                const progress = downloadProgress[`MySubmission_${idx}`] || 0;

                // 🟢 DYNAMIC FILENAME EXTRACTION
                let fileName = `File ${idx + 1}`;
                try {
                  const decodedUrl = decodeURIComponent(fileUrl);
                  const rawName = decodedUrl.split('/').pop() || fileName;

                  // 🟢 FIX: This removes the 'timestamp_' prefix and keeps the rest of the original name
                  if (rawName.includes('_')) {
                    const parts = rawName.split('_');
                    // If the first part is a number (our timestamp), skip it
                    fileName = !isNaN(Number(parts[0])) ? parts.slice(1).join('_') : rawName;
                  } else {
                    fileName = rawName;
                  }
                } catch (e) { }
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setFileMenu({ url: fileUrl, prefix: 'MySubmission', idx, isMySubmission: true })}
                    style={styles.myFileBtn}
                  >
                    <Text style={styles.myFileText} numberOfLines={1} ellipsizeMode="middle">
                      {progress > 0 ? `Downloading ${progress.toFixed(0)}%` : `📄 ${fileName}`}
                    </Text>
                  </TouchableOpacity>
                )
              })}

              {!isPastDeadline && (
                <>
                  <TouchableOpacity style={styles.pickFilesBtn} onPress={handlePickFiles}>
                    <Text style={styles.pickFilesText}>➕ Attach Additional Files</Text>
                  </TouchableOpacity>
                  {/* 🟢 NEW: Bring back the master detach button! */}
                  <TouchableOpacity style={styles.detachBtn} onPress={handleDetach}>
                    <Text style={styles.detachBtnText}>🗑️ Revoke Entire Submission</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View>
              {isPastDeadline ? (
                <View style={styles.missedBox}>
                  <Text style={styles.missedText}>You did not submit any files before the deadline.</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.pickFilesBtn} onPress={handlePickFiles}>
                  <Text style={styles.pickFilesText}>📎 Select Files to Submit</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Staged Files for Upload */}
          {!isPastDeadline && selectedFiles.length > 0 && (
            <View style={styles.stagedContainer}>
              <Text style={styles.stagedTitle}>Ready to upload:</Text>
              {selectedFiles.map((f, idx) => (
                <View key={idx} style={styles.stagedFile}>
                  <Text numberOfLines={1} style={styles.stagedFileName}>📄 {f.name}</Text>
                  <TouchableOpacity onPress={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ paddingHorizontal: 10 }}>
                    <Text style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={styles.uploadBtn} onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit Files</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Menu Modal */}
      <Modal visible={!!fileMenu} transparent animationType="fade" onRequestClose={() => setFileMenu(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFileMenu(null)}>
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>File Options</Text>

            <TouchableOpacity style={styles.menuBtn} onPress={handlePreview}>
              <Text style={styles.menuBtnTxt}>👁️ Preview File (Quick View)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuBtn} onPress={handleDownload}>
              <Text style={styles.menuBtnTxt}>⬇️ Download to Device</Text>
            </TouchableOpacity>

            {fileMenu?.isMySubmission && !isPastDeadline && (
              <TouchableOpacity style={[styles.menuBtn, { borderBottomWidth: 0 }]} onPress={handleRemoveIndividualFile}>
                <Text style={[styles.menuBtnTxt, { color: '#ef4444' }]}>🗑️ Remove File</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 🟢 NEW: Full Screen In-App Preview Modal */}
      <Modal visible={!!previewUrl} animationType="slide" onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.previewHeader}>
          <TouchableOpacity onPress={() => setPreviewUrl(null)} style={styles.previewCloseBtn}>
            <Text style={styles.previewCloseTxt}>✕ Close Preview</Text>
          </TouchableOpacity>
        </View>
        {previewUrl && (
          <WebView
            source={{ uri: previewUrl }}
            style={{ flex: 1 }}
            startInLoadingState={true}
            renderLoading={() => <ActivityIndicator size="large" color="#0f172a" style={styles.webviewLoader} />}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f8fafc' },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 8, color: '#0f172a' },
  desc: { fontSize: 15, marginBottom: 15, color: '#475569', lineHeight: 22 },

  deadlineBox: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5', marginBottom: 20 },
  deadlineTxt: { color: '#dc2626', fontWeight: 'bold', fontSize: 14 },
  deadlineBoxPast: { backgroundColor: '#fee2e2', padding: 15, borderRadius: 8, borderWidth: 2, borderColor: '#ef4444', marginBottom: 20, alignItems: 'center' },
  deadlineTxtPast: { color: '#b91c1c', fontWeight: '900', fontSize: 16 },

  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 10 },

  linkBtn: { padding: 16, backgroundColor: '#e0f2fe', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#bae6fd' },
  linkText: { color: '#0369a1', fontWeight: 'bold', fontSize: 15 },

  flagBox: { backgroundColor: '#fff1f2', padding: 15, borderRadius: 8, marginVertical: 15, borderWidth: 1, borderColor: '#fecdd3' },
  flagTitle: { color: '#e11d48', fontWeight: 'bold', fontSize: 16 },
  flagText: { color: '#e11d48', marginTop: 5 },
  flagReason: { color: '#be123c', marginTop: 5, fontStyle: 'italic', fontWeight: '600' },

  submitBox: { padding: 18, backgroundColor: '#ecfdf5', borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0' },
  successText: { color: '#059669', fontWeight: '800', marginBottom: 15, fontSize: 15 },
  myFileBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#d1fae5' },
  myFileText: { color: '#047857', fontWeight: 'bold', fontSize: 14 },

  missedBox: { padding: 15, backgroundColor: '#f3f4f6', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  missedText: { color: '#4b5563', fontWeight: '600' },

  pickFilesBtn: { padding: 16, backgroundColor: '#f1f5f9', borderRadius: 8, borderWidth: 2, borderColor: '#cbd5e1', borderStyle: 'dashed', marginTop: 5 },
  pickFilesText: { color: '#334155', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },

  stagedContainer: { marginTop: 15, padding: 15, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  stagedTitle: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  stagedFile: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: 10, borderRadius: 6, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  stagedFileName: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '500' },

  uploadBtn: { marginTop: 15, padding: 16, backgroundColor: '#0f172a', borderRadius: 8, elevation: 2 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  detachBtn: { marginTop: 10, padding: 14, backgroundColor: '#fee2e2', borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  detachBtnText: { color: '#dc2626', textAlign: 'center', fontWeight: 'bold', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuContainer: { backgroundColor: '#fff', width: '80%', borderRadius: 12, paddingVertical: 10, elevation: 5 },
  menuTitle: { fontSize: 14, fontWeight: 'bold', color: '#94a3b8', textAlign: 'center', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  menuBtn: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuBtnTxt: { fontSize: 16, fontWeight: '600', color: '#0f172a' },

  // Preview Modal Styles
  previewHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 15, paddingTop: Platform.OS === 'ios' ? 50 : 15, backgroundColor: '#0f172a' },
  previewCloseBtn: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#334155', borderRadius: 8 },
  previewCloseTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  webviewLoader: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18 }
});