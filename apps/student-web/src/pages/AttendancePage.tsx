import React, { useState, useEffect } from 'react';
import { AttendanceAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Tabs, StatusPill, ProgressBar, Badge, Spinner, EmptyState } from '../components/ui';
import type { AttendanceRecord } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function pctColor(pct: number) {
  if (pct >= 75) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

export default function AttendancePage() {
  const [records, setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('history');

  useEffect(() => {
    AttendanceAPI.getHistory()
      .then(r => setRecords(r.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  // Compute per-course summary
  const courseMap: Record<string, { name: string; code: string; total: number; present: number }> = {};
  records.forEach(r => {
    const key = r.course_code;
    if (!courseMap[key]) courseMap[key] = { name: r.course_name, code: r.course_code, total: 0, present: 0 };
    courseMap[key].total++;
    if (r.status === 'PRESENT') courseMap[key].present++;
  });
  const courses = Object.values(courseMap).sort((a, b) => a.code.localeCompare(b.code));

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;

  return (
    <div>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>My Attendance</div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'summary', label: '📊 Course Summary' },
          { key: 'history', label: `📋 History (${records.length})` },
        ]}
      />

      {/* Course summary */}
      {activeTab === 'summary' && (
        courses.length === 0 ? (
          <EmptyState icon="📊" title="No attendance data" sub="Attend a session to see your stats here" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {courses.map(c => {
              const pct = c.total > 0 ? Math.round(c.present / c.total * 100) : 0;
              const color = pctColor(pct);
              return (
                <div key={c.code} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: 18, borderLeft: `4px solid ${color}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>{c.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color }}>{pct}%</div>
                      <div style={{ fontSize: 10, color: D.textMuted }}>attendance</div>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={color} />
                  <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                    <span style={{ fontSize: 12, color: D.green, fontWeight: 600 }}>✅ {c.present} present</span>
                    <span style={{ fontSize: 12, color: D.red, fontWeight: 600 }}>❌ {c.total - c.present} absent</span>
                    <span style={{ fontSize: 12, color: D.textMuted }}>📋 {c.total} total</span>
                  </div>
                  {pct < 75 && (
                    <div style={{ marginTop: 10, background: D.redLight, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: D.red, fontWeight: 600 }}>
                      ⚠️ Below 75% threshold — {Math.ceil((0.75 * c.total - c.present) / 0.25)} more sessions needed to reach 75%
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* History list */}
      {activeTab === 'history' && (
        records.length === 0 ? (
          <EmptyState icon="📋" title="No attendance history" sub="Your sessions will appear here after your first class" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {records.map((r, i) => (
              <div key={i} style={{
                background: D.surface, border: `1px solid ${D.border}`, borderRadius: 14, padding: '14px 18px',
                borderLeft: `4px solid ${r.status === 'PRESENT' ? D.green : D.red}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13 }}>{r.course_name}</div>
                    <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>{r.course_code} · {r.professor_name}</div>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 8 }}>🕐 {fmtDate(r.started_at)}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.face_score != null && (
                    <span style={{ fontSize: 11, background: D.surface2, borderRadius: 6, padding: '3px 8px', color: D.textSecondary }}>
                      Face: <b style={{ color: D.textPrimary }}>{Math.round(r.face_score * 100)}%</b>
                    </span>
                  )}
                  {r.liveness_score != null && (
                    <span style={{ fontSize: 11, background: D.surface2, borderRadius: 6, padding: '3px 8px', color: D.textSecondary }}>
                      Liveness: <b style={{ color: D.textPrimary }}>{Math.round(r.liveness_score * 100)}%</b>
                    </span>
                  )}
                  {r.scene_score != null && (
                    <span style={{ fontSize: 11, background: D.surface2, borderRadius: 6, padding: '3px 8px', color: D.textSecondary }}>
                      Scene: <b style={{ color: D.textPrimary }}>{Math.round(r.scene_score * 100)}%</b>
                    </span>
                  )}
                  {r.marked_by === 'PROFESSOR' && (
                    <Badge variant="blue">✋ Professor Override</Badge>
                  )}
                  {r.verification_status === 'SUSPICIOUS' && (
                    <Badge variant="amber">⚠️ Suspicious</Badge>
                  )}
                </div>
                {r.override_reason && (
                  <div style={{ fontSize: 11, color: D.accent, marginTop: 8, fontStyle: 'italic' }}>"{r.override_reason}"</div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}