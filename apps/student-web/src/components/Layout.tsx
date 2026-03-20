// import React, { useState } from 'react';
// import { Outlet, NavLink, useNavigate } from 'react-router-dom';
// import { useAuthStore } from '../store/auth.store';
// import { AuthAPI } from '../services/api';
// import { disconnectSocket } from '../services/socket';
// import { D } from './design-tokens';
// import { Notifications } from './ui';

// const NAV = [
//   { to: '/',            label: 'Home',        icon: '🏠' },
//   { to: '/attendance',  label: 'Attendance',  icon: '📋' },
//   { to: '/assignments', label: 'Assignments', icon: '📝' },
//   { to: '/profile',     label: 'Profile',     icon: '👤' },
// ];

// export default function Layout() {
//   const { user, clearAuth } = useAuthStore();
//   const navigate = useNavigate();
//   const [collapsed, setCollapsed] = useState(false);

//   async function handleLogout() {
//     if (!confirm('Log out?')) return;
//     try { await AuthAPI.logout(user!.user_id); } catch {}
//     disconnectSocket();
//     clearAuth();
//     navigate('/login', { replace: true });
//   }

//   return (
//     <div style={{ display: 'flex', height: '100vh', background: D.bg, overflow: 'hidden' }}>
//       {/* Sidebar */}
//       <div style={{
//         width: collapsed ? 60 : 220, flexShrink: 0, background: D.surface,
//         borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column',
//         transition: 'width .2s ease', overflow: 'hidden',
//       }}>
//         {/* Logo */}
//         <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
//           <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#4f7fff,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎓</div>
//           {!collapsed && <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: D.textPrimary, whiteSpace: 'nowrap' }}>SmartAttend</div>}
//         </div>

//         {/* User card */}
//         {!collapsed && user && (
//           <div style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, background: 'rgba(79,127,255,.04)' }}>
//             <div style={{ fontSize: 13, fontWeight: 700, color: D.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
//             <div style={{ fontSize: 11, color: D.textMuted, marginTop: 1 }}>{user.roll_number} · Sem {user.semester}</div>
//             {user.face_enrolled_at
//               ? <div style={{ fontSize: 10, color: D.green, marginTop: 3, fontWeight: 600 }}>✅ Face Enrolled</div>
//               : <div style={{ fontSize: 10, color: D.amber, marginTop: 3, fontWeight: 600 }}>⚠️ Face Not Enrolled</div>
//             }
//           </div>
//         )}

//         {/* Nav */}
//         <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
//           {NAV.map(n => (
//             <NavLink key={n.to} to={n.to} end={n.to === '/'}>
//               {({ isActive }) => (
//                 <div style={{
//                   display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px' : '10px 12px',
//                   borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
//                   justifyContent: collapsed ? 'center' : 'flex-start',
//                   background: isActive ? D.accentLight : 'transparent',
//                   color: isActive ? D.accent : D.textSecondary,
//                   border: `1px solid ${isActive ? 'rgba(79,127,255,.15)' : 'transparent'}`,
//                 }}>
//                   <span style={{ fontSize: 17, flexShrink: 0 }}>{n.icon}</span>
//                   {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>}
//                 </div>
//               )}
//             </NavLink>
//           ))}
//         </nav>

//         {/* Bottom actions */}
//         <div style={{ padding: '10px 8px', borderTop: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
//           <button onClick={() => setCollapsed(c => !c)} style={{
//             display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
//             padding: collapsed ? '10px' : '10px 12px', borderRadius: 9, background: 'none', border: 'none',
//             color: D.textMuted, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit',
//           }}>
//             <span style={{ fontSize: 16 }}>{collapsed ? '▶' : '◀'}</span>
//             {!collapsed && 'Collapse'}
//           </button>
//           <button onClick={handleLogout} style={{
//             display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
//             padding: collapsed ? '10px' : '10px 12px', borderRadius: 9, background: 'none', border: 'none',
//             color: D.red, fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%', fontFamily: 'inherit',
//           }}>
//             <span style={{ fontSize: 16 }}>🚪</span>
//             {!collapsed && 'Log Out'}
//           </button>
//         </div>
//       </div>

//       {/* Main content */}
//       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//         {/* Topbar */}
//         <div style={{ height: 56, borderBottom: `1px solid ${D.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', background: D.surface, flexShrink: 0 }}>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, flex: 1, color: D.textPrimary }}>
//             Student Portal
//           </div>
//           {user?.roll_number && (
//             <div style={{ fontSize: 12, color: D.textMuted }}>{user.roll_number}</div>
//           )}
//         </div>
//         {/* Page */}
//         <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
//           <Outlet />
//         </div>
//       </div>

//       <Notifications />
//     </div>
//   );
// }










import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { AuthAPI } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { D } from './design-tokens';
import { Notifications } from './ui';

