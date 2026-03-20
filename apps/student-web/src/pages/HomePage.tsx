// import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useAuthStore } from '../store/auth.store';
// import { StudentAPI, AttendanceAPI } from '../services/api';
// import { connectSocket, joinSession, leaveSession, onAttendanceStatusChanged, onManualOverride, onSessionEnded } from '../services/socket';
// import { D } from '../components/design-tokens';
// import { Button, StatusPill, notify } from '../components/ui';
// import type { NearbySession } from '../types';
// import { CHALLENGE_CONFIG } from '../constants';

// function fmtTimer(sec: number) {
//   const m = Math.floor(sec / 60), s = sec % 60;
//   return `${m}:${String(s).padStart(2, '0')}`;
// }

// // ── NEW: Strict Web Restriction Modal ──────────────────────────────────────────
// function WebRestrictionModal({ onClose }: { onClose: () => void }) {
//   return (
//     <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, animation: 'fadeIn 0.2s ease' }}>
//       <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 24, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
//         <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          
//           {/* Animated Icon Container */}
//           <div style={{ width: 72, height: 72, borderRadius: '50%', background: D.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 20, boxShadow: `0 0 0 8px rgba(239, 68, 68, 0.1)` }}>
//             📱
//           </div>

//           <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: D.textPrimary, margin: '0 0 12px 0' }}>
//             Action Prohibited
//           </h2>
          
//           <p style={{ fontSize: 14, color: D.textSecondary, lineHeight: 1.6, margin: '0 0 24px 0' }}>
//             Attendance can only be marked using the <b style={{ color: D.textPrimary }}>SmartAttend Mobile App</b>. Web-based verification is strictly disabled to maintain location and device integrity.
//           </p>

//           {/* Warning Banner */}
//           <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: `1px solid rgba(239, 68, 68, 0.2)`, borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left', marginBottom: 28, width: '100%' }}>
//             <span style={{ fontSize: 20, marginTop: 2 }}>⚠️</span>
//             <div>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: D.red, marginBottom: 4 }}>Security Warning</div>
//               <div style={{ fontSize: 12, color: D.red, opacity: 0.9, lineHeight: 1.5 }}>
//                 Further attempts to bypass the mobile app will be automatically logged and forwarded to your concerning professors.
//               </div>
//             </div>
//           </div>

//           <Button variant="primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: 15, background: D.textPrimary, borderColor: D.textPrimary }} onClick={onClose}>
//             I Understand
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ── Main HomePage ──────────────────────────────────────────────────────────────
// export default function HomePage() {
//   const navigate = useNavigate();
//   const { user, accessToken } = useAuthStore();
//   const [session, setSession]       = useState<NearbySession | null>(null);
//   const [locError, setLocError]     = useState('');
//   const [scanning, setScanning]     = useState(false);
  
//   // State for our new warning
//   const [showWebWarning, setShowWebWarning] = useState(false);
//   const [hoveringVerify, setHoveringVerify] = useState(false);

//   const [timeLeft, setTimeLeft]     = useState(0);
//   const timerRef = useRef<ReturnType<typeof setInterval>>();
//   const pingRef  = useRef<ReturnType<typeof setInterval>>();

//   const scanForSession = useCallback(async () => {
//     setScanning(true); setLocError('');
//     try {
//       const pos = await new Promise<GeolocationPosition>((res, rej) =>
//         navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
//       );
//       const { latitude: lat, longitude: lng, accuracy } = pos.coords;
//       await StudentAPI.pingLocation(lat, lng, accuracy);
//       const r = await AttendanceAPI.getNearbySession(lat, lng);
//       setSession(r.data.data);
//       if (!r.data.data) notify('No active session nearby', 'info');
//     } catch (err: any) {
//       if (err.code === 1) setLocError('Location permission denied. Enable GPS to detect nearby sessions.');
//       else if (err.code === 2) setLocError('Could not get your location. Check GPS signal.');
//       else setLocError('Failed to scan. Try again.');
//     } finally { setScanning(false); }
//   }, []);

