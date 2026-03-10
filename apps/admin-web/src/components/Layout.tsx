import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Trash2Icon } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Dashboard',     icon: '▪', emoji: '🏠' },
  { path: '/device-resets', label: 'Device Resets', icon: '▪', emoji: '📱' },
  { path: '/face-resets',   label: 'Face Resets',   icon: '▪', emoji: '🪞' },
  { path: '/students',      label: 'Students',      icon: '▪', emoji: '👨‍🎓' },
  { path: '/professors',    label: 'Professors',    icon: '▪', emoji: '👨‍🏫' },
  { path: '/departments',   label: 'Departments',   icon: '▪', emoji: '🏢' },
  { path: '/courses',       label: 'Courses',       icon: '▪', emoji: '📚' },
  { path: '/reports',       label: 'Reports',       icon: '▪', emoji: '📊' },
  { path: '/audit',         label: 'Audit Logs',    icon: '▪', emoji: '🔍' },
];

const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.layout-root {
  display: flex; min-height: 100vh;
  font-family: 'DM Sans', sans-serif;
  background: #F9FAFB;
}

/* ── Sidebar ─────────────────────────────────────────────────── */
.sidebar {
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
  width: 240px;
  background: #111827;
  display: flex; flex-direction: column;
  transition: width .22s cubic-bezier(.4,0,.2,1),
              transform .22s cubic-bezier(.4,0,.2,1);
  overflow: hidden;
  box-shadow: 4px 0 24px rgba(0,0,0,.12);
}
.sidebar.collapsed { width: 68px; }

