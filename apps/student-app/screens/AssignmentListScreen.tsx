import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AssignmentAPI } from '../src/services/api';

export default function AssignmentListScreen({ route, navigation }: any) {
  const courseId = route.params?.courseId;
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🟢 FIX: useFocusEffect runs EVERY time this screen appears (even when hitting the back button)
  useFocusEffect(
    useCallback(() => {
      if (!courseId) {
        Alert.alert("Error", "Could not find Course ID");
        setLoading(false);
        return;
      }

      AssignmentAPI.getCourseAssignments(courseId)
        .then((res: any) => {
          const data = res.data?.data || res.data || [];
          setAssignments(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch((err: any) => {
          console.error("Failed to fetch assignments", err);
          setLoading(false);
        });
    }, [courseId])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2b2d42" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={assignments}
        keyExtractor={(item: any, index) => item?.id || index.toString()}
        contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 40 }}>📝</Text>
            <Text style={styles.emptyText}>No assignments yet.</Text>
            <Text style={{ color: 'gray', marginTop: 5 }}>Check back later!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.card, 
              // 🟢 BONUS: Make the left border green if submitted!
              { borderLeftColor: item.has_submitted ? '#10b981' : '#e63946' }
            ]}
            onPress={() => navigation.navigate('AssignmentDetail', { assignmentId: item.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              
              {/* 🟢 Now reads the live boolean from the backend */}
              {item.has_submitted ? (
                <Text style={styles.statusSubmitted}>✓ Submitted</Text>
              ) : (
                <Text style={styles.statusPending}>Pending</Text>
              )}
            </View>
            
            <Text style={styles.deadline}>
              Due: {new Date(item.deadline).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginTop: 10 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15, elevation: 2, borderLeftWidth: 5 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: 'bold', flex: 0.75, color: '#0f172a' },
  statusSubmitted: { color: '#059669', fontWeight: '800', fontSize: 13, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusPending: { color: '#e11d48', fontWeight: '800', fontSize: 13, backgroundColor: '#ffe4e6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  deadline: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 4 }
});