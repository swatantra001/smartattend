import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { connectSocket } from './services/socket';

import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import SessionsPage from './pages/SessionsPage';
import ReportsPage from './pages/ReportsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import AssignCoursesPage from './pages/AssignCoursesPage';
import ManageStudentsPage from './pages/ManageStudentsPage';
import ProfilePage from './pages/ProfilePage';
import { LoadingScreen } from './components/ui';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadFromStorage, isInitialized, isAuthenticated, accessToken } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    loadFromStorage();
  }, []);

  // Reconnect socket when app starts with an existing token
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      connectSocket(accessToken);
    }
  }, [isAuthenticated, accessToken]);

  if (!isInitialized) return <LoadingScreen />;

  // Redirect to login if not authenticated (except on /login)
  if (!isAuthenticated && location.pathname !== '/login') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

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
        <Route index element={<HomePage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="assign-courses" element={<AssignCoursesPage />} />
        <Route path="manage-students/:courseId" element={<ManageStudentsPage />} />
        <Route path="dashboard/:sessionId" element={<DashboardPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}