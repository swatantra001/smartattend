// import React from 'react';
// import { D } from './design-tokens';

// // ─── Spinner ──────────────────────────────────────────────────────────────────
// export function Spinner({ size = 14, light = false }: { size?: number; light?: boolean }) {
//   return (
//     <span style={{
//       display: 'inline-block', width: size, height: size, flexShrink: 0,
//       border: `2px solid ${light ? 'rgba(255,255,255,0.25)' : 'rgba(100,110,130,0.25)'}`,
//       borderTopColor: light ? '#fff' : D.accent,
//       borderRadius: '50%', animation: 'spin 0.6s linear infinite',
//     }} />
//   );
// }

// // ─── Badge ────────────────────────────────────────────────────────────────────
// type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';
// const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
//   green:  { background: D.greenLight,  color: D.green },
//   red:    { background: D.redLight,    color: D.red },
//   amber:  { background: D.amberLight,  color: D.amber },
//   blue:   { background: D.accentLight, color: D.accent },
//   purple: { background: D.purpleLight, color: D.purple },
//   gray:   { background: 'rgba(100,110,130,0.15)', color: D.textSecondary },
// };
// export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
//   return (
//     <span style={{
//       display: 'inline-flex', alignItems: 'center', gap: 4,
//       padding: '2px 8px', borderRadius: 99,
//       fontSize: 11, fontWeight: 600,
//       ...BADGE_STYLES[variant],
//     }}>{children}</span>
//   );
// }

// // ─── Button ───────────────────────────────────────────────────────────────────
// type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
// export function Button({
//   variant = 'secondary', size = 'md', children, loading, disabled, onClick, type = 'button', style,
// }: {
//   variant?: BtnVariant; size?: 'xs' | 'sm' | 'md' | 'lg';
//   children: React.ReactNode; loading?: boolean; disabled?: boolean;
//   onClick?: () => void; type?: 'button' | 'submit'; style?: React.CSSProperties;
// }) {
//   const base: React.CSSProperties = {
//     display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
//     border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
//     fontFamily: D.surface, fontWeight: 600, transition: 'all .15s',
//     opacity: disabled || loading ? 0.5 : 1, borderRadius: 8,
//   };
//   const sizes = { xs: { padding: '3px 8px', fontSize: 11 }, sm: { padding: '5px 10px', fontSize: 12 }, md: { padding: '8px 14px', fontSize: 13 }, lg: { padding: '12px 20px', fontSize: 14 } };
//   const variants: Record<BtnVariant, React.CSSProperties> = {
//     primary: { background: D.accent, color: '#fff' },
//     secondary: { background: D.surface2, color: D.textPrimary, border: `1px solid ${D.border}` },
//     danger: { background: D.redLight, color: D.red, border: `1px solid rgba(239,68,68,.2)` },
//     success: { background: D.greenLight, color: D.green, border: `1px solid rgba(34,197,94,.2)` },
//     ghost: { background: 'transparent', color: D.textSecondary },
//   };
//   return (
//     <button type={type} onClick={onClick} disabled={disabled || loading}
//       style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
//       {loading && <Spinner size={12} light={variant === 'primary'} />}
//       {children}
//     </button>
//   );
// }

// // ─── Card ─────────────────────────────────────────────────────────────────────
// export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
//   return (
//     <div style={{
//       background: D.surface, border: `1px solid ${D.border}`,
//       borderRadius: 16, overflow: 'hidden', ...style,
//     }}>{children}</div>
//   );
// }

// export function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
//   return (
//     <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
//       <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, flex: 1 }}>{title}</div>
//       {children}
//     </div>
//   );
// }

