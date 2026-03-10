
import React, { useEffect, useState } from 'react';
import { AdminAPI } from '../services/api';
import { StatCard, Card, PageHeader, Table, Badge } from '../components/ui';
import { COLORS } from '../constants';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';

/* ─────────────────────────────────────────────────────────────────
   DESIGN TOKENS  – all visual choices live here, nothing else
   changed except the JSX wrapper + background treatment
───────────────────────────────────────────────────────────────── */
const D = {
  bg: '#F9FAFB',                // outer page canvas  (matches screenshot)
  surface: '#FFFFFF',           // card/panel surface
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  purple: '#7C3AED',            // primary accent
  purpleLight: '#EDE9FE',
  purpleMid: '#A78BFA',
  green: '#10B981',
  greenLight: '#D1FAE5',
  red: '#EF4444',
  redLight: '#FEE2E2',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  shadow: '0 1px 3px 0 rgba(0,0,0,.08), 0 1px 2px -1px rgba(0,0,0,.06)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.07), 0 2px 4px -2px rgba(0,0,0,.05)',
  radius: 12,
  radiusSm: 8,
};

/* ─── tiny local component overrides so the surrounding project
   components (StatCard, Card, Table, Badge) keep working exactly
   as before — we only wrap/style the page shell ─────────────── */

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalStudents: 0, totalProfessors: 0,
    pendingResets: 0, totalDepts: 0,
  });
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [attendanceTrend, setAttendanceTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, profsRes, deptsRes, resetsRes, auditRes, reportRes] =
          await Promise.all([
            AdminAPI.listStudents(1, ''),
            AdminAPI.listProfessors(),
            AdminAPI.listDepartments(),
            AdminAPI.listDeviceResets('PENDING'),
            AdminAPI.getAuditLogs(1, ''),
            AdminAPI.getAttendanceReport({}),
          ]);

        setStats({
          totalStudents: studentsRes.data.pagination?.total || 0,
          totalProfessors: profsRes.data.data?.length || 0,
          pendingResets: resetsRes.data.data?.length || 0,
          totalDepts: deptsRes.data.data?.length || 0,
        });

        setRecentAudit(auditRes.data.data?.slice(0, 8) || []);

        const report: any[] = reportRes.data.data || [];
        const byDate: Record<string, { present: number; absent: number }> = {};
        report.forEach((r: any) => {
          const d = r.session_date?.split('T')[0];
          if (!d) return;
          if (!byDate[d]) byDate[d] = { present: 0, absent: 0 };
          if (r.status === 'PRESENT') byDate[d].present++;
          else byDate[d].absent++;
        });
        const trend = Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-14)
          .map(([date, counts]) => ({ date, ...counts }));
        setAttendanceTrend(trend);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* ── Custom tooltip for the bar chart ─────────────────────── */
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={styles.tooltip}>
        <p style={styles.tooltipLabel}>{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ ...styles.tooltipRow, color: p.fill }}>
            <span style={styles.tooltipDot(p.fill)} />
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    /* ── Page canvas – subtle grid pattern like the screenshot ─ */
    <div style={styles.pageCanvas}>
      {/* decorative blurred blobs */}
      <div style={styles.blob1} />
      <div style={styles.blob2} />

      <div style={styles.inner}>
        {/* ── Header ─────────────────────────────────────────── */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.h1}>Dashboard</h1>
            <p style={styles.subtitle}>Here's an overview of your SmartAttend system</p>
          </div>
          <div style={styles.headerBadge}>
            <span style={styles.liveIndicator} />
            Live data
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────── */}
        <div style={styles.statsRow}>
          {[
            { label: 'Total Students', value: stats.totalStudents, icon: '👨‍🎓', accent: D.purple, light: D.purpleLight },
            { label: 'Professors',     value: stats.totalProfessors, icon: '👨‍🏫', accent: D.green,  light: D.greenLight },
            { label: 'Departments',    value: stats.totalDepts,       icon: '🏛️',  accent: D.amber,  light: D.amberLight },
            {
              label: 'Pending Resets',
              value: stats.pendingResets,
              icon: '📱',
              accent: stats.pendingResets > 0 ? D.red : D.textMuted,
              light:  stats.pendingResets > 0 ? D.redLight : D.borderLight,
            },
          ].map((s) => (
            <div key={s.label} style={styles.statCard}>
              <div style={styles.statIconWrap(s.light)}>
                <span style={{ fontSize: 20 }}>{s.icon}</span>
              </div>
              <div>
                <p style={styles.statLabel}>{s.label}</p>
                <p style={{ ...styles.statValue, color: s.accent }}>
                  {loading ? '—' : s.value.toLocaleString()}
                </p>
              </div>
              <div style={styles.statGlow(s.accent)} />
            </div>
          ))}
        </div>

        {/* ── Charts row ─────────────────────────────────────── */}
        <div style={styles.chartsRow}>

          {/* Attendance trend */}
          <div style={{ ...styles.card, flex: 2, minWidth: 0 }}>
            <div style={styles.cardHeader}>
              <div>
                <h3 style={styles.cardTitle}>Attendance Trend</h3>
                <p style={styles.cardSub}>Last 14 days · Present vs Absent</p>
              </div>
            </div>
            {attendanceTrend.length === 0 ? (
              <div style={styles.empty}>
                <span style={{ fontSize: 36, marginBottom: 8 }}>📊</span>
                <p style={{ color: D.textMuted, fontSize: 14 }}>No attendance data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={attendanceTrend} barGap={4}>
                  <defs>
                    <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={D.purple} stopOpacity={1} />
                      <stop offset="100%" stopColor={D.purpleMid} stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="gAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={D.red} stopOpacity={0.85} />
                      <stop offset="100%" stopColor={D.red} stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: D.textMuted, fontFamily: 'inherit' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: D.textMuted, fontFamily: 'inherit' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: 12, fontSize: 12, color: D.textSecondary }}
                  />
                  <Bar dataKey="present" fill="url(#gPresent)" name="Present" radius={[6,6,0,0]} maxBarSize={28} />
                  <Bar dataKey="absent"  fill="url(#gAbsent)"  name="Absent"  radius={[6,6,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Device resets */}
          <div style={{ ...styles.card, flex: 1, minWidth: 200 }}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>Device Resets</h3>
            </div>
            {stats.pendingResets === 0 ? (
              <div style={styles.empty}>
                <div style={styles.checkCircle}>✓</div>
                <p style={{ color: D.textSecondary, fontSize: 14, fontWeight: 500, marginTop: 12 }}>
                  All clear
                </p>
                <p style={{ color: D.textMuted, fontSize: 12, marginTop: 4 }}>
                  No pending requests
                </p>
              </div>
            ) : (
              <div style={styles.resetAlert}>
                <div style={styles.resetBadge}>
                  <span style={styles.resetCount}>{stats.pendingResets}</span>
                </div>
                <p style={styles.resetLabel}>pending approval</p>
                <a href="/device-resets" style={styles.resetLink}>
                  Review requests →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent activity ────────────────────────────────── */}
        <div style={{ ...styles.card, marginTop: 0 }}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Recent Activity</h3>
              <p style={styles.cardSub}>Latest audit log entries</p>
            </div>
            <div style={styles.viewAllBtn}>View all →</div>
          </div>
          <Table
            headers={['Time', 'User', 'Action', 'Role']}
            emptyText="No recent activity"
            rows={recentAudit.map((log) => [
              <span style={{ fontSize: 12, color: D.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                {new Date(log.created_at).toLocaleString()}
              </span>,
              <span style={{ fontSize: 13, color: D.textPrimary, fontWeight: 500 }}>
                {log.email || '—'}
              </span>,
              <span style={styles.actionBadge(D.purple)}>
                {log.action}
              </span>,
              <span style={styles.actionBadge(D.textSecondary)}>
                {log.role || 'SYSTEM'}
              </span>,
            ])}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STYLES
───────────────────────────────────────────────────────────────── */
const styles: Record<string, any> = {
  /* canvas */
  pageCanvas: {
    position: 'relative',
    minHeight: '100vh',
    background: D.bg,
    /* subtle dot-grid like the screenshot */
    backgroundImage: `radial-gradient(circle, ${D.border} 1px, transparent 1px)`,
    backgroundSize: '28px 28px',
    overflow: 'hidden',
  },
  /* decorative blobs – purely visual, pointer-events none */
  blob1: {
    position: 'absolute',
    top: -120,
    right: -160,
    width: 480,
    height: 480,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124,58,237,.12) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  blob2: {
    position: 'absolute',
    bottom: -80,
    left: -100,
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16,185,129,.08) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    padding: '32px 32px 48px',
    maxWidth: 1200,
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },

  /* header */
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    color: D.textPrimary,
    margin: 0,
    letterSpacing: '-0.5px',
    fontFamily: 'inherit',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 14,
    color: D.textMuted,
    fontFamily: 'inherit',
  },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 500,
    color: D.green,
    background: D.greenLight,
    border: `1px solid ${D.green}30`,
    borderRadius: 20,
    padding: '4px 12px',
  },
  liveIndicator: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: D.green,
    boxShadow: `0 0 0 2px ${D.green}40`,
    display: 'inline-block',
    animation: 'pulse 2s infinite',
  },

  /* stat cards */
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: 16,
  },
  statCard: {
    position: 'relative',
    background: D.surface,
    border: `1px solid ${D.border}`,
    borderRadius: D.radius,
    padding: '20px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    boxShadow: D.shadow,
    overflow: 'hidden',
    transition: 'box-shadow .2s, transform .2s',
  },
  statIconWrap: (bg: string) => ({
    width: 44,
    height: 44,
    borderRadius: D.radiusSm,
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }),
  statLabel: {
    margin: 0,
    fontSize: 12,
    color: D.textMuted,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  statValue: {
    margin: '2px 0 0',
    fontSize: 28,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: '-1px',
    fontVariantNumeric: 'tabular-nums',
  },
  statGlow: (accent: string) => ({
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: `radial-gradient(circle, ${accent}18 0%, transparent 70%)`,
    pointerEvents: 'none',
  }),

  /* generic card */
  card: {
    background: D.surface,
    border: `1px solid ${D.border}`,
    borderRadius: D.radius,
    padding: '20px 24px 24px',
    boxShadow: D.shadow,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  cardTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
    color: D.textPrimary,
    fontFamily: 'inherit',
  },
  cardSub: {
    margin: '3px 0 0',
    fontSize: 12,
    color: D.textMuted,
  },
  viewAllBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: D.purple,
    cursor: 'pointer',
  },

  /* charts row */
  chartsRow: {
    display: 'flex',
    gap: 16,
    flexWrap: 'wrap' as const,
  },

  /* empty state */
  empty: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 0',
    gap: 4,
  },

  /* device reset */
  resetAlert: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    padding: '20px 0',
    gap: 6,
  },
  resetBadge: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    background: D.redLight,
    border: `3px solid ${D.red}30`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetCount: {
    fontSize: 32,
    fontWeight: 800,
    color: D.red,
    lineHeight: 1,
  },
  resetLabel: {
    fontSize: 13,
    color: D.textSecondary,
    margin: 0,
  },
  resetLink: {
    display: 'inline-block',
    marginTop: 10,
    padding: '8px 18px',
    background: D.red,
    color: '#fff',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    boxShadow: `0 2px 8px ${D.red}40`,
  },

  /* all-clear */
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: D.greenLight,
    color: D.green,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    fontWeight: 700,
    border: `2px solid ${D.green}30`,
  },

  /* custom tooltip */
  tooltip: {
    background: D.surface,
    border: `1px solid ${D.border}`,
    borderRadius: D.radiusSm,
    padding: '10px 14px',
    boxShadow: D.shadowMd,
    fontSize: 13,
  },
  tooltipLabel: {
    margin: '0 0 6px',
    fontWeight: 600,
    color: D.textPrimary,
    fontSize: 12,
  },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: 0,
    fontSize: 12,
  },
  tooltipDot: (color: string) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),

  /* audit table badges */
  actionBadge: (color: string) => ({
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: color + '15',
    color,
    letterSpacing: '0.2px',
  }),
};