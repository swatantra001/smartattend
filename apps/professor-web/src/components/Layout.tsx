// import React from 'react';
// import { Outlet, useNavigate, useLocation } from 'react-router-dom';
// import { useAuthStore } from '../store/auth.store';
// import { AuthAPI } from '../services/api';
// import { disconnectSocket } from '../services/socket';
// import { D } from './design-tokens';
// import { Notifications } from './ui';

// const NAV = [
//   { path: '/',             icon: '🏠', label: 'Home' },
//   { path: '/sessions',     icon: '📋', label: 'Sessions' },
//   { path: '/assignments',  icon: '📝', label: 'Assignments' },
//   { path: '/reports',      icon: '📊', label: 'Reports' },
//   { path: '/profile',      icon: '👤', label: 'Profile' },
// ];

// export default function Layout() {
//   const { user } = useAuthStore();
//   const navigate = useNavigate();
//   const location = useLocation();
//   const topRoute = '/' + location.pathname.split('/')[1];

//   const PAGE_TITLES: Record<string, string> = {
//     '/': 'Home', '/sessions': 'Sessions', '/assignments': 'Assignments',
//     '/reports': 'Reports', '/profile': 'Profile',
//     '/assign-courses': 'Course Assignment', '/manage-students': 'Manage Students',
//     '/dashboard': 'Live Dashboard',
//   };
//   const pageTitle = PAGE_TITLES[topRoute] || 'SmartAttend';

//   async function handleLogout() {
//     if (!confirm('Log out?')) return;
//     try { await AuthAPI.logout(user!.user_id); } catch {}
//     disconnectSocket();
//     useAuthStore.getState().clearAuth();
//     navigate('/login', { replace: true });
//   }

//   return (
//     <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
//       {/* Sidebar */}
//       <aside style={{
//         width: 240, flexShrink: 0,
//         background: D.surface, borderRight: `1px solid ${D.border}`,
//         display: 'flex', flexDirection: 'column', overflowY: 'auto',
//       }}>
//         {/* Logo */}
//         <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${D.border}` }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800, color: D.textPrimary }}>
//             <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #4f7fff, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>🎓</div>
//             SmartAttend
//           </div>
//         </div>

//         {/* Nav */}
//         <nav style={{ padding: '10px 10px', flex: 1 }}>
//           <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: D.textMuted, padding: '12px 8px 6px' }}>Navigation</div>
//           {NAV.map(item => {
//             const isActive = topRoute === item.path || (item.path !== '/' && topRoute.startsWith(item.path));
//             return (
//               <div key={item.path} onClick={() => navigate(item.path)}
//                 style={{
//                   display: 'flex', alignItems: 'center', gap: 9,
//                   padding: '9px 10px', borderRadius: 10,
//                   fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
//                   marginBottom: 2, transition: 'all .15s',
//                   background: isActive ? D.accentLight : 'transparent',
//                   color: isActive ? D.accent : D.textSecondary,
//                 }}>
//                 <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
//                 {item.label}
//               </div>
//             );
//           })}
//         </nav>

//         {/* User */}
//         <div style={{ padding: '14px 18px', borderTop: `1px solid ${D.border}` }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//             <div style={{
//               width: 36, height: 36, borderRadius: 10, flexShrink: 0,
//               background: 'linear-gradient(135deg, #4f7fff, #a855f7)',
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//               fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff',
//             }}>{user?.name?.charAt(0)?.toUpperCase() || '?'}</div>
//             <div style={{ overflow: 'hidden' }}>
//               <div style={{ fontSize: 13, fontWeight: 600, color: D.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
//               <div style={{ fontSize: 11, color: D.textMuted }}>{user?.employee_code}</div>
//             </div>
//           </div>
//         </div>
//       </aside>

//       {/* Main */}
//       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//         {/* Topbar */}
//         <header style={{
//           height: 56, flexShrink: 0, padding: '0 32px',
//           borderBottom: `1px solid ${D.border}`,
//           display: 'flex', alignItems: 'center', gap: 16,
//           background: D.surface,
//         }}>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, flex: 1 }}>{pageTitle}</div>
//           <button onClick={handleLogout} style={{ background: D.redLight, border: `1px solid rgba(239,68,68,.2)`, color: D.red, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
//             🚪 Logout
//           </button>
//         </header>

//         {/* Page Content */}
//         <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
//           <Outlet />
//         </main>
//       </div>

//       <Notifications />

//       {/* Global animations */}
//       <style>{`
//         @keyframes spin { to { transform: rotate(360deg); } }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         @keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
//         @keyframes notifIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
//         @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
//         tr:hover td { background: ${D.surface2}; }
//         input:focus, textarea:focus, select:focus { border-color: ${D.accent} !important; background: ${D.surface} !important; }
//         input::placeholder, textarea::placeholder { color: ${D.textMuted}; }
//         ::-webkit-scrollbar { width: 5px; height: 5px; }
//         ::-webkit-scrollbar-thumb { background: ${D.border}; border-radius: 99px; }
//       `}</style>
//     </div>
//   );
// }