// // ─── Modal ────────────────────────────────────────────────────────────────────
// export function Modal({
//   title, size = 'md', onClose, children, footer,
// }: {
//   title: string; size?: 'sm' | 'md' | 'lg' | 'xl';
//   onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
// }) {
//   const maxW = { sm: 420, md: 520, lg: 760, xl: 980 }[size];
//   return (
//     <div
//       onClick={(e) => e.target === e.currentTarget && onClose()}
//       style={{
//         position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
//         backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
//         justifyContent: 'center', zIndex: 1000, padding: 20,
//         animation: 'fadeIn .15s ease',
//       }}>
//       <div style={{
//         background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16,
//         width: '100%', maxWidth: maxW, maxHeight: '90vh', overflow: 'auto',
//         animation: 'slideUp .2s ease',
//       }}>
//         <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, flex: 1 }}>{title}</div>
//           <button onClick={onClose} style={{ background: 'none', color: D.textMuted, fontSize: 18, padding: 4, cursor: 'pointer' }}>✕</button>
//         </div>
//         <div style={{ padding: 22 }}>{children}</div>
//         {footer && <div style={{ padding: '16px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
//       </div>
//     </div>
//   );
// }

// // ─── Form ─────────────────────────────────────────────────────────────────────
// export function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
//   return (
//     <div style={{ marginBottom: 16 }}>
//       <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: D.textSecondary, marginBottom: 6, letterSpacing: '.04em' }}>{label}</label>
//       {children}
//     </div>
//   );
// }

// export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
//   return (
//     <input {...props} style={{
//       width: '100%', padding: '9px 12px',
//       background: D.surface2, border: `1px solid ${D.border}`,
//       borderRadius: 8, color: D.textPrimary, fontSize: 13.5,
//       transition: 'border-color .15s', outline: 'none',
//       ...props.style,
//     }} />
//   );
// }

// export function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
//   return (
//     <textarea {...props} style={{
//       width: '100%', padding: '9px 12px',
//       background: D.surface2, border: `1px solid ${D.border}`,
//       borderRadius: 8, color: D.textPrimary, fontSize: 13.5,
//       resize: 'vertical', minHeight: 80, outline: 'none',
//       fontFamily: 'inherit', ...props.style,
//     }} />
//   );
// }

// export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
//   return (
//     <select {...props} style={{
//       width: '100%', padding: '9px 12px',
//       background: D.surface2, border: `1px solid ${D.border}`,
//       borderRadius: 8, color: D.textPrimary, fontSize: 13.5, cursor: 'pointer', outline: 'none',
//       ...props.style,
//     }}>{children}</select>
//   );
// }

// // ─── Table ────────────────────────────────────────────────────────────────────
// export function Table({ children }: { children: React.ReactNode }) {
//   return (
//     <div style={{ overflowX: 'auto' }}>
//       <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
//     </div>
//   );
// }

// export function Th({ children }: { children: React.ReactNode }) {
//   return (
//     <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: D.textMuted, borderBottom: `1px solid ${D.border}`, whiteSpace: 'nowrap' }}>
//       {children}
//     </th>
//   );
// }

// export function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
//   return <td style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}`, verticalAlign: 'middle', ...style }}>{children}</td>;
// }

// // ─── Tabs ─────────────────────────────────────────────────────────────────────
// export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string; badge?: number }[]; active: string; onChange: (k: string) => void }) {
//   return (
//     <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${D.border}`, marginBottom: 20 }}>
//       {tabs.map(t => (
//         <div key={t.key} onClick={() => onChange(t.key)} style={{
//           padding: '9px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
//           borderBottom: `2px solid ${active === t.key ? D.accent : 'transparent'}`,
//           color: active === t.key ? D.accent : D.textMuted, marginBottom: -1,
//           transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
//         }}>
//           {t.label}
//           {t.badge !== undefined && t.badge > 0 && (
//             <span style={{ background: D.red, color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99, minWidth: 16, textAlign: 'center' }}>{t.badge}</span>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ─── Empty State ──────────────────────────────────────────────────────────────
// export function EmptyState({ icon, title, sub, action, children }: { icon: string; title: string; sub?: string; action?: React.ReactNode, children?: React.ReactNode}) {
//   return (
//     <div style={{ textAlign: 'center', padding: '60px 20px' }}>
//       <div style={{ fontSize: 48, marginBottom: 14 }}>{icon}</div>
//       <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
//       {sub && <div style={{ fontSize: 13, color: D.textMuted, marginBottom: action ? 16 : 0 }}>{sub}</div>}
//       {action}
// 	  {children}
//     </div>
//   );
// }