//   useEffect(() => {
//     const pingOnce = async () => {
//       try {
//         const pos = await new Promise<GeolocationPosition>((res, rej) =>
//           navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
//         );
//         await StudentAPI.pingLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
//       } catch {}
//     };
//     pingOnce();
//     pingRef.current = setInterval(pingOnce, 60000);
//     return () => clearInterval(pingRef.current);
//   }, []);

//   useEffect(() => {
//     if (!session?.expires_at) return;
//     const update = () => {
//       const r = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
//       setTimeLeft(r);
//     };
//     update();
//     timerRef.current = setInterval(update, 1000);
//     return () => clearInterval(timerRef.current);
//   }, [session?.expires_at]);

//   useEffect(() => {
//     if (!session || !accessToken) return;
//     connectSocket(accessToken);
//     joinSession(session.session_id);

//     const unsubOverride = onManualOverride((data: any) => {
//       if (data.student_id === user?.student_id) {
//         setSession(prev => prev ? { ...prev, my_status: data.data.status, my_verification: 'VERIFIED' } : prev);
//         notify(`Professor updated your attendance: ${data.data.status}`);
//       }
//     });
//     const unsubStatus = onAttendanceStatusChanged((data: any) => {
//       if (data.session_id === session.session_id) {
//         setSession(prev => prev ? { ...prev, my_status: data.new_status } : prev);
//         notify(data.reason || 'Attendance status changed');
//       }
//     });
//     const unsubEnded = onSessionEnded(() => {
//       setSession(prev => prev ? { ...prev } : null);
//       notify('Session has ended', 'info');
//     });

//     return () => {
//       unsubOverride(); unsubStatus(); unsubEnded();
//       leaveSession(session.session_id);
//     };
//   }, [session?.session_id, accessToken]);

//   const isTimeLow   = timeLeft > 0 && timeLeft < 120;
//   const isPresent   = session?.my_status === 'PRESENT';
//   const canVerify   = session && !isPresent && session.my_verification !== 'VERIFIED' && timeLeft > 0;

//   return (
//     <div>
//       {/* Welcome */}
//       <div style={{ marginBottom: 24 }}>
//         <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800 }}>Hello, {user?.name?.split(' ')[0]} 👋</div>
//         <div style={{ fontSize: 13, color: D.textMuted, marginTop: 3 }}>{user?.roll_number} · Semester {user?.semester}</div>
//       </div>

//       {/* Session scanner */}
//       <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: 22, marginBottom: 20 }}>
//         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>📡 Session Radar</div>
//           <Button variant="secondary" size="sm" loading={scanning} onClick={scanForSession}>
//             {scanning ? 'Scanning…' : '🔍 Scan'}
//           </Button>
//         </div>

//         {locError && (
//           <div style={{ background: D.redLight, border: `1px solid rgba(239,68,68,.2)`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: D.red, marginBottom: 14 }}>
//             {locError}
//           </div>
//         )}

//         {!session ? (
//           <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 0', gap: 10, textAlign: 'center' }}>
//             <span style={{ fontSize: 36 }}>📍</span>
//             <div style={{ fontWeight: 600, fontSize: 14 }}>No active session nearby</div>
//             <div style={{ fontSize: 12, color: D.textMuted }}>Hit Scan when your professor starts attendance</div>
//           </div>
//         ) : (
//           <div style={{ animation: 'fadeIn .2s ease' }}>
//             <div style={{ background: D.surface2, borderRadius: 12, padding: 16, marginBottom: 14, borderLeft: `4px solid ${isPresent ? D.green : D.accent}` }}>
//               <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
//                 <div>
//                   <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{session.course_name}</div>
//                   <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>Prof. {session.professor_name} · {session.code}</div>
//                 </div>
//                 {session.my_status && <StatusPill status={session.my_status} />}
//               </div>

