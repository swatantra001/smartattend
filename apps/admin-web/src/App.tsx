import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import DeviceResetsPage from './pages/DeviceResetsPage';
import StudentsPage from './pages/StudentsPage';
import ProfessorsPage from './pages/ProfessorsPage';
import CoursesPage from './pages/CoursesPage';
import ReportsPage from './pages/ReportsPage';
import AuditPage from './pages/AuditPage';
import DashboardPage from './pages/DashboardPage';
import FaceResetsPage from './pages/FaceResetsPage';
import { LoadingScreen } from './components/loadingScreen';
import DepartmentsPage from './pages/DepartmentsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

const styles = {
  loading: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
} as const;

export default function App() {
  const { loadFromStorage, isInitialized, isAuthenticated } = useAuthStore();
  const location = useLocation(); // Get current URL

    useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  if (!isAuthenticated && location.pathname !== '/login') {
    // If not authenticated and not already on login page, redirect to login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isInitialized) {
    return <LoadingScreen />
  }



  // if (!isAuthenticated) {
  //   // Save where the user was trying to go in 'state'
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"     element={<DashboardPage />} />
        <Route path="device-resets" element={<DeviceResetsPage />} />
        <Route path="face-resets"   element={<FaceResetsPage />} />
        <Route path="students"      element={<StudentsPage />} />
        <Route path="professors"    element={<ProfessorsPage />} />
        <Route path="departments"   element={<DepartmentsPage />} />
        <Route path="courses"       element={<CoursesPage />} />
        <Route path="reports"       element={<ReportsPage />} />
        <Route path="audit"         element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}