// // ─── Stat Card ────────────────────────────────────────────────────────────────
// export function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
//   return (
//     <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, padding: '18px 20px', flex: 1 }}>
//       <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>{label}</div>
//       <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: color || D.textPrimary, lineHeight: 1 }}>{value}</div>
//       {sub && <div style={{ fontSize: 12, color: D.textMuted, marginTop: 4 }}>{sub}</div>}
//     </div>
//   );
// }

// // ─── Progress Bar ─────────────────────────────────────────────────────────────
// export function ProgressBar({ value, color }: { value: number; color?: string }) {
//   return (
//     <div style={{ height: 4, background: D.border, borderRadius: 99, overflow: 'hidden' }}>
//       <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(100, value)}%`, background: color || D.accent, transition: 'width .5s ease' }} />
//     </div>
//   );
// }

// // ─── Pill / Filter chip ───────────────────────────────────────────────────────
// export function Pill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
//   return (
//     <div onClick={onClick} style={{
//       padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
//       background: active ? D.accentLight : D.surface2,
//       border: `1px solid ${active ? 'rgba(79,127,255,.3)' : D.border}`,
//       color: active ? D.accent : D.textSecondary,
//       transition: 'all .12s',
//     }}>{label}</div>
//   );
// }

// // ─── Notification ─────────────────────────────────────────────────────────────
// interface Notif { id: number; msg: string; type: 'success' | 'error' | 'info'; }
// let _addNotif: (n: Notif) => void = () => {};
// export function notify(msg: string, type: 'success' | 'error' | 'info' = 'success') {
//   _addNotif({ id: Date.now(), msg, type });
// }

// export function Notifications() {
//   const [notifs, setNotifs] = React.useState<Notif[]>([]);
//   React.useEffect(() => {
//     _addNotif = (n) => {
//       setNotifs(p => [...p, n]);
//       setTimeout(() => setNotifs(p => p.filter(x => x.id !== n.id)), 3500);
//     };
//   }, []);
//   const colors = { success: D.green, error: D.red, info: D.accent };
//   return (
//     <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 2000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
//       {notifs.map(n => (
//         <div key={n.id} style={{
//           background: D.surface2, border: `1px solid ${D.border2}`,
//           borderLeft: `3px solid ${colors[n.type]}`,
//           borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 500,
//           display: 'flex', alignItems: 'center', gap: 8,
//           boxShadow: '0 4px 16px rgba(0,0,0,.4)',
//           animation: 'notifIn .25s ease', pointerEvents: 'all',
//           color: colors[n.type], maxWidth: 320,
//         }}>
//           {n.type === 'success' ? '✓' : n.type === 'error' ? '✕' : 'ℹ'} {n.msg}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ─── Loading Screen ───────────────────────────────────────────────────────────
// export function LoadingScreen() {
//   return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: D.bg }}>
//       <Spinner size={36} />
//     </div>
//   );
// }





















import React from 'react';
import { D } from './design-tokens';

// ─── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 14, light = false }: { size?: number; light?: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `2px solid ${light ? 'rgba(255,255,255,0.25)' : 'rgba(139,92,246,0.2)'}`,
      borderTopColor: light ? '#fff' : '#8b5cf6',
      borderRadius: '50%', animation: 'spin 0.6s linear infinite',
    }} />
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' | 'violet';
const BADGE_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  green:  { background: '#dcfce7',              color: '#15803d' },
  red:    { background: '#fef2f2',              color: '#dc2626' },
  amber:  { background: '#fef3c7',              color: '#92400e' },
  blue:   { background: '#dbeafe',              color: '#1d4ed8' },
  purple: { background: D.purpleLight,          color: D.purple  },
  violet: { background: 'rgba(139,92,246,.12)', color: '#6d28d9' },
  gray:   { background: 'rgba(100,110,130,.1)', color: D.textSecondary },
};
export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
      ...BADGE_STYLES[variant],
    }}>{children}</span>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'violet';