import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { AuthAPI } from '../services/api';
import { disconnectSocket } from '../services/socket';
import { D } from './design-tokens';
import { Notifications } from './ui';

const NAV = [
  { path: '/',            icon: '🏠', label: 'Home' },
  { path: '/sessions',    icon: '📋', label: 'Sessions' },
  { path: '/assignments', icon: '📝', label: 'Assignments' },
  { path: '/reports',     icon: '📊', label: 'Reports' },
  { path: '/profile',     icon: '👤', label: 'Profile' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Home',
  '/sessions': 'Sessions',
  '/assignments': 'Assignments',
  '/reports': 'Reports',
  '/profile': 'Profile',
  '/assign-courses': 'Course Assignment',
  '/manage-students': 'Manage Students',
  '/dashboard': 'Live Dashboard',
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

/* ── Global reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; }

/* ── Animated background canvas ── */
.prof-layout-bg {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(ellipse 70% 55% at 75% -5%, rgba(139,92,246,.11) 0%, transparent 55%),
    radial-gradient(ellipse 55% 45% at 0% 90%, rgba(245,158,11,.07) 0%, transparent 50%),
    radial-gradient(ellipse 40% 35% at 90% 80%, rgba(236,72,153,.06) 0%, transparent 45%),
    #f5f0ff;
}

/* ── Floating orbs ── */
.prof-orb {
  position: fixed; border-radius: 50%; pointer-events: none; z-index: 0;
}
.prof-orb1 {
  width: 480px; height: 480px; top: -180px; right: 60px;
  background: radial-gradient(circle, rgba(139,92,246,.14) 0%, rgba(139,92,246,.02) 55%, transparent 70%);
  animation: profOrb1 18s ease-in-out infinite;
}
.prof-orb2 {
  width: 340px; height: 340px; bottom: -100px; left: 220px;
  background: radial-gradient(circle, rgba(245,158,11,.09) 0%, rgba(245,158,11,.01) 55%, transparent 70%);
  animation: profOrb2 22s ease-in-out infinite;
}
.prof-orb3 {
  width: 220px; height: 220px; top: 50%; right: 15%;
  background: radial-gradient(circle, rgba(236,72,153,.06) 0%, transparent 65%);
  animation: profOrb3 26s ease-in-out infinite;
}
@keyframes profOrb1 {
  0%,100%{ transform: translate(0,0) scale(1); }
  33%    { transform: translate(-22px, 38px) scale(1.04); }
  66%    { transform: translate(16px, -18px) scale(.97); }
}
@keyframes profOrb2 {
  0%,100%{ transform: translate(0,0) scale(1); }
  50%    { transform: translate(30px, -25px) scale(1.06); }
}
@keyframes profOrb3 {
  0%,100%{ transform: translate(0,0) scale(1); }
  40%    { transform: translate(-14px, 22px) scale(1.08); }
  70%    { transform: translate(10px,-10px) scale(.94); }
}

/* ── Dot grid ── */
.prof-grid {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(circle, rgba(139,92,246,.16) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, black 20%, transparent 80%);
}

/* ── Sidebar ── */
.prof-sidebar {
  flex-shrink: 0; position: relative; z-index: 10;
  display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden;
  background: rgba(255,255,255,.82);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(139,92,246,.15);
  box-shadow: 2px 0 24px rgba(139,92,246,.08);
  transition: width .2s ease;
}

/* ── Logo block ── */
.prof-logo-block {
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgba(139,92,246,.12);
}
.prof-logo-inner {
  display: flex; align-items: center; gap: 10px;
  font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800;
  color: #2e1065;
}
.prof-logo-icon {
  width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  box-shadow: 0 4px 12px rgba(139,92,246,.35);
}

/* ── Nav section ── */
.prof-nav { padding: 10px; flex: 1; }
.prof-nav-label {
  font-size: 10px; font-weight: 700; letter-spacing: .14em;
  text-transform: uppercase; color: rgba(139,92,246,.6);
  padding: 12px 8px 6px;
}
.prof-nav-item {
  display: flex; align-items: center; gap: 9px;
  padding: 9px 10px; border-radius: 10px;
  font-size: 13.5px; font-weight: 500; cursor: pointer;
  margin-bottom: 2px; transition: all .15s;
  color: #4b5563; position: relative; overflow: hidden;
}
.prof-nav-item:hover {
  background: rgba(139,92,246,.08);
  color: #2e1065;
}
.prof-nav-item.active {
  background: rgba(139,92,246,.12);
  color: #6d28d9; font-weight: 600;
}
.prof-nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 20%; bottom: 20%;
  width: 3px; border-radius: 0 3px 3px 0;
  background: #8b5cf6;
}
.prof-nav-icon {
  font-size: 16px; width: 20px; text-align: center; flex-shrink: 0;
}

/* ── User block ── */
.prof-user-block {
  padding: 14px 18px;
  border-top: 1px solid rgba(139,92,246,.12);
}
.prof-user-inner { display: flex; align-items: center; gap: 10px; }
.prof-user-avatar {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: linear-gradient(135deg, #8b5cf6, #ec4899);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
  color: #fff; box-shadow: 0 4px 10px rgba(139,92,246,.30);
}
.prof-user-name {
  font-size: 13px; font-weight: 600; color: #2e1065;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.prof-user-code { font-size: 11px; color: #9ca3af; }

/* ── Topbar ── */
.prof-topbar {
  height: 56px; flex-shrink: 0; padding: 0 32px;
  border-bottom: 1px solid rgba(139,92,246,.12);
  display: flex; align-items: center; gap: 16;
  background: rgba(255,255,255,.75);
  backdrop-filter: blur(16px);
  position: relative; z-index: 5;
  box-shadow: 0 1px 16px rgba(139,92,246,.07);
}
.prof-topbar-title {
  font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 800;
  color: #2e1065; flex: 1; letter-spacing: -.3px;
}
.prof-logout-btn {
  background: rgba(239,68,68,.08);
  border: 1px solid rgba(239,68,68,.2);
  color: #dc2626; border-radius: 9px;
  padding: 7px 14px; font-size: 12px; font-weight: 600;
  cursor: pointer; display: flex; align-items: center; gap: 5px;
  transition: all .15s; font-family: 'DM Sans', sans-serif;
}
.prof-logout-btn:hover {
  background: rgba(239,68,68,.14);
  border-color: rgba(239,68,68,.35);
}

/* ── Main content ── */
.prof-main {
  flex: 1; overflow-y: auto; padding: 28px 32px;
  position: relative; z-index: 1;
}

/* ── Global animations ── */
@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(14px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes notifIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }

tr:hover td { background: rgba(139,92,246,.04) !important; }
input:focus, textarea:focus, select:focus {
  border-color: #8b5cf6 !important;
  background: #fff !important;
  box-shadow: 0 0 0 3px rgba(139,92,246,.12) !important;
}
input::placeholder, textarea::placeholder { color: #9ca3af; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: rgba(139,92,246,.2); border-radius: 99px; }
::-webkit-scrollbar-track { background: transparent; }
`;

export default function Layout() {
  const { user } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);
  const topRoute  = '/' + location.pathname.split('/')[1];
  const pageTitle = PAGE_TITLES[topRoute] || 'SmartAttend';

  async function handleLogout() {
    if (!confirm('Log out?')) return;
    try { await AuthAPI.logout(user!.user_id); } catch {}
    disconnectSocket();
    useAuthStore.getState().clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <style>{css}</style>

      {/* Background layers */}
      <div className="prof-layout-bg"/>
      <div className="prof-grid"/>
      <div className="prof-orb prof-orb1"/>
      <div className="prof-orb prof-orb2"/>
      <div className="prof-orb prof-orb3"/>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

        {/* ── Sidebar ── */}
        <aside className="prof-sidebar" style={{ width: collapsed ? 60 : 240 }}>
          {/* Logo */}
          <div className="prof-logo-block">
            <div className="prof-logo-inner">
              <div className="prof-logo-icon">🎓</div>
              {!collapsed && 'SmartAttend'}
            </div>
            {!collapsed && (
              <div style={{ fontSize: 10.5, color: '#8b5cf6', fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 6, paddingLeft: 44 }}>
                Professor Portal
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="prof-nav">
            {!collapsed && <div className="prof-nav-label">Navigation</div>}
            {NAV.map(item => {
              const isActive = topRoute === item.path || (item.path !== '/' && topRoute.startsWith(item.path));
              return (
                <div key={item.path}
                  className={`prof-nav-item${isActive ? ' active' : ''}`}
                  style={{ padding: collapsed ? '10px' : '9px 10px', justifyContent: collapsed ? 'center' : 'flex-start' }}
                  onClick={() => navigate(item.path)}>
                  <span className="prof-nav-icon">{item.icon}</span>
                  {!collapsed && item.label}
                </div>
              );
            })}
          </nav>

          {/* User + bottom actions */}
          <div className="prof-user-block">
            {!collapsed && (
              <div className="prof-user-inner" style={{ marginBottom: 10 }}>
                <div className="prof-user-avatar">
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div className="prof-user-name">{user?.name}</div>
                  <div className="prof-user-code">{user?.employee_code}</div>
                </div>
              </div>
            )}
            {/* Collapse toggle */}
            <button
              onClick={() => setCollapsed(c => !c)}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 9, width: '100%',
                padding: collapsed ? '9px' : '9px 10px',
                borderRadius: 10, background: 'none', border: 'none',
                color: '#9ca3af', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                transition: 'all .14s',
              }}>
              <span style={{ fontSize: 13 }}>{collapsed ? '▶' : '◀'}</span>
              {!collapsed && 'Collapse'}
            </button>
          </div>
        </aside>

        {/* ── Main ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Topbar */}
          <header className="prof-topbar">
            <div className="prof-topbar-title">{pageTitle}</div>
            <button className="prof-logout-btn" onClick={handleLogout}>
              🚪 Logout
            </button>
          </header>

          {/* Page content */}
          <main className="prof-main">
            <Outlet/>
          </main>
        </div>
      </div>

      <Notifications/>
    </>
  );
}