//               {/* Timer */}
//               <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
//                 <div style={{ background: isTimeLow ? D.redLight : D.surface3, border: `1px solid ${isTimeLow ? 'rgba(239,68,68,.2)' : D.border}`, borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
//                   <span style={{ fontSize: 12 }}>⏱</span>
//                   <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: isTimeLow ? D.red : D.textPrimary, letterSpacing: 1 }}>{fmtTimer(timeLeft)}</span>
//                 </div>
//               </div>
//             </div>

//             {/* UPDATED Action button with Hover & Click Warning */}
//             {isPresent ? (
//               <div style={{ background: D.greenLight, borderRadius: 12, padding: '14px', textAlign: 'center', border: '1px solid rgba(34,197,94,.2)' }}>
//                 <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: D.green }}>✅ Attendance Verified</div>
//                 <div style={{ fontSize: 12, color: D.textMuted, marginTop: 4 }}>You're marked present for this session</div>
//               </div>
//             ) : canVerify ? (
//               <Button 
//                 variant="primary" 
//                 style={{ 
//                   width: '100%', 
//                   justifyContent: 'center', 
//                   padding: '13px', 
//                   fontSize: 15,
//                   backgroundColor: hoveringVerify ? D.red : undefined,
//                   borderColor: hoveringVerify ? D.red : undefined,
//                   transition: 'all 0.2s ease'
//                 }} 
//                 onMouseEnter={() => setHoveringVerify(true)}
//                 onMouseLeave={() => setHoveringVerify(false)}
//                 onClick={() => setShowWebWarning(true)}
//               >
//                 {hoveringVerify ? '⚠️ Open Mobile App Required' : '📸 Verify My Attendance'}
//               </Button>
//             ) : timeLeft === 0 ? (
//               <div style={{ background: D.surface2, borderRadius: 12, padding: '12px', textAlign: 'center', color: D.textMuted, fontSize: 13 }}>
//                 ⏰ Session time expired
//               </div>
//             ) : null}
//           </div>
//         )}
//       </div>

//       {/* Quick links */}
//       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
//         {[
//           { icon: '📋', label: 'My Attendance', sub: 'View history', onClick: () => navigate('/attendance') },
//           { icon: '📝', label: 'Assignments', sub: 'View & submit', onClick: () => navigate('/assignments') },
//           { icon: '👤', label: 'Profile', sub: 'Settings & face ID', onClick: () => navigate('/profile') },
//         ].map(q => (
//           <div key={q.label} onClick={q.onClick} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: '16px', cursor: 'pointer', transition: 'border-color .15s' }}>
//             <div style={{ fontSize: 24, marginBottom: 8 }}>{q.icon}</div>
//             <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>{q.label}</div>
//             <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{q.sub}</div>
//           </div>
//         ))}
//       </div>

//       {/* Render the new warning modal when clicked */}
//       {showWebWarning && (
//         <WebRestrictionModal onClose={() => setShowWebWarning(false)} />
//       )}
//     </div>
//   );
// }
















import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { StudentAPI, AttendanceAPI } from '../services/api';
import { connectSocket, joinSession, leaveSession, onAttendanceStatusChanged, onManualOverride, onSessionEnded } from '../services/socket';
import { D } from '../components/design-tokens';
import { Button, StatusPill, notify } from '../components/ui';
import type { NearbySession } from '../types';

