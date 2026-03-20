import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { AuthAPI, StudentAPI } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { D } from '../components/design-tokens';
import { Button, Badge, notify } from '../components/ui';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

  const [deviceModal,  setDeviceModal]  = useState(false);
  const [faceModal,    setFaceModal]    = useState(false);
  const [deviceReason, setDeviceReason] = useState('');
  const [faceReason,   setFaceReason]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  async function handleLogout() {
    if (!confirm('Log out of SmartAttend?')) return;
    try { await AuthAPI.logout(user!.user_id); } catch {}
    disconnectSocket();
    clearAuth();
    navigate('/login', { replace: true });
  }

  async function handleDeviceReset(e: React.FormEvent) {
    e.preventDefault();
    if (deviceReason.trim().length < 10) { notify('Reason must be at least 10 characters', 'error'); return; }
    setSubmitting(true);
    try {
      await StudentAPI.requestDeviceReset(deviceReason.trim());
      notify('Device reset request submitted — admin will review within 24 hours');
      setDeviceModal(false); setDeviceReason('');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Request failed', 'error');
    } finally { setSubmitting(false); }
  }

  async function handleFaceReset(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm('Request face data wipe? You will need to re-enroll after admin approval.')) return;
    setSubmitting(true);
    try {
      await StudentAPI.requestFaceReset();
      notify('Face reset request submitted');
      setFaceModal(false); setFaceReason('');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Request failed', 'error');
    } finally { setSubmitting(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: D.surface2,
    border: `1px solid ${D.border}`, borderRadius: 9, color: D.textPrimary,
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
  };

  const fields = [
    ['Full Name', user?.name],
    ['Email', user?.email],
    ['Roll Number', user?.roll_number],
    ['Semester', `Semester ${user?.semester}`],
    ['Face Enrollment', user?.face_enrolled_at
      ? `✅ ${new Date(user.face_enrolled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
      : '❌ Not enrolled'],
  ];

  return (
    <div style={{ maxWidth: 540 }}>
      {/* Avatar card */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(79,127,255,.15), rgba(34,197,94,.1))', padding: '28px 24px', display: 'flex', alignItems: 'center', gap: 18, borderBottom: `1px solid ${D.border}` }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#4f7fff,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19 }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: D.textSecondary, marginTop: 3 }}>Student · {user?.roll_number}</div>
          </div>
        </div>

        {/* Info rows */}
        <div>
          {fields.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderBottom: `1px solid ${D.border}` }}>
              <span style={{ fontSize: 13, color: D.textSecondary }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary }}>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Face enrollment notice */}
      {!user?.face_enrolled_at && (
        <div style={{ background: D.amberLight, border: '1px solid rgba(245,158,11,.2)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>📷 Face Not Enrolled</div>
          <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 12 }}>
            You need to enroll your face on the mobile app before you can verify attendance. The face enrollment process requires a camera-equipped device with the SmartAttend student mobile app.
          </div>
          <div style={{ fontSize: 12, color: D.amber, fontWeight: 600 }}>Use the SmartAttend mobile app to complete face enrollment.</div>
        </div>
      )}

      {/* Actions */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${D.border}`, fontSize: 11, fontWeight: 700, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '.08em' }}>Actions</div>
        {[
          {
            icon: '📱', label: 'Request Device Reset', sub: 'Changed your phone?',
            color: D.textSecondary, onClick: () => setDeviceModal(true),
          },
          user?.face_enrolled_at ? {
            icon: '📷', label: 'Request Face Reset', sub: 'Update your face data',
            color: D.textSecondary, onClick: () => setFaceModal(true),
          } : null,
          {
            icon: '🚪', label: 'Log Out', sub: 'Sign out of your account',
            color: D.red, onClick: handleLogout,
          },
        ].filter(Boolean).map(action => (
          <button key={action!.label} onClick={action!.onClick} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
            background: 'none', border: 'none', borderBottom: `1px solid ${D.border}`,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <span style={{ fontSize: 20 }}>{action!.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: action!.color }}>{action!.label}</div>
              <div style={{ fontSize: 12, color: D.textMuted }}>{action!.sub}</div>
            </div>
            <span style={{ color: action!.color, fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>

      <div style={{ textAlign: 'center', color: D.textMuted, fontSize: 12 }}>SmartAttend Student Web v1.0</div>

      {/* Device Reset Modal */}
      {deviceModal && (
        <div onClick={e => e.target === e.currentTarget && setDeviceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, flex: 1 }}>Request Device Reset</div>
              <button onClick={() => setDeviceModal(false)} style={{ background: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleDeviceReset}>
              <div style={{ padding: 22 }}>
                <div style={{ background: D.amberLight, border: '1px solid rgba(245,158,11,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: D.amber, marginBottom: 16 }}>
                  ⚠️ Max 2 device resets per semester. Make sure you are using the new device when submitting.
                </div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, display: 'block', marginBottom: 6 }}>Reason *</label>
                <textarea value={deviceReason} onChange={e => setDeviceReason(e.target.value)} placeholder="e.g. I bought a new phone and my old device is no longer accessible..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }} />
              </div>
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" type="button" onClick={() => setDeviceModal(false)}>Cancel</Button>
                <Button variant="primary" type="submit" loading={submitting}>Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Face Reset Modal */}
      {faceModal && (
        <div onClick={e => e.target === e.currentTarget && setFaceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, width: '100%', maxWidth: 480 }}>
            <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, flex: 1 }}>Request Face Reset</div>
              <button onClick={() => setFaceModal(false)} style={{ background: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <form onSubmit={handleFaceReset}>
              <div style={{ padding: 22 }}>
                <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 14, lineHeight: 1.6 }}>
                  Once approved by an admin, your current face data will be permanently deleted and you will need to re-enroll using the mobile app.
                </div>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, display: 'block', marginBottom: 6 }}>Reason</label>
                <textarea value={faceReason} onChange={e => setFaceReason(e.target.value)} placeholder="e.g. I enrolled with glasses on and face verification keeps failing..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
              </div>
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" type="button" onClick={() => setFaceModal(false)}>Cancel</Button>
                <Button variant="danger" type="submit" loading={submitting}>Submit Request</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}