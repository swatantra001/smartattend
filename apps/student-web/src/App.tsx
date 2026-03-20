import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { connectSocket } from './services/socket';

import LoginPage       from './pages/LoginPage';
import Layout          from './components/Layout';
import HomePage        from './pages/HomePage';
import AttendancePage  from './pages/AttendancePage';
import AssignmentsPage from './pages/AssignmentsPage';
import ProfilePage     from './pages/ProfilePage';
import { LoadingScreen } from './components/loadingScreen';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

export default function App() {
  const { loadFromStorage, isInitialized, isAuthenticated, accessToken } = useAuthStore();
  const location = useLocation();

  useEffect(() => { loadFromStorage(); }, []);

  useEffect(() => {
    if (isAuthenticated && accessToken) connectSocket(accessToken);
  }, [isAuthenticated, accessToken]);

  if (!isInitialized) return <LoadingScreen />;

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
        <Route index        element={<HomePage />} />
        <Route path="attendance"  element={<AttendancePage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="profile"     element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}