const NAV = [
  { to: '/',            label: 'Home',        icon: '🏠' },
  { to: '/attendance',  label: 'Attendance',  icon: '📋' },
  { to: '/assignments', label: 'Assignments', icon: '📝' },
  { to: '/profile',     label: 'Profile',     icon: '👤' },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; }

/* ── Animated background ── */
.st-layout-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 70% -5%, rgba(99,102,241,.11) 0%, transparent 55%),
    radial-gradient(ellipse 55% 45% at 0% 90%, rgba(34,197,94,.08) 0%, transparent 50%),
    radial-gradient(ellipse 40% 35% at 90% 80%, rgba(168,85,247,.06) 0%, transparent 45%),
    #f0f1ff;
}
.st-orb {
  position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
}
.st-orb1 {
  width: 500px; height: 500px; top: -180px; right: 40px;
  background: radial-gradient(circle, rgba(99,102,241,.13) 0%, rgba(99,102,241,.02) 55%, transparent 70%);
  animation: stOrb1 18s ease-in-out infinite;
}
.st-orb2 {
  width: 360px; height: 360px; bottom: -110px; left: 200px;
  background: radial-gradient(circle, rgba(34,197,94,.09) 0%, rgba(34,197,94,.01) 55%, transparent 70%);
  animation: stOrb2 22s ease-in-out infinite;
}
.st-orb3 {
  width: 220px; height: 220px; top: 45%; right: 18%;
  background: radial-gradient(circle, rgba(168,85,247,.06) 0%, transparent 65%);
  animation: stOrb3 26s ease-in-out infinite;
}
@keyframes stOrb1 {
  0%,100%{ transform: translate(0,0) scale(1); }
  33%    { transform: translate(-20px, 36px) scale(1.04); }
  66%    { transform: translate(15px, -18px) scale(.97); }
}
@keyframes stOrb2 {
  0%,100%{ transform: translate(0,0) scale(1); }
  50%    { transform: translate(28px, -24px) scale(1.06); }
}
@keyframes stOrb3 {
  0%,100%{ transform: translate(0,0) scale(1); }
  40%    { transform: translate(-14px, 20px) scale(1.08); }
  70%    { transform: translate(10px,-10px) scale(.95); }
}

/* ── Dot grid ── */
.st-grid {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(99,102,241,.16) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 80%);
}

/* ── Sidebar ── */
.st-sidebar {
  position: relative; z-index: 10; flex-shrink: 0;
  display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(99,102,241,.15);
  box-shadow: 2px 0 24px rgba(99,102,241,.08);
  transition: width .2s ease;
}

/* ── Logo block ── */
.st-logo-block {
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(99,102,241,.12);
}
.st-logo-inner {
  display: flex; align-items: center; gap: 10px;
}
.st-logo-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1, #22c55e);
  display: flex; align-items: center; justify-content: center; font-size: 16px;
  box-shadow: 0 4px 12px rgba(99,102,241,.35);
}
.st-logo-text {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 14px;
  color: #1e1b4b; white-space: nowrap;
}
.st-logo-sub {
  font-size: 10px; color: #6366f1; font-weight: 600;
  letter-spacing: .08em; text-transform: uppercase;
  margin-top: 5px; padding-left: 44px;
}

