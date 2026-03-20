import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { AuthAPI } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { D } from '../components/design-tokens';
import { Button, notify } from '../components/ui';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  async function handleLogout() {
    if (!confirm('Log out of SmartAttend?')) return;
    try { await AuthAPI.logout(user!.user_id); } catch {}
    disconnectSocket();
    clearAuth();
    navigate('/login', { replace: true });
  }

  const fields = [
    ['Full Name', user?.name],
    ['Email Address', user?.email],
    ['Employee Code', user?.employee_code],
    ['Role', 'Professor'],
    ['College ID', user?.college_id],
  ];

  return (
    <div style={{ maxWidth: 520 }}>
      {/* Avatar card */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(79,127,255,.15), rgba(168,85,247,.1))', padding: '28px 24px', display: 'flex', alignItems: 'center', gap: 18, borderBottom: `1px solid ${D.border}` }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'linear-gradient(135deg, #4f7fff, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: D.textSecondary, marginTop: 4 }}>Professor · {user?.employee_code}</div>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: '8px 0' }}>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${D.border}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary, maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <Button variant="danger" style={{ width: '100%', padding: '12px', justifyContent: 'center', fontSize: 14 }} onClick={handleLogout}>
        🚪 Log Out
      </Button>

      <div style={{ textAlign: 'center', color: D.textMuted, fontSize: 12, marginTop: 20 }}>
        SmartAttend Professor Web v1.0
      </div>
    </div>
  );
}