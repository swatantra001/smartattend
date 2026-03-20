import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Import your existing screens
import CourseListScreen from '../../screens/CourseListScreen';
import AssignmentListScreen from '../../screens/AssignmentListScreen';
import AssignmentDetailScreen from '../../screens/AssignmentDetailScreen';

const Stack = createNativeStackNavigator();

export default function StudentAssignmentsTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen 
        name="Courses" 
        component={CourseListScreen} 
        options={{ title: 'My Courses' }} 
      />
      <Stack.Screen 
        name="AssignmentList" 
        component={AssignmentListScreen} 
        options={({ route }: any) => ({ title: route.params?.courseName || 'Assignments' })} 
      />
      <Stack.Screen 
        name="AssignmentDetail" 
        component={AssignmentDetailScreen} 
        options={{ title: 'Assignment Details' }} 
      />
    </Stack.Navigator>
  );
}