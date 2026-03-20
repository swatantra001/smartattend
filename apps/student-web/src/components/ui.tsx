// import React, { useState, useEffect } from 'react';
// import { D } from './design-tokens';

// // ── Button ────────────────────────────────────────────────────────────────────
// interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
//   variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
//   size?: 'xs' | 'sm' | 'md';
//   loading?: boolean;
// }
// export function Button({ variant = 'primary', size = 'md', loading, disabled, children, style, ...rest }: ButtonProps) {
//   const bg: Record<string, string> = {
//     primary: D.accent, secondary: D.surface2, danger: D.red,
//     ghost: 'transparent', success: D.green,
//   };
//   const pad = size === 'xs' ? '4px 10px' : size === 'sm' ? '7px 14px' : '10px 18px';
//   const fs  = size === 'xs' ? 11 : size === 'sm' ? 12.5 : 14;
//   return (
//     <button
//       disabled={disabled || loading}
//       style={{
//         padding: pad, borderRadius: 9, border: `1px solid ${variant === 'secondary' ? D.border : 'transparent'}`,
//         background: bg[variant], color: D.textPrimary, fontSize: fs, fontWeight: 600,
//         cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: disabled || loading ? .55 : 1,
//         display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity .15s',
//         fontFamily: 'inherit', ...style,
//       }}
//       {...rest}
//     >
//       {loading && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block', flexShrink: 0 }} />}
//       {children}
//     </button>
//   );
// }

// // ── Badge ─────────────────────────────────────────────────────────────────────
// export function Badge({ variant = 'gray', children }: { variant?: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple'; children: React.ReactNode }) {
//   const map: Record<string, [string, string]> = {
//     green: [D.green, D.greenLight], red: [D.red, D.redLight],
//     amber: [D.amber, D.amberLight], blue: [D.accent, D.accentLight],
//     purple: [D.purple, D.purpleLight], gray: [D.textSecondary, D.surface2],
//   };
//   const [color, bg] = map[variant];
//   return (
//     <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color, background: bg }}>
//       {children}
//     </span>
//   );
// }

// // ── Spinner ───────────────────────────────────────────────────────────────────
// export function Spinner({ size = 24 }: { size?: number, light?: boolean}) {
//   return (
//     <span style={{ width: size, height: size, border: `${size > 20 ? 3 : 2}px solid ${D.border}`, borderTopColor: D.accent, borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block', flexShrink: 0 }} />
//   );
// }

// // ── Tabs ──────────────────────────────────────────────────────────────────────
// export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; badge?: number }[]; active: string; onChange: (k: string) => void }) {
//   return (
//     <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${D.border}`, marginBottom: 20 }}>
//       {tabs.map(t => (
//         <button key={t.key} onClick={() => onChange(t.key)} style={{
//           padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
//           fontSize: 13, fontWeight: 600, fontFamily: 'inherit', position: 'relative',
//           color: active === t.key ? D.accent : D.textMuted,
//           borderBottom: `2px solid ${active === t.key ? D.accent : 'transparent'}`,
//           display: 'flex', alignItems: 'center', gap: 6, transition: 'color .15s',
//         }}>
//           {t.label}
//           {(t.badge ?? 0) > 0 && (
//             <span style={{ background: D.red, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99, minWidth: 18, textAlign: 'center' }}>{t.badge}</span>
//           )}
//         </button>
//       ))}
//     </div>
//   );
// }

// // ── EmptyState ────────────────────────────────────────────────────────────────
// export function EmptyState({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children?: React.ReactNode }) {
//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 10 }}>
//       <span style={{ fontSize: 42 }}>{icon}</span>
//       <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17 }}>{title}</div>
//       {sub && <div style={{ fontSize: 13, color: D.textMuted, maxWidth: 280 }}>{sub}</div>}
//       {children && <div style={{ marginTop: 8 }}>{children}</div>}
//     </div>
//   );
// }

// // ── ProgressBar ───────────────────────────────────────────────────────────────
// export function ProgressBar({ value, color = D.accent }: { value: number; color?: string }) {
//   return (
//     <div style={{ height: 5, background: D.surface2, borderRadius: 99, overflow: 'hidden' }}>
//       <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, background: color, borderRadius: 99, transition: 'width .4s ease' }} />
//     </div>
//   );
// }