export function Button({
  variant = 'secondary', size = 'md', children, loading, disabled, onClick, type = 'button', style,
}: {
  variant?: BtnVariant; size?: 'xs' | 'sm' | 'md' | 'lg';
  children: React.ReactNode; loading?: boolean; disabled?: boolean;
  onClick?: () => void; type?: 'button' | 'submit'; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: 'all .15s',
    opacity: disabled || loading ? 0.5 : 1, borderRadius: 9,
  };
  const sizes = {
    xs: { padding: '3px 8px',   fontSize: 11 },
    sm: { padding: '6px 11px',  fontSize: 12 },
    md: { padding: '9px 15px',  fontSize: 13 },
    lg: { padding: '12px 20px', fontSize: 14 },
  };
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: '#8b5cf6', color: '#fff', boxShadow: '0 4px 12px rgba(139,92,246,.30)' },
    secondary: { background: 'rgba(255,255,255,.7)', color: '#2e1065', border: '1px solid rgba(139,92,246,.2)', backdropFilter: 'blur(8px)' },
    danger:    { background: 'rgba(239,68,68,.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,.2)' },
    success:   { background: 'rgba(34,197,94,.1)',  color: '#15803d', border: '1px solid rgba(34,197,94,.25)' },
    ghost:     { background: 'transparent', color: D.textSecondary },
    violet:    { background: 'rgba(139,92,246,.12)', color: '#6d28d9', border: '1px solid rgba(139,92,246,.25)' },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {loading && <Spinner size={12} light={variant === 'primary'} />}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.82)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(139,92,246,.14)',
      borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 4px 24px rgba(139,92,246,.08)',
      ...style,
    }}>{children}</div>
  );
}

export function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{
      padding: '16px 20px', borderBottom: '1px solid rgba(139,92,246,.12)',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, flex: 1, color: '#2e1065' }}>{title}</div>
      {children}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({
  title, size = 'md', onClose, children, footer,
}: {
  title: string; size?: 'sm' | 'md' | 'lg' | 'xl';
  onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const maxW = { sm: 420, md: 520, lg: 760, xl: 980 }[size];
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(46,16,101,.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20, animation: 'fadeIn .15s ease',
      }}>
      <div style={{
        background: 'rgba(255,255,255,.96)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139,92,246,.18)',
        borderRadius: 20,
        width: '100%', maxWidth: maxW, maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 24px 64px rgba(46,16,101,.25)',
        animation: 'slideUp .2s ease',
      }}>
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid rgba(139,92,246,.12)',
          display: 'flex', alignItems: 'center',
        }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, flex: 1, color: '#2e1065' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)',
            color: '#8b5cf6', fontSize: 14, padding: '4px 8px',
            cursor: 'pointer', borderRadius: 7, lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        {footer && (
          <div style={{
            padding: '16px 22px', borderTop: '1px solid rgba(139,92,246,.12)',
            display: 'flex', justifyContent: 'flex-end', gap: 8,
          }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

// ─── Form ─────────────────────────────────────────────────────────────────────
export function FormGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 10.5, fontWeight: 700,
        color: '#8b5cf6', marginBottom: 6,
        letterSpacing: '.10em', textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  background: 'rgba(139,92,246,.05)',
  border: '1.5px solid rgba(139,92,246,.18)',
  borderRadius: 10, color: '#2e1065', fontSize: 13.5,
  transition: 'all .15s', outline: 'none',
  fontFamily: "'DM Sans', sans-serif",
};

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}

export function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{
      ...inputBase, resize: 'vertical', minHeight: 80, ...props.style,
    }} />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} style={{ ...inputBase, cursor: 'pointer', ...props.style }}>
      {children}
    </select>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: 'left', padding: '10px 14px',
      fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', color: '#8b5cf6',
      borderBottom: '1px solid rgba(139,92,246,.15)',
      whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );
}

