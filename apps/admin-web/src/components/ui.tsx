import React from 'react';
import { COLORS } from '../constants';

// ── Card ──────────────────────────────────────────────────────────────────
export function Card({
  children, style, title,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <div style={{ ...cardStyles.card, ...style }}>
      {title && <h3 style={cardStyles.title}>{title}</h3>}
      {children}
    </div>
  );
}

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: COLORS.white, borderRadius: 12,
    padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: `1px solid ${COLORS.border}`,
  },
  title: {
    fontSize: 16, fontWeight: 700,
    color: COLORS.textPrimary, marginBottom: 16,
  },
};

// ── Stat card ─────────────────────────────────────────────────────────────
export function StatCard({
  label, value, icon, color,
}: {
  label: string; value: string | number; icon: string; color: string;
}) {
  return (
    <div style={{ ...statStyles.card, borderTop: `4px solid ${color}` }}>
      <div style={statStyles.icon}>{icon}</div>
      <div style={{ ...statStyles.value, color }}>{value}</div>
      <div style={statStyles.label}>{label}</div>
    </div>
  );
}

const statStyles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 20,
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    minWidth: 160, flex: 1,
  },
  icon: { fontSize: 28, marginBottom: 8 },
  value: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  label: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
};

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({
  label, color, bg,
}: {
  label: string; color: string; bg: string;
}) {
  return (
    <span style={{
      backgroundColor: bg, color,
      padding: '2px 10px', borderRadius: 99,
      fontSize: 12, fontWeight: 700,
    }}>
      {label}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────
export function Button({
  children, onClick, variant = 'primary', disabled, size = 'md', style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'ghost';
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}) {
  const bg = {
    primary: COLORS.primary,
    success: COLORS.success,
    danger:  COLORS.danger,
    ghost:   'transparent',
  }[variant];

  const color = variant === 'ghost' ? COLORS.textSecondary : COLORS.white;
  const border = variant === 'ghost' ? `1px solid ${COLORS.border}` : 'none';
  const padding = size === 'sm' ? '6px 12px' : '10px 18px';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: bg, color, border,
        padding, borderRadius: 8,
        fontSize: size === 'sm' ? 13 : 14,
        fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'opacity 0.15s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────
export function Table({
  headers, rows, emptyText = 'No data found.',
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}) {
  return (
    <div style={tableStyles.wrapper}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={tableStyles.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={headers.length}
                style={{ ...tableStyles.td, textAlign: 'center', color: COLORS.textMuted }}
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                style={{ backgroundColor: i % 2 === 0 ? COLORS.white : '#FAFAFA' }}
              >
                {row.map((cell, j) => (
                  <td key={j} style={tableStyles.td}>{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const tableStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    overflowX: 'auto', borderRadius: 10,
    border: `1px solid ${COLORS.border}`,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    backgroundColor: COLORS.primary, color: COLORS.white,
    padding: '12px 16px', textAlign: 'left',
    fontSize: 13, fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 16px', fontSize: 13,
    color: COLORS.textPrimary, borderBottom: `1px solid ${COLORS.border}`,
    verticalAlign: 'middle',
  },
};

// ── Modal ─────────────────────────────────────────────────────────────────
export function Modal({
  title, onClose, children, width = 480,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div
        style={{ ...modalStyles.modal, width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={modalStyles.header}>
          <span style={modalStyles.title}>{title}</span>
          <button style={modalStyles.close} onClick={onClose}>✕</button>
        </div>
        <div style={modalStyles.body}>{children}</div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: COLORS.white, borderRadius: 16,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', borderBottom: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.primary,
  },
  title: { fontSize: 16, fontWeight: 700, color: COLORS.white },
  close: {
    background: 'none', border: 'none',
    color: 'rgba(255,255,255,0.8)', fontSize: 20, cursor: 'pointer',
  },
  body: { padding: 24 },
};

// ── Input ─────────────────────────────────────────────────────────────────
export function Input({
  label, value, onChange, type = 'text', placeholder,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 600,
          color: COLORS.textPrimary, marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '10px 14px',
          border: `1.5px solid ${COLORS.border}`, borderRadius: 8,
          fontSize: 14, color: COLORS.textPrimary,
          outline: 'none', backgroundColor: COLORS.background,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────
export function Select({
  label, value, onChange, options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block', fontSize: 13, fontWeight: 600,
          color: COLORS.textPrimary, marginBottom: 6,
        }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px',
          border: `1.5px solid ${COLORS.border}`, borderRadius: 8,
          fontSize: 14, color: COLORS.textPrimary,
          backgroundColor: COLORS.background, outline: 'none',
          boxSizing: 'border-box',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────
export function PageHeader({
  title, subtitle, action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'flex-start', marginBottom: 24,
    }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: COLORS.textPrimary }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}