// // ── StatusPill ────────────────────────────────────────────────────────────────
// export function StatusPill({ status }: { status: 'PRESENT' | 'ABSENT' | string }) {
//   const color = status === 'PRESENT' ? D.green : status === 'ABSENT' ? D.red : D.amber;
//   const bg    = status === 'PRESENT' ? D.greenLight : status === 'ABSENT' ? D.redLight : D.amberLight;
//   const icon  = status === 'PRESENT' ? '✅' : status === 'ABSENT' ? '❌' : '⚠️';
//   return (
//     <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color, background: bg }}>
//       {icon} {status}
//     </span>
//   );
// }

// // ── LoadingScreen ─────────────────────────────────────────────────────────────
// export function LoadingScreen() {
//   return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: D.bg, gap: 12 }}>
//       <Spinner size={32} />
//       <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: D.textMuted }}>SmartAttend</span>
//     </div>
//   );
// }

// // ── Toast notifications ───────────────────────────────────────────────────────
// interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
// let toastListeners: ((t: Toast) => void)[] = [];
// let toastId = 0;
// export function notify(msg: string, type: 'success' | 'error' | 'info' = 'success') {
//   const t = { id: ++toastId, msg, type };
//   toastListeners.forEach(fn => fn(t));
// }
// export function Notifications() {
//   const [toasts, setToasts] = useState<Toast[]>([]);
//   useEffect(() => {
//     const handler = (t: Toast) => {
//       setToasts(p => [...p, t]);
//       setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3500);
//     };
//     toastListeners.push(handler);
//     return () => { toastListeners = toastListeners.filter(f => f !== handler); };
//   }, []);
//   return (
//     <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
//       {toasts.map(t => (
//         <div key={t.id} style={{
//           background: t.type === 'error' ? '#2d1212' : t.type === 'info' ? D.surface2 : '#0d2d1a',
//           border: `1px solid ${t.type === 'error' ? D.red + '44' : t.type === 'info' ? D.border : D.green + '44'}`,
//           color: t.type === 'error' ? D.red : t.type === 'info' ? D.textPrimary : D.green,
//           padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
//           animation: 'fadeIn .2s ease', maxWidth: 340, pointerEvents: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,.4)',
//         }}>{t.type === 'error' ? '✕ ' : t.type === 'info' ? 'ℹ ' : '✓ '}{t.msg}</div>
//       ))}
//     </div>
//   );
// }
















import React, { useState, useEffect } from 'react';
import { D } from './design-tokens';