/* ── User card ── */
.st-user-card {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(99,102,241,.10);
  background: rgba(99,102,241,.04);
}
.st-user-name {
  font-size: 13px; font-weight: 700; color: #1e1b4b;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.st-user-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
.st-face-badge {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; margin-top: 5px;
  padding: 2px 8px; border-radius: 99px;
}
.st-face-badge.enrolled {
  background: rgba(34,197,94,.12); color: #15803d;
  border: 1px solid rgba(34,197,94,.2);
}
.st-face-badge.not-enrolled {
  background: rgba(245,158,11,.12); color: #92400e;
  border: 1px solid rgba(245,158,11,.2);
}

/* ── Nav ── */
.st-nav { flex: 1; padding: 10px 8px; display: flex; flex-direction: column; gap: 2; }
.st-nav-label {
  font-size: 10px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(99,102,241,.6);
  padding: 10px 8px 5px;
}
.st-nav-item {
  display: flex; align-items: center; gap: 10px;
  border-radius: 10px; font-size: 13.5px; font-weight: 500;
  cursor: pointer; transition: all .15s; color: #4b5563;
  text-decoration: none; position: relative; overflow: hidden;
}
.st-nav-item:hover { background: rgba(99,102,241,.08); color: #1e1b4b; }
.st-nav-item.active {
  background: rgba(99,102,241,.12); color: #4338ca; font-weight: 600;
}
.st-nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
  width: 3px; border-radius: 0 3px 3px 0;
  background: linear-gradient(180deg, #6366f1, #22c55e);
}
.st-nav-icon {
  font-size: 17px; flex-shrink: 0;
}

/* ── Bottom actions ── */
.st-bottom { padding: 10px 8px; border-top: 1px solid rgba(99,102,241,.10); display: flex; flex-direction: column; gap: 3; }
.st-bottom-btn {
  display: flex; align-items: center; gap: 10px;
  border-radius: 10px; background: none; border: none;
  font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
  cursor: pointer; width: 100%; transition: all .14s;
}
.st-bottom-btn.collapse { color: #9ca3af; }
.st-bottom-btn.collapse:hover { background: rgba(99,102,241,.07); color: #6366f1; }
.st-bottom-btn.logout { color: #ef4444; }
.st-bottom-btn.logout:hover { background: rgba(239,68,68,.07); }

/* ── Topbar ── */
.st-topbar {
  height: 56px; flex-shrink: 0; padding: 0 28px;
  border-bottom: 1px solid rgba(99,102,241,.12);
  display: flex; align-items: center; gap: 16;
  background: rgba(255,255,255,.75);
  backdrop-filter: blur(16px);
  position: relative; z-index: 5;
  box-shadow: 0 1px 16px rgba(99,102,241,.07);
}
.st-topbar-title {
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
  color: #1e1b4b; flex: 1; letter-spacing: -.2px;
}
.st-topbar-roll {
  font-size: 12px; color: #9ca3af; font-weight: 600;
  background: rgba(99,102,241,.07); border: 1px solid rgba(99,102,241,.15);
  border-radius: 8px; padding: 4px 10px;
}

/* ── Main content ── */
.st-main {
  flex: 1; overflow-y: auto; padding: 28px 28px;
  position: relative; z-index: 1;
}

/* ── Global animations ── */
@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }

input:focus, textarea:focus, select:focus {
  border-color: #6366f1 !important;
  background: #fff !important;
  box-shadow: 0 0 0 3px rgba(99,102,241,.12) !important;
  outline: none !important;
}
input::placeholder, textarea::placeholder { color: #9ca3af; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: rgba(99,102,241,.2); border-radius: 99px; }
::-webkit-scrollbar-track { background: transparent; }
`;

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    if (!confirm('Log out?')) return;
    try { await AuthAPI.logout(user!.user_id); } catch {}
    disconnectSocket();
    clearAuth();
    navigate('/login', { replace: true });
  }

  const W = collapsed ? 60 : 220;

  return (
    <>
      <style>{css}</style>

      {/* Background layers */}
      <div className="st-layout-bg"/>
      <div className="st-grid"/>
      <div className="st-orb st-orb1"/>
      <div className="st-orb st-orb2"/>
      <div className="st-orb st-orb3"/>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar ── */}
        <aside className="st-sidebar" style={{ width: W }}>

          {/* Logo */}
          <div className="st-logo-block">
            <div className="st-logo-inner">
              <div className="st-logo-icon">🎓</div>
              {!collapsed && <div className="st-logo-text">SmartAttend</div>}
            </div>
            {!collapsed && <div className="st-logo-sub">Student Portal</div>}
          </div>

          {/* User card */}
          {!collapsed && user && (
            <div className="st-user-card">
              <div className="st-user-name">{user.name}</div>
              <div className="st-user-meta">{user.roll_number} · Sem {user.semester}</div>
              <div className={`st-face-badge ${user.face_enrolled_at ? 'enrolled' : 'not-enrolled'}`}>
                {user.face_enrolled_at ? '✅ Face Enrolled' : '⚠️ Face Not Enrolled'}
              </div>
            </div>
          )}

          {/* Nav */}
          <nav className="st-nav">
            {!collapsed && <div className="st-nav-label">Navigation</div>}
            {NAV.map(n => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}>
                {({ isActive }) => (
                  <div className={`st-nav-item${isActive ? ' active' : ''}`}
                    style={{ padding: collapsed ? '10px' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
                    <span className="st-nav-icon">{n.icon}</span>
                    {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{n.label}</span>}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Bottom */}
          <div className="st-bottom">
            <button
              className="st-bottom-btn collapse"
              onClick={() => setCollapsed(c => !c)}
              style={{ padding: collapsed ? '10px' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: 14 }}>{collapsed ? '▶' : '◀'}</span>
              {!collapsed && 'Collapse'}
            </button>
            <button
              className="st-bottom-btn logout"
              onClick={handleLogout}
              style={{ padding: collapsed ? '10px' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: 16 }}>🚪</span>
              {!collapsed && 'Log Out'}
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Topbar */}
          <header className="st-topbar">
            <div className="st-topbar-title">Student Portal</div>
            {user?.roll_number && (
              <div className="st-topbar-roll">{user.roll_number}</div>
            )}
          </header>

          {/* Page content */}
          <main className="st-main">
            <Outlet/>
          </main>
        </div>
      </div>

      <Notifications/>
    </>
  );
}