function fmtTimer(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const css = `
@keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes radarPing {
  0%   { transform: scale(1); opacity: .8; }
  70%  { transform: scale(2.4); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes timerPulse {
  0%,100% { box-shadow: 0 0 0 3px rgba(239,68,68,.15); }
  50%     { box-shadow: 0 0 0 7px rgba(239,68,68,.05); }
}
@keyframes presenceGlow {
  0%,100% { box-shadow: 0 0 0 4px rgba(34,197,94,.15); }
  50%     { box-shadow: 0 0 0 10px rgba(34,197,94,.04); }
}
.st-home-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(16px);
  border: 1px solid rgba(99,102,241,.16); border-radius: 18px;
  box-shadow: 0 4px 20px rgba(99,102,241,.08);
  transition: all .18s;
}
.st-quick-card {
  background: rgba(255,255,255,.82); backdrop-filter: blur(16px);
  border: 1px solid rgba(99,102,241,.14); border-radius: 16px;
  padding: 18px; cursor: pointer;
  transition: all .18s;
  box-shadow: 0 2px 10px rgba(99,102,241,.06);
  position: relative; overflow: hidden;
}
.st-quick-card:hover {
  border-color: rgba(99,102,241,.32);
  box-shadow: 0 6px 22px rgba(99,102,241,.13);
  transform: translateY(-2px);
}
.st-quick-card-shimmer {
  position: absolute; top: 0; right: 0;
  width: 70px; height: 70px;
  background: radial-gradient(circle, rgba(99,102,241,.09) 0%, transparent 70%);
  pointer-events: none;
}
.st-scan-btn {
  padding: 7px 14px; border-radius: 10px; font-size: 12.5px;
  font-weight: 600; cursor: pointer; transition: all .15s;
  display: inline-flex; align-items: center; gap: 6;
  background: rgba(255,255,255,.75); backdrop-filter: blur(8px);
  border: 1px solid rgba(99,102,241,.22); color: #4338ca;
  font-family: 'DM Sans', sans-serif;
}
.st-scan-btn:hover { background: rgba(99,102,241,.1); }
.st-scan-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Session card border accent */
.st-session-inner {
  border-radius: 14px; padding: 18px; margin-bottom: 14px;
  background: rgba(99,102,241,.04);
  border: 1px solid rgba(99,102,241,.14);
  border-left: 4px solid #6366f1;
  transition: border-left-color .3s;
}
.st-session-inner.present { border-left-color: #22c55e; background: rgba(34,197,94,.04); border-color: rgba(34,197,94,.18); }
`;

// ── Web Restriction Modal ─────────────────────────────────────────────────────
function WebRestrictionModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(30,27,75,.6)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20, animation: 'fadeIn .2s ease',
      }}>
      <div style={{
        background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(99,102,241,.18)', borderRadius: 24,
        width: '100%', maxWidth: 420, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(30,27,75,.22)',
        animation: 'slideUp .22s ease',
      }}>
        <div style={{ padding: '32px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

          {/* Icon */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', marginBottom: 20,
            background: 'rgba(239,68,68,.1)', border: '2px solid rgba(239,68,68,.2)',
            boxShadow: '0 0 0 8px rgba(239,68,68,.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
          }}>📱</div>

          <div style={{
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22,
            color: '#1e1b4b', marginBottom: 12,
          }}>Action Prohibited</div>

          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, marginBottom: 22 }}>
            Attendance can only be marked using the{' '}
            <strong style={{ color: '#1e1b4b' }}>SmartAttend Mobile App</strong>.
            Web-based verification is strictly disabled to maintain location and device integrity.
          </p>

          {/* Warning banner */}
          <div style={{
            background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 12, padding: '13px 16px',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            textAlign: 'left', marginBottom: 26, width: '100%',
          }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 12.5, color: '#dc2626', marginBottom: 3 }}>
                Security Warning
              </div>
              <div style={{ fontSize: 12, color: '#dc2626', opacity: .9, lineHeight: 1.55 }}>
                Further attempts to bypass the mobile app will be automatically logged and forwarded to your concerning professors.
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, background: '#1e1b4b' }}
            onClick={onClose}>
            I Understand
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main HomePage ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const [session, setSession]     = useState<NearbySession | null>(null);
  const [locError, setLocError]   = useState('');
  const [scanning, setScanning]   = useState(false);
  const [showWebWarning, setShowWebWarning] = useState(false);
  const [hoveringVerify, setHoveringVerify] = useState(false);
  const [timeLeft, setTimeLeft]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const pingRef  = useRef<ReturnType<typeof setInterval>>();

  const scanForSession = useCallback(async () => {
    setScanning(true); setLocError('');
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      await StudentAPI.pingLocation(lat, lng, accuracy);
      const r = await AttendanceAPI.getNearbySession(lat, lng);
      setSession(r.data.data);
      if (!r.data.data) notify('No active session nearby', 'info');
    } catch (err: any) {
      if (err.code === 1) setLocError('Location permission denied. Enable GPS to detect nearby sessions.');
      else if (err.code === 2) setLocError('Could not get your location. Check GPS signal.');
      else setLocError('Failed to scan. Try again.');
    } finally { setScanning(false); }
  }, []);

  // Background location ping
  useEffect(() => {
    const pingOnce = async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
        );
        await StudentAPI.pingLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      } catch {}
    };
    pingOnce();
    pingRef.current = setInterval(pingOnce, 60000);
    return () => clearInterval(pingRef.current);
  }, []);

  // Session countdown
  useEffect(() => {
    if (!session?.expires_at) return;
    const update = () => {
      const r = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(r);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [session?.expires_at]);

  // Socket
  useEffect(() => {
    if (!session || !accessToken) return;
    connectSocket(accessToken);
    joinSession(session.session_id);
    const unsubOverride = onManualOverride((data: any) => {
      if (data.student_id === user?.student_id) {
        setSession(prev => prev ? { ...prev, my_status: data.data.status, my_verification: 'VERIFIED' } : prev);
        notify(`Professor updated your attendance: ${data.data.status}`);
      }
    });
    const unsubStatus = onAttendanceStatusChanged((data: any) => {
      if (data.session_id === session.session_id) {
        setSession(prev => prev ? { ...prev, my_status: data.new_status } : prev);
        notify(data.reason || 'Attendance status changed');
      }
    });
    const unsubEnded = onSessionEnded(() => {
      notify('Session has ended', 'info');
    });
    return () => { unsubOverride(); unsubStatus(); unsubEnded(); leaveSession(session.session_id); };
  }, [session?.session_id, accessToken]);

  const isTimeLow = timeLeft > 0 && timeLeft < 120;
  const isPresent = session?.my_status === 'PRESENT';
  const canVerify = session && !isPresent && session.my_verification !== 'VERIFIED' && timeLeft > 0;

  return (
    <>
      <style>{css}</style>

      {/* ── Welcome header ── */}
      <div style={{ marginBottom: 26 }}>
        <div style={{
          fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800,
          color: '#1e1b4b', letterSpacing: '-.4px',
        }}>
          Hello, {user?.name?.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
          <span style={{ fontWeight: 600, color: '#6366f1' }}>{user?.roll_number}</span>
          {' · '}Semester {user?.semester}
        </div>
      </div>

      {/* ── Session Radar card ── */}
      <div className="st-home-card" style={{ padding: 22, marginBottom: 20 }}>

        {/* Card header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: '#1e1b4b',
            }}>📡 Session Radar</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Scan for active attendance sessions near you
            </div>
          </div>
          <button
            className="st-scan-btn"
            disabled={scanning}
            onClick={scanForSession}>
            {scanning ? (
              <>
                <span style={{
                  width: 12, height: 12, border: '2px solid rgba(99,102,241,.3)', borderTopColor: '#6366f1',
                  borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block',
                }}/>
                Scanning…
              </>
            ) : '🔍 Scan'}
          </button>
        </div>

        {/* Location error */}
        {locError && (
          <div style={{
            background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 10, padding: '10px 14px', fontSize: 12.5,
            color: '#dc2626', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            ⚠️ {locError}
          </div>
        )}

        {/* Empty state */}
        {!session ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '28px 0 10px', gap: 10, textAlign: 'center',
          }}>
            {/* Radar animation */}
            <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 4 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>📍</div>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(99,102,241,.08)',
                animation: 'radarPing 2.5s ease-out infinite',
              }}/>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(99,102,241,.05)',
                animation: 'radarPing 2.5s ease-out .8s infinite',
              }}/>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e1b4b' }}>No active session nearby</div>
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Hit Scan when your professor starts attendance</div>
          </div>
        ) : (
          <div style={{ animation: 'slideUp .2s ease' }}>
            {/* Session info */}
            <div className={`st-session-inner${isPresent ? ' present' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15, color: '#1e1b4b' }}>
                    {session.course_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    Prof. {session.professor_name} · {session.code}
                  </div>
                </div>
                {session.my_status && <StatusPill status={session.my_status}/>}
              </div>

              {/* Timer */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: isTimeLow ? 'rgba(239,68,68,.08)' : 'rgba(99,102,241,.07)',
                  border: `1px solid ${isTimeLow ? 'rgba(239,68,68,.22)' : 'rgba(99,102,241,.18)'}`,
                  borderRadius: 9, padding: '6px 13px',
                  animation: isTimeLow ? 'timerPulse 1.5s ease-in-out infinite' : 'none',
                }}>
                  <span style={{ fontSize: 13 }}>⏱</span>
                  <span style={{
                    fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15,
                    color: isTimeLow ? '#dc2626' : '#4338ca', letterSpacing: 1,
                  }}>{fmtTimer(timeLeft)}</span>
                </div>
              </div>
            </div>

            {/* Action */}
            {isPresent ? (
              <div style={{
                background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.22)',
                borderRadius: 14, padding: '16px', textAlign: 'center',
                animation: 'presenceGlow 2.5s ease-in-out infinite',
              }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: '#15803d' }}>
                  ✅ Attendance Verified
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                  You're marked present for this session
                </div>
              </div>
            ) : canVerify ? (
              <button
                onMouseEnter={() => setHoveringVerify(true)}
                onMouseLeave={() => setHoveringVerify(false)}
                onClick={() => setShowWebWarning(true)}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: hoveringVerify
                    ? 'rgba(239,68,68,.1)'
                    : 'rgba(99,102,241,.1)',
                  border: `1.5px solid ${hoveringVerify ? 'rgba(239,68,68,.3)' : 'rgba(99,102,241,.25)'}`,
                  color: hoveringVerify ? '#dc2626' : '#4338ca',
                  fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 15,
                  cursor: 'pointer', transition: 'all .2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                {hoveringVerify ? '⚠️ Open Mobile App Required' : '📸 Verify My Attendance'}
              </button>
            ) : timeLeft === 0 ? (
              <div style={{
                background: 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.12)',
                borderRadius: 12, padding: '13px', textAlign: 'center',
                color: '#9ca3af', fontSize: 13, fontWeight: 600,
              }}>
                ⏰ Session time expired
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Quick links grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 14,
      }}>
        {[
          {
            icon: '📋', label: 'My Attendance', sub: 'View history',
            color: '#6366f1', bg: 'rgba(99,102,241,.1)',
            onClick: () => navigate('/attendance'),
          },
          {
            icon: '📝', label: 'Assignments', sub: 'View & submit',
            color: '#22c55e', bg: 'rgba(34,197,94,.1)',
            onClick: () => navigate('/assignments'),
          },
          {
            icon: '👤', label: 'Profile', sub: 'Settings & face ID',
            color: '#a855f7', bg: 'rgba(168,85,247,.1)',
            onClick: () => navigate('/profile'),
          },
        ].map(q => (
          <div key={q.label} className="st-quick-card" onClick={q.onClick}>
            <div className="st-quick-card-shimmer"/>
            <div style={{
              width: 42, height: 42, borderRadius: 12, marginBottom: 12,
              background: q.bg, border: `1px solid ${q.color}28`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>{q.icon}</div>
            <div style={{
              fontFamily: "'Syne',sans-serif", fontWeight: 800,
              fontSize: 13.5, color: '#1e1b4b', marginBottom: 3,
            }}>{q.label}</div>
            <div style={{ fontSize: 11.5, color: '#9ca3af' }}>{q.sub}</div>
            <div style={{
              position: 'absolute', bottom: 14, right: 14,
              fontSize: 16, color: q.color, opacity: .4,
            }}>→</div>
          </div>
        ))}
      </div>

      {showWebWarning && <WebRestrictionModal onClose={() => setShowWebWarning(false)}/>}
    </>
  );
}