// ── Button ────────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
}
export function Button({
  variant = 'primary', size = 'md', loading, disabled, children, style, ...rest
}: ButtonProps) {
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: '#6366f1', color: '#fff',
      boxShadow: '0 4px 12px rgba(99,102,241,.30)',
      border: '1px solid transparent',
    },
    secondary: {
      background: 'rgba(255,255,255,.75)', color: '#1e1b4b',
      border: '1px solid rgba(99,102,241,.2)',
      backdropFilter: 'blur(8px)',
    },
    danger: {
      background: 'rgba(239,68,68,.08)', color: '#dc2626',
      border: '1px solid rgba(239,68,68,.22)',
    },
    ghost: {
      background: 'transparent', color: '#6b7280',
      border: '1px solid transparent',
    },
    success: {
      background: 'rgba(34,197,94,.1)', color: '#15803d',
      border: '1px solid rgba(34,197,94,.25)',
    },
  };
  const sizes = {
    xs: { padding: '4px 10px',  fontSize: 11 },
    sm: { padding: '7px 13px',  fontSize: 12.5 },
    md: { padding: '10px 18px', fontSize: 14 },
  };
  return (
    <button
      disabled={disabled || loading}
      style={{
        borderRadius: 10,
        fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled || loading ? .55 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 6,
        transition: 'all .15s', fontFamily: "'DM Sans', sans-serif",
        ...variants[variant], ...sizes[size], ...style,
      }}
      {...rest}
    >
      {loading && (
        <span style={{
          width: 13, height: 13, flexShrink: 0,
          border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff',
          borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block',
        }}/>
      )}
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({
  variant = 'gray', children,
}: { variant?: 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple' | 'indigo'; children: React.ReactNode }) {
  const map: Record<string, [string, string, string]> = {
    green:  ['#15803d', 'rgba(34,197,94,.12)',   'rgba(34,197,94,.2)'],
    red:    ['#dc2626', 'rgba(239,68,68,.10)',    'rgba(239,68,68,.2)'],
    amber:  ['#92400e', 'rgba(245,158,11,.12)',   'rgba(245,158,11,.2)'],
    blue:   ['#1d4ed8', 'rgba(59,130,246,.12)',   'rgba(59,130,246,.2)'],
    indigo: ['#4338ca', 'rgba(99,102,241,.12)',   'rgba(99,102,241,.2)'],
    purple: [D.purple,  D.purpleLight,             'rgba(124,58,237,.2)'],
    gray:   ['#6b7280', 'rgba(107,114,128,.1)',    'rgba(107,114,128,.2)'],
  };
  const [color, bg, border] = map[variant] || map.gray;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 9px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
      color, background: bg, border: `1px solid ${border}`,
    }}>
      {children}
    </span>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 24, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{
      width: size, height: size, flexShrink: 0,
      border: `${size > 20 ? 3 : 2}px solid ${light ? 'rgba(255,255,255,.25)' : 'rgba(99,102,241,.2)'}`,
      borderTopColor: light ? '#fff' : '#6366f1',
      borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block',
    }}/>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({
  tabs, active, onChange,
}: { tabs: { key: string; label: string; badge?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(99,102,241,.15)', marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          color: active === t.key ? '#6366f1' : '#9ca3af',
          borderBottom: `2px solid ${active === t.key ? '#6366f1' : 'transparent'}`,
          display: 'flex', alignItems: 'center', gap: 6, transition: 'color .15s',
          marginBottom: -1,
        }}>
          {t.label}
          {(t.badge ?? 0) > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
              padding: '1px 5px', borderRadius: 99, minWidth: 18, textAlign: 'center',
            }}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({
  icon, title, sub, children,
}: { icon: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>{icon}</div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>
        {title}
      </div>
      {sub && <div style={{ fontSize: 13, color: '#9ca3af', maxWidth: 280 }}>{sub}</div>}
      {children && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div style={{ height: 5, background: 'rgba(99,102,241,.12)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        background: color || 'linear-gradient(90deg, #6366f1, #22c55e)',
        borderRadius: 99, transition: 'width .4s ease',
      }}/>
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────
export function StatusPill({ status }: { status: 'PRESENT' | 'ABSENT' | string }) {
  const map: Record<string, [string, string, string]> = {
    PRESENT: ['#15803d', 'rgba(34,197,94,.12)',  'rgba(34,197,94,.22)'],
    ABSENT:  ['#dc2626', 'rgba(239,68,68,.10)',   'rgba(239,68,68,.22)'],
  };
  const icon = status === 'PRESENT' ? '✅' : status === 'ABSENT' ? '❌' : '⚠️';
  const [color, bg, border] = map[status] || ['#92400e', 'rgba(245,158,11,.12)', 'rgba(245,158,11,.22)'];
  return (
    <span style={{
      padding: '3px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
      color, background: bg, border: `1px solid ${border}`,
      display: 'inline-flex', alignItems: 'center', gap: 4,
    }}>
      {icon} {status}
    </span>
  );
}

// ── LoadingScreen ─────────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', flexDirection: 'column', gap: 16,
      background: 'radial-gradient(ellipse 70% 55% at 70% -5%, rgba(99,102,241,.12) 0%, transparent 55%), #f0f1ff',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1, #22c55e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, boxShadow: '0 8px 24px rgba(99,102,241,.35)',
      }}>🎓</div>
      <Spinner size={24}/>
    </div>
  );
}

// ── Toast notifications ───────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info'; }
let toastListeners: ((t: Toast) => void)[] = [];
let toastId = 0;
export function notify(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  const t = { id: ++toastId, msg, type };
  toastListeners.forEach(fn => fn(t));
}
export function Notifications() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(p => [...p, t]);
      setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3500);
    };
    toastListeners.push(handler);
    return () => { toastListeners = toastListeners.filter(f => f !== handler); };
  }, []);

  const colors   = { success: '#22c55e', error: '#ef4444', info: '#6366f1' };
  const icons    = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(16px)',
          border: `1px solid rgba(99,102,241,.15)`,
          borderLeft: `3px solid ${colors[t.type]}`,
          borderRadius: 12, padding: '11px 16px',
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 9,
          boxShadow: '0 8px 24px rgba(30,27,75,.14)',
          animation: 'fadeIn .2s ease', pointerEvents: 'all',
          color: colors[t.type], maxWidth: 320,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: colors[t.type] + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{icons[t.type]}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}