import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import api from '../../src/services/api';

// 1. Import all the screens you just showed me!
import CourseAssignmentListScreen from '../../screens/CourseAssignmentListScreen';
import ProfAssignmentDetailScreen from '../../screens/AssignmentDetailScreen';
import EvaluationReportScreen from '../../screens/EvaluationReportScreen';

// 2. We need a root screen to show the professor's courses first, 
// so they can click one and pass the courseId to CourseAssignmentListScreen
function ProfCourseListScreen({ navigation }: { navigation: any }) {
	const [courses, setCourses] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		api.get('/professors/courses')
			.then(res => {
				setCourses(res.data.data);
				setLoading(false);
			})
			.catch(err => {
				console.error(err);
				setLoading(false);
			});
	}, []);

	if (loading) return <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#2b2d42" />;

	return (
		<View style={styles.container}>
			<FlatList
				data={courses}
				keyExtractor={(item) => item.course_id}
				// 🟢 ADD THIS: It will show a message if the professor has no courses
				ListEmptyComponent={
					<View style={{ alignItems: 'center', marginTop: 50 }}>
						<Text style={{ fontSize: 16, color: 'gray' }}>No courses assigned to you yet.</Text>
					</View>
				}
				renderItem={({ item }) => (
					<TouchableOpacity
						style={styles.card}
						onPress={() => navigation.navigate('CourseAssignmentList', {
							courseId: item.course_id,
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

// 3. Build the Stack Navigator for this specific tab
const Stack = createNativeStackNavigator();

export default function AssignmentsTab() {
	return (
		<Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
			<Stack.Screen
				name="ProfCourseList"
				component={ProfCourseListScreen}
				options={{ title: 'Select a Course' }}
			/>
			<Stack.Screen
				name="CourseAssignmentList"
				component={CourseAssignmentListScreen}
				options={({ route }: any) => ({ title: route.params?.courseName || 'Assignments' })}
			/>
			<Stack.Screen
				name="ProfAssignmentDetail"
				component={ProfAssignmentDetailScreen}
				options={{ title: 'Assignment Details' }}
			/>
			<Stack.Screen
				name="EvaluationReport"
				component={EvaluationReportScreen}
				options={{ title: 'AI Evaluation Report' }}
			/>
		</Stack.Navigator>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 15, backgroundColor: '#f4f6f8' },
	card: { backgroundColor: '#fff', padding: 20, borderRadius: 10, marginBottom: 15, elevation: 2, borderLeftWidth: 5, borderLeftColor: '#2b2d42' },
	courseName: { fontSize: 18, fontWeight: 'bold' },
	courseCode: { color: '#666', marginTop: 5 }
});