export function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{
      padding: '12px 14px', borderBottom: '1px solid rgba(139,92,246,.08)',
      verticalAlign: 'middle', color: '#2e1065', ...style,
    }}>{children}</td>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
export function Tabs({
  tabs, active, onChange,
}: { tabs: { key: string; label: string; badge?: number }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 2,
      borderBottom: '1px solid rgba(139,92,246,.15)',
      marginBottom: 20,
    }}>
      {tabs.map(t => (
        <div key={t.key} onClick={() => onChange(t.key)} style={{
          padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          borderBottom: `2px solid ${active === t.key ? '#8b5cf6' : 'transparent'}`,
          color: active === t.key ? '#6d28d9' : '#9ca3af',
          marginBottom: -1, transition: 'all .15s',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff',
              fontSize: 10, fontWeight: 700, padding: '1px 5px',
              borderRadius: 99, minWidth: 16, textAlign: 'center',
            }}>{t.badge}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon, title, sub, action, children,
}: { icon: string; title: string; sub?: string; action?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
        background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32,
      }}>{icon}</div>
      <div style={{
        fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700,
        color: '#2e1065', marginBottom: 6,
      }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: action || children ? 18 : 0 }}>{sub}</div>}
      {action}
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.82)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(139,92,246,.14)',
      borderRadius: 16, padding: '18px 20px', flex: 1,
      boxShadow: '0 2px 12px rgba(139,92,246,.07)',
    }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '.10em',
        textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800,
        color: color || '#2e1065', lineHeight: 1,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return (
    <div style={{
      height: 4, background: 'rgba(139,92,246,.12)',
      borderRadius: 99, overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', borderRadius: 99,
        width: `${Math.min(100, value)}%`,
        background: color || '#8b5cf6',
        transition: 'width .5s ease',
      }} />
    </div>
  );
}

// ─── Pill / Filter chip ───────────────────────────────────────────────────────
export function Pill({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: active ? 'rgba(139,92,246,.14)' : 'rgba(255,255,255,.7)',
      border: `1px solid ${active ? 'rgba(139,92,246,.35)' : 'rgba(139,92,246,.18)'}`,
      color: active ? '#6d28d9' : '#9ca3af',
      transition: 'all .14s',
      backdropFilter: 'blur(8px)',
    }}>{label}</div>
  );
}

// ─── Notification ─────────────────────────────────────────────────────────────
interface Notif { id: number; msg: string; type: 'success' | 'error' | 'info'; }
let _addNotif: (n: Notif) => void = () => {};
export function notify(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  _addNotif({ id: Date.now(), msg, type });
}

export function Notifications() {
  const [notifs, setNotifs] = React.useState<Notif[]>([]);
  React.useEffect(() => {
    _addNotif = (n) => {
      setNotifs(p => [...p, n]);
      setTimeout(() => setNotifs(p => p.filter(x => x.id !== n.id)), 3500);
    };
  }, []);
  const colors   = { success: '#10b981', error: '#ef4444', info: '#8b5cf6' };
  const bgColors = { success: 'rgba(16,185,129,.08)', error: 'rgba(239,68,68,.08)', info: 'rgba(139,92,246,.08)' };
  const icons    = { success: '✓', error: '✕', info: 'ℹ' };

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 2000,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {notifs.map(n => (
        <div key={n.id} style={{
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(16px)',
          border: `1px solid rgba(139,92,246,.15)`,
          borderLeft: `3px solid ${colors[n.type]}`,
          borderRadius: 12, padding: '12px 16px',
          fontSize: 13, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 8px 24px rgba(46,16,101,.18)',
          animation: 'notifIn .25s ease', pointerEvents: 'all',
          color: colors[n.type], maxWidth: 320,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: bgColors[n.type],
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{icons[n.type]}</span>
          {n.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh',
      background: 'radial-gradient(ellipse 70% 55% at 75% -5%, rgba(139,92,246,.12) 0%, transparent 55%), #f5f0ff',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, boxShadow: '0 8px 24px rgba(139,92,246,.35)',
        }}>🎓</div>
        <Spinner size={24}/>
      </div>
    </div>
  );
}