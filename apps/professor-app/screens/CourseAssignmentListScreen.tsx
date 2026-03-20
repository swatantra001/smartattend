import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal, TextInput, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api, { AssignmentAPI } from '../src/services/api';
import { router } from 'expo-router';


type Assignment = {
  id: string;
  title: string;
  deadline: string;
  professor_files?: string[];
};

export default function CourseAssignmentListScreen({ route, navigation }: { route: any; navigation: any }) {
  const { courseId, courseName } = route.params;
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluatingAll, setIsEvaluatingAll] = useState<boolean>(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDeadline, setNewDeadline] = useState(''); // e.g. YYYY-MM-DD
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    setIsLoading(true);
    try {
      // 🔴 Make sure to read .data.data depending on your axios setup
      const res = await api.get(`/courses/${courseId}/assignments`);
      setAssignments(res.data.data || res.data || []);
    } catch (e) {
      Alert.alert("Error", "Failed to load assignments.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true
      });
      if (!result.canceled) {
        setSelectedFiles([...selectedFiles, ...result.assets]);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to pick files.");
    }
  };

  const handleCreateAssignment = async () => {
    if (!newTitle || !newDeadline) {
      Alert.alert("Missing Fields", "Please provide a title and deadline.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('title', newTitle);
    formData.append('description', newDesc);
    formData.append('deadline', newDeadline); // Ensure your DB accepts this string format

    selectedFiles.forEach((file) => {
      formData.append('files', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream'
      } as any);
    });

    try {
      await AssignmentAPI.createAssignment(courseId, formData);
      Alert.alert("Success", "Assignment created successfully!");
      setModalVisible(false);
      setNewTitle(''); setNewDesc(''); setNewDeadline(''); setSelectedFiles([]);
      fetchAssignments(); // Refresh the list
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.error || "Failed to create assignment.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleEvaluateAll = async () => {
    Alert.alert(
      "Evaluate Entire Course?",
      "Run the AI Integrity check on every submission across all assignments? This may take a few minutes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Analysis", style: "destructive",
          onPress: async () => {
            setIsEvaluatingAll(true);
            try {
              const res = await api.post(`/courses/${courseId}/evaluate-all`, {}, { timeout: 300000 });

              // Inside your handleEvaluateAll function:
              router.push({
                pathname: '/CourseEvalReport',
                params: {
                  results: JSON.stringify(res.data.results),
                  courseName: "Current Course"
                }
              });
              const summary = res.data.results.map((r: any) => `${r.assignment}: ${r.status}`).join('\n');
              Alert.alert("Analysis Complete", summary);
            } catch (e) {
              Alert.alert("Error", "Course-wide evaluation failed.");
            } finally {
              setIsEvaluatingAll(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBox}>
        <Text style={styles.headerTitle}>{courseName}</Text>
        <Text style={styles.headerSub}>Manage all assignments for this course</Text>

        <TouchableOpacity style={styles.evaluateAllBtn} onPress={handleEvaluateAll} disabled={isEvaluatingAll}>
          {isEvaluatingAll ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Run AI Check on Entire Course</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Assignment List */}
      {isLoading ? (
        <ActivityIndicator size="large" color="#d90429" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={assignments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 40 }}>📝</Text>
              <Text style={styles.emptyText}>No assignments given yet.</Text>
              <Text style={{ color: 'gray' }}>Tap the + button to create one.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.assignmentCard}
              onPress={() => navigation.navigate('ProfAssignmentDetail', { assignmentId: item.id })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentTitle}>{item.title}</Text>
                <Text style={styles.assignmentDeadline}>Due: {new Date(item.deadline).toLocaleString()}</Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create Assignment Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create New Assignment</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 18, color: '#d90429', fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Assignment Title</Text>
            <TextInput style={styles.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g., Lab 1: Sorting Algorithms" />

            <Text style={styles.label}>Description & Instructions</Text>
            <TextInput style={[styles.input, { height: 100 }]} multiline value={newDesc} onChangeText={setNewDesc} placeholder="Write instructions here..." textAlignVertical="top" />

            <Text style={styles.label}>Deadline (YYYY-MM-DD HH:MM)</Text>
            <TextInput style={styles.input} value={newDeadline} onChangeText={setNewDeadline} placeholder="2026-03-20 23:59" />

            {/* File Picker Section */}
            <Text style={styles.label}>Attached Reference Files (Optional)</Text>
            <TouchableOpacity style={styles.filePickerBtn} onPress={handlePickFiles}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>📎 Select Files</Text>
            </TouchableOpacity>

            {selectedFiles.map((f, idx) => (
              <View key={idx} style={styles.fileItem}>
                <Text numberOfLines={1} style={{ flex: 1 }}>{f.name}</Text>
                <TouchableOpacity onPress={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}>
                  <Text style={{ color: 'red' }}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={{ padding: 20, borderTopWidth: 1, borderColor: '#eee' }}>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateAssignment} disabled={isUploading}>
              {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Assignment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  headerBox: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#ddd', marginBottom: 10 },
  headerTitle: { fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: 'gray', marginBottom: 15 },
  evaluateAllBtn: { backgroundColor: '#d90429', padding: 15, borderRadius: 8, elevation: 2 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: 'bold', fontSize: 16 },
  assignmentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 15, marginBottom: 10, padding: 20, borderRadius: 8, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#2b2d42' },
  assignmentTitle: { fontSize: 18, fontWeight: 'bold' },
  assignmentDeadline: { color: '#e63946', marginTop: 5, fontWeight: '600' },
  arrow: { fontSize: 24, color: '#ccc', marginLeft: 10 },
  emptyState: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#2b2d42', marginTop: 10 },

  // FAB
  fab: { position: 'absolute', bottom: 30, right: 20, backgroundColor: '#2b2d42', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3 },
  fabIcon: { color: '#fff', fontSize: 32, fontWeight: '300', marginTop: -2 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: '#eee' },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalBody: { padding: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#666', marginBottom: 8, marginTop: 15 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#fafafa' },
  filePickerBtn: { backgroundColor: '#8d99ae', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  fileItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 5, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  submitBtn: { backgroundColor: '#2b2d42', padding: 18, borderRadius: 8, elevation: 2 }
});