/* logo */
.sidebar-logo {
  display: flex; align-items: center; gap: 12px;
  padding: 20px 18px 18px;
  border-bottom: 1px solid rgba(255,255,255,.08);
  flex-shrink: 0;
  min-height: 68px;
}
.logo-icon-wrap {
  width: 36px; height: 36px; flex-shrink: 0;
  background: linear-gradient(135deg,#7C3AED,#A78BFA);
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  font-size: 18px; box-shadow: 0 4px 12px rgba(124,58,237,.4);
}
.logo-text { overflow: hidden; white-space: nowrap; }
.logo-title {
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 800;
  color: #fff; letter-spacing: -.3px; line-height: 1;
}
.logo-sub { font-size: 10px; color: #6B7280; margin-top: 3px; letter-spacing: .06em; text-transform: uppercase; }

/* nav */
.sidebar-nav {
  flex: 1; padding: 10px 8px;
  display: flex; flex-direction: column; gap: 2px;
  overflow-y: auto; overflow-x: hidden;
}
.sidebar-nav::-webkit-scrollbar { width: 4px; }
.sidebar-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

.nav-section-label {
  font-size: 9px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase;
  color: #4B5563; padding: 10px 12px 4px; white-space: nowrap; overflow: hidden;
}

.nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 12px; border-radius: 8px;
  text-decoration: none; font-size: 13.5px; font-weight: 500;
  color: #9CA3AF; transition: all .15s ease;
  white-space: nowrap; overflow: hidden;
  position: relative;
}
.nav-item:hover { background: rgba(255,255,255,.06); color: #E5E7EB; }
.nav-item.active {
  background: rgba(124,58,237,.18);
  color: #A78BFA;
}
.nav-item.active .nav-item-bar {
  opacity: 1;
}
.nav-item-bar {
  position: absolute; left: 0; top: 20%; bottom: 20%;
  width: 3px; border-radius: 0 3px 3px 0;
  background: #7C3AED; opacity: 0; transition: opacity .15s;
}
.nav-emoji { font-size: 16px; flex-shrink: 0; width: 22px; text-align: center; }
.nav-label { font-family: 'DM Sans', sans-serif; overflow: hidden; }

/* sidebar footer */
.sidebar-footer {
  padding: 12px 8px;
  border-top: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0;
}
.user-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 10px; border-radius: 10px;
  background: rgba(255,255,255,.04);
  margin-bottom: 6px; overflow: hidden;
  border: 1px solid rgba(255,255,255,.06);
}
.user-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg,#7C3AED,#10B981);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 800; color: #fff;
}
.user-info { overflow: hidden; }
.user-email { font-size: 12px; font-weight: 500; color: #E5E7EB; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
.user-role { font-size: 10px; color: #6B7280; letter-spacing: .04em; margin-top: 1px; }

.btn-logout {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; border: none; cursor: pointer;
  background: rgba(239,68,68,.12); color: #FCA5A5;
  font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
  transition: all .15s ease; white-space: nowrap; overflow: hidden;
}
.btn-logout:hover { background: rgba(239,68,68,.22); color: #FEE2E2; }
.btn-logout-icon { font-size: 14px; flex-shrink: 0; }

/* ── Main ────────────────────────────────────────────────────── */
.main {
  flex: 1;
  margin-left: 240px;
  display: flex; flex-direction: column;
  min-height: 100vh;
  transition: margin-left .22s cubic-bezier(.4,0,.2,1);
}
.main.expanded { margin-left: 68px; }

/* ── Top bar ─────────────────────────────────────────────────── */
.topbar {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #E5E7EB;
  display: flex; align-items: center; gap: 0;
  padding: 0 20px 0 0;
  position: sticky; top: 0; z-index: 50;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}

/* hamburger button */
.hamburger-btn {
  width: 56px; height: 56px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: none; border: none; cursor: pointer;
  color: #6B7280; transition: color .15s ease;
  border-right: 1px solid #F3F4F6;
}
.hamburger-btn:hover { color: #111827; background: #F9FAFB; }
.hamburger-icon { display: flex; flex-direction: column; gap: 5px; }
.hamburger-icon span {
  display: block; border-radius: 2px; background: currentColor;
  transition: all .22s cubic-bezier(.4,0,.2,1);
}
.bar1 { width: 20px; height: 2px; }
.bar2 { width: 14px; height: 2px; }
.bar3 { width: 20px; height: 2px; }
/* × state when open (sidebar collapsed) */
.hamburger-btn.open .bar1 { transform: translateY(7px) rotate(45deg); width: 20px; }
.hamburger-btn.open .bar2 { opacity: 0; transform: scaleX(0); }
.hamburger-btn.open .bar3 { transform: translateY(-7px) rotate(-45deg); width: 20px; }

.topbar-breadcrumb {
  flex: 1; display: flex; align-items: center; gap: 8px;
  padding: 0 16px;
}
.topbar-logo-text {
  font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700;
  color: #111827; letter-spacing: -.3px;
}
.topbar-sep { color: #D1D5DB; font-size: 14px; }
.topbar-page { font-size: 13px; color: #6B7280; font-weight: 400; }

.topbar-right { display: flex; align-items: center; gap: 12px; }
.topbar-badge {
  display: flex; align-items: center; gap: 5px;
  background: #D1FAE5; border: 1px solid #10B98130;
  border-radius: 20px; padding: 4px 12px;
  font-size: 11px; font-weight: 600; color: #065F46;
}
.live-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #10B981;
  box-shadow: 0 0 0 2px #10B98130;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%,100% { box-shadow: 0 0 0 2px #10B98130; }
  50%      { box-shadow: 0 0 0 4px #10B98120; }
}

/* ── Content ─────────────────────────────────────────────────── */
.content-area {
  flex: 1;
  /* no padding here — each page handles its own padding */
}

/* ── Tooltip for collapsed nav ───────────────────────────────── */
.nav-tooltip-wrap { position: relative; }
.nav-tooltip {
  position: absolute; left: 68px; top: 50%; transform: translateY(-50%);
  background: #1F2937; color: #F9FAFB;
  font-family: 'Syne', sans-serif; font-size: 12px; font-weight: 600;
  padding: 6px 12px; border-radius: 8px; white-space: nowrap;
  pointer-events: none; opacity: 0; transition: opacity .15s ease;
  z-index: 200; box-shadow: 0 4px 12px rgba(0,0,0,.2);
  margin-left: 8px;
}
.nav-tooltip-wrap:hover .nav-tooltip { opacity: 1; }
`;

export default function Layout() {
  const { user, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() { clearAuth(); navigate('/login'); }

  /* derive initials from email */
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? 'AD';

  return (
    <>
      <style>{css}</style>
      <div className="layout-root">

        {/* ── Sidebar ────────────────────────────────── */}
        <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>

          {/* Logo */}
          <div className="sidebar-logo">
            <div className="logo-icon-wrap">🎓</div>
            {!collapsed && (
              <div className="logo-text">
                <div className="logo-title">SmartAttend</div>
                <div className="logo-sub">Admin Portal</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="sidebar-nav">
            {!collapsed && <div className="nav-section-label">Navigation</div>}
            {NAV_ITEMS.map((item) => (
              <div key={item.path} className="nav-tooltip-wrap">
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <div className="nav-item-bar" />
                  <span className="nav-emoji">{item.emoji}</span>
                  {!collapsed && <span className="nav-label">{item.label}</span>}
                </NavLink>
                {collapsed && <div className="nav-tooltip">{item.label}</div>}
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="sidebar-footer">
            {!collapsed && (
              <div className="user-card">
                <div className="user-avatar">{initials}</div>
                <div className="user-info">
                  <div className="user-email">{user?.email ?? 'admin@system'}</div>
                  <div className="user-role">Administrator</div>
                </div>
              </div>
            )}
            <button className="btn-logout" onClick={handleLogout}>
              <span className="btn-logout-icon">{<Trash2Icon className='w-2! h-2!' />}</span>
              {!collapsed && 'Logout'}
            </button>
          </div>
        </aside>

        {/* ── Main ───────────────────────────────────── */}
        <main className={`main${collapsed ? ' expanded' : ''}`}>

          {/* Top bar */}
          <header className="topbar">
            {/* Hamburger */}
            <button
              className={`hamburger-btn${collapsed ? ' open' : ''}`}
              onClick={() => setCollapsed(p => !p)}
              aria-label="Toggle sidebar"
            >
              <div className="hamburger-icon">
                <span className="bar1" />
                <span className="bar2" />
                <span className="bar3" />
              </div>
            </button>

            {/* Breadcrumb */}
            <div className="topbar-breadcrumb">
              <span className="topbar-logo-text">SmartAttend</span>
              <span className="topbar-sep">/</span>
              <span className="topbar-page">Administration</span>
            </div>

            {/* Right side */}
            <div className="topbar-right">
              <div className="topbar-badge">
                <span className="live-dot" />
                Live
              </div>
            </div>
          </header>

          {/* Page content — each page has its own padding */}
          <div className="content-area">
            <Outlet />
          </div>
        </main>

      </div>
    </>
  );
}