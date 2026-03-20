import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { StudentAPI } from '../src/services/api';

type Course = {
  id: string; // or course_id depending on your DB
  course_id?: string;
  name: string;
  code: string;
};

export default function CourseListScreen({ navigation }: { navigation: any }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    StudentAPI.getMyCourses()
      .then(res => {
        // Safely extract the array, whether wrapped in .data or not
        setCourses(res.data.data || res.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load courses:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#2b2d42" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id || item.course_id || Math.random().toString()}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', marginTop: 50 }}>
            <Text style={{ fontSize: 16, color: 'gray' }}>You are not enrolled in any courses.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.card}
            onPress={() => navigation.navigate('AssignmentList', { 
              courseId: item.id || item.course_id, 
              courseName: item.name 
            })}
          >
            <Text style={styles.courseName}>{item.name}</Text>
            <Text style={styles.courseCode}>{item.code}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 15, backgroundColor: '#f4f6f8' },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15, elevation: 2, borderLeftWidth: 4, borderLeftColor: '#2a9d8f' },
  courseName: { fontSize: 18, fontWeight: 'bold' },
  courseCode: { color: '#666', marginTop: 5 }
});