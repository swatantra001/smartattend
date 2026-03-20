import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import api from '../src/services/api';

export default function AssignmentDetail({ route }: { route: any }) {
  const { assignment } = route.params;
  const [submission, setSubmission] = useState(assignment.submission);

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
      if (!result.canceled) {
        const formData = new FormData();
        result.assets.forEach((file, index) => {
          formData.append('files', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
        });

        await api.post(`/assignments/${assignment.id}/submit`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
        Alert.alert("Success", "Submitted!");
        setSubmission({ is_flagged: false }); // Optimistic update
      }
    } catch (e) { Alert.alert("Error", "Upload failed."); }
  };

  const handleDetach = async () => {
    await api.delete(`/assignments/${assignment.id}/submit`);
    setSubmission(null);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{assignment.title}</Text>
      <Text style={styles.deadline}>Deadline: {new Date(assignment.deadline).toLocaleString()}</Text>

      {submission?.is_flagged && (
        <View style={styles.flagBox}>
          <Text style={styles.flagText}>⚠️ Flagged for Academic Integrity Review</Text>
        </View>
      )}

      {submission ? (
        <View>
          <Text style={{ color: 'green', fontWeight: 'bold', marginVertical: 10 }}>✅ Successfully Submitted</Text>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleDetach}>
            <Text style={styles.btnText}>Detach & Change Files</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.btnPrimary} onPress={handleUpload}>
          <Text style={styles.btnText}>Upload Solution Files</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  deadline: { color: 'gray', marginBottom: 20 },
  flagBox: { backgroundColor: '#ffcccc', padding: 15, borderRadius: 8, marginBottom: 20 },
  flagText: { color: '#cc0000', fontWeight: 'bold' },
  btnPrimary: { padding: 15, backgroundColor: '#2b2d42', borderRadius: 8 },
  btnSecondary: { padding: 15, backgroundColor: '#8d99ae', borderRadius: 8 },
  btnText: { color: 'white', textAlign: 'center', fontWeight: 'bold' }
});