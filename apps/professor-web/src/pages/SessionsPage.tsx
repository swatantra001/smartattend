

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, Pill, ProgressBar, Spinner, EmptyState, notify } from '../components/ui';
import type { Course, SessionSummary, RosterStudent } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
function statusColor(s: string) {
  return s === 'ACTIVE' ? D.green : s === 'ENDED' ? D.accent : s === 'EXPIRED' ? D.amber : D.red;
}
function statusLabel(s: string) {
  return s === 'ACTIVE' ? '🟢 Active' : s === 'ENDED' ? '🔵 Ended' : s === 'EXPIRED' ? '🟡 Expired' : '🔴 Cancelled';
}
function vsColor(vs: string | undefined) {
  if (vs === 'VERIFIED')   return D.green;
  if (vs === 'SUSPICIOUS') return D.amber;
  if (vs === 'FAILED')     return D.red;
  return D.textMuted;
}
function vsLabel(vs: string | undefined) {
  if (vs === 'VERIFIED')   return '✅ Verified';
  if (vs === 'SUSPICIOUS') return '⚠️ Suspicious';
  if (vs === 'FAILED')     return '❌ Failed';
  if (vs === 'PENDING')    return '⏳ Pending';
  return '—';
}

// ─── Score pill ────────────────────────────────────────────────────────────────
function ScorePill({ label, value, threshold }: { label: string; value?: number; threshold: number }) {
  if (value == null) return null;
  const pct   = Math.round(value * 100);
  const color = value >= threshold ? D.green : D.red;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}44`,
    }}>
      {label} {pct}%
    </span>
  );
}

// ─── Full-screen image viewer ──────────────────────────────────────────────────
function ImageFullscreen({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <img
        src={`data:image/jpeg;base64,${src}`}
        alt="Captured face"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '88vw', maxHeight: '88vh', borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,.8)', objectFit: 'contain',
        }}
      />
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
          borderRadius: '50%', width: 40, height: 40, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 18, cursor: 'pointer',
        }}
      >✕</button>
      <div style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,.4)', fontSize: 12,
      }}>
        Press Esc or click anywhere to close
      </div>
    </div>
  );
}

// ─── Roster table row ──────────────────────────────────────────────────────────
function RosterRow({
  s, onEdit, onViewImage,
}: {
  s: RosterStudent;
  onEdit: () => void;
  onViewImage: (src: string) => void;
}) {
  const accent   = s.status === 'PRESENT' ? D.green : D.red;
  const initials = s.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
	console.log("student-details: ", s)
  return (
    <tr
      onMouseEnter={e => (e.currentTarget.style.background = D.surface2)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      style={{ transition: 'background .12s' }}
    >
      {/* Avatar / captured photo */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, width: 54 }}>
        {s.captured_image_b64 ? (
          <div
            onClick={() => onViewImage(s.captured_image_b64!)}
            title="Click to enlarge"
            style={{
              width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
              cursor: 'zoom-in', border: `2px solid ${accent}66`,
              position: 'relative', flexShrink: 0,
            }}
          >
			
            <img
              src={`data:image/jpeg;base64,${s.captured_image_b64}`}
              alt={s.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: accent + '16', border: `2px solid ${accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: accent,
          }}>
            {initials}
          </div>
        )}
      </td>

      {/* Name */}
      <td style={{ padding: '10px 14px', fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ fontSize: 13 }}>{s.name}</div>
        {s.marked_by === 'PROFESSOR' && (
          <div style={{ fontSize: 10, color: D.accent, fontWeight: 700, marginTop: 2 }}>✋ Manual</div>
        )}
      </td>

      {/* Roll */}
      <td style={{ padding: '10px 14px', fontSize: 12, color: D.textSecondary, borderBottom: `1px solid ${D.border}` }}>
        {s.roll_number}
      </td>

      {/* Status */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}` }}>
        <span style={{
          padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
          background: s.status === 'PRESENT' ? D.greenLight : D.redLight,
          color: s.status === 'PRESENT' ? D.green : D.red,
        }}>
          {s.status === 'PRESENT' ? '✅' : '❌'} {s.status}
        </span>
      </td>

      {/* Verification */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}` }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: vsColor(s.verification_status) }}>
          {vsLabel(s.verification_status)}
        </span>
      </td>

      {/* Scores */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}` }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <ScorePill label="F" value={s.face_score}     threshold={0.65} />
          <ScorePill label="L" value={s.liveness_score} threshold={0.70} />
          <ScorePill label="S" value={s.scene_score}    threshold={0.60} />
          {s.face_score == null && <span style={{ fontSize: 11, color: D.textMuted }}>—</span>}
        </div>
      </td>

      {/* Face ID */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}`, textAlign: 'center' }}>
        <span style={{ fontSize: 14 }}>{s.face_enrolled ? '✅' : '⚠️'}</span>
      </td>

      {/* Override note */}
      <td style={{
        padding: '10px 14px', fontSize: 11, color: D.textMuted,
        borderBottom: `1px solid ${D.border}`, maxWidth: 160,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {s.override_reason || '—'}
      </td>

      {/* Edit button */}
      <td style={{ padding: '10px 14px', borderBottom: `1px solid ${D.border}` }}>
        <Button size="xs" variant="secondary" onClick={onEdit}>Edit</Button>
      </td>
    </tr>
  );
}

// ─── Roster Modal ──────────────────────────────────────────────────────────────
function RosterModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData]         = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<RosterStudent | null>(null);
  const [ovStatus, setOvStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [ovReason, setOvReason] = useState('');
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [fullImg, setFullImg]   = useState<string | null>(null);

  useEffect(() => {
    ProfAPI.getSessionRoster(sessionId)
      .then(r => setData(r.data.data))
      .catch(() => notify('Failed to load roster', 'error'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  async function handleOverride() {
    if (!selected || !ovReason.trim()) { notify('Reason required', 'error'); return; }
    setSaving(true);
    try {
      await ProfAPI.manualOverride(sessionId, selected.student_id, ovStatus, ovReason.trim());
      setData((prev: any) => ({
        ...prev,
        students: prev.students.map((s: RosterStudent) =>
          s.student_id === selected.student_id
            ? { ...s, status: ovStatus, override_reason: ovReason.trim(), marked_by: 'PROFESSOR' }
            : s
        ),
      }));
      setSelected(null); setOvReason('');
      notify('Override applied & student notified');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setSaving(false); }
  }

  const students: RosterStudent[] = data?.students || [];
  const visible = search.trim()
    ? students.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.roll_number.toLowerCase().includes(search.toLowerCase())
      )
    : students;

  const present    = students.filter(s => s.status === 'PRESENT').length;
  const absent     = students.filter(s => s.status === 'ABSENT').length;
  const susp       = students.filter(s => s.verification_status === 'SUSPICIOUS').length;
  const pct        = students.length > 0 ? Math.round(present / students.length * 100) : 0;
  const pctColor   = pct >= 75 ? D.green : pct >= 50 ? D.amber : D.red;
  const withPhoto  = students.filter(s => s.captured_image_b64).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={e => e.target === e.currentTarget && onClose()}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
          backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000, padding: 20,
        }}
      >
        <div style={{
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: 20, width: '100%', maxWidth: 920,
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 32px 80px rgba(0,0,0,.55)',
          overflow: 'hidden',
        }}>

          {/* ── Modal header ── */}
          <div style={{
            padding: '18px 24px', borderBottom: `1px solid ${D.border}`,
            display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17 }}>
                {data ? data.session?.course_name : 'Session Roster'}
              </div>
              {data && (
                <div style={{ fontSize: 12, color: D.textMuted, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{data.session?.course_code}</span>
                  <span>·</span>
                  <span>{fmtDate(data.session?.started_at)}</span>
                  {withPhoto > 0 && (
                    <>
                      <span>·</span>
                      <span style={{ color: D.accent, fontWeight: 600 }}>📷 {withPhoto} captures</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: D.textMuted, pointerEvents: 'none' }}>🔍</span>
              <input
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 12px 7px 30px', background: D.surface2,
                  border: `1px solid ${D.border}`, borderRadius: 9,
                  color: D.textPrimary, fontSize: 13, outline: 'none',
                  width: 180, fontFamily: 'inherit',
                }}
              />
            </div>

            <button
              onClick={onClose}
              style={{
                background: D.surface2, border: `1px solid ${D.border}`,
                borderRadius: '50%', width: 34, height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: D.textMuted, fontSize: 16, cursor: 'pointer', flexShrink: 0,
              }}
            >✕</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          ) : (
            <>
              {/* ── Stat bar ── */}
              <div style={{
                display: 'flex', background: D.surface2,
                borderBottom: `1px solid ${D.border}`, flexShrink: 0,
              }}>
                {[
                  { label: 'Present',    value: present,   color: D.green   },
                  { label: 'Absent',     value: absent,    color: D.red     },
                  { label: 'Suspicious', value: susp,      color: D.amber   },
                  { label: 'Rate',       value: pct + '%', color: pctColor  },
                ].map((stat, i, arr) => (
                  <div
                    key={stat.label}
                    style={{
                      flex: 1, padding: '14px 0', textAlign: 'center',
                      borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none',
                    }}
                  >
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: stat.color }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 10, color: D.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Attendance progress bar ── */}
              <div style={{ padding: '10px 24px', borderBottom: `1px solid ${D.border}`, flexShrink: 0 }}>
                <ProgressBar value={pct} color={pctColor} />
              </div>

              {/* ── Table ── */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: D.surface }}>
                    <tr>
                      {['Photo', 'Student', 'Roll', 'Status', 'Verification', 'Scores', 'Face ID', 'Note', ''].map(h => (
                        <th
                          key={h}
                          style={{
                            textAlign: 'left', padding: '10px 14px', fontSize: 10,
                            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em',
                            color: D.textMuted, borderBottom: `1px solid ${D.border}`,
                            whiteSpace: 'nowrap', background: D.surface,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 40, textAlign: 'center', color: D.textMuted, fontSize: 13 }}>
                          No students match your search
                        </td>
                      </tr>
                    ) : (
                      visible.map(s => (
                        <RosterRow
                          key={s.student_id}
                          s={s}
                          onViewImage={setFullImg}
                          onEdit={() => {
                            setSelected(s);
                            setOvStatus(s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                            setOvReason('');
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Inline override panel ── */}
              {selected && (
                <div style={{
                  padding: '18px 24px', borderTop: `1px solid ${D.border}`,
                  background: D.surface2, flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                    {/* Photo or initials */}
                    {selected.captured_image_b64 ? (
                      <div
                        onClick={() => setFullImg(selected.captured_image_b64!)}
                        style={{
                          width: 52, height: 52, borderRadius: 12, overflow: 'hidden',
                          cursor: 'zoom-in', border: `2px solid ${D.border}`, flexShrink: 0,
                        }}
                      >
                        <img
                          src={`data:image/jpeg;base64,${selected.captured_image_b64}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 52, height: 52, borderRadius: 12, background: D.surface3,
                        border: `2px solid ${D.border}`, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontFamily: "'Syne',sans-serif",
                        fontWeight: 800, fontSize: 18, color: D.textSecondary, flexShrink: 0,
                      }}>
                        {selected.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15 }}>{selected.name}</div>
                      <div style={{ fontSize: 12, color: D.textMuted }}>{selected.roll_number}</div>
                    </div>

                    {/* Score pills */}
                    <div style={{ display: 'flex', gap: 5 }}>
                      <ScorePill label="Face"     value={selected.face_score}     threshold={0.65} />
                      <ScorePill label="Liveness" value={selected.liveness_score} threshold={0.70} />
                      <ScorePill label="Scene"    value={selected.scene_score}    threshold={0.60} />
                    </div>

                    <button
                      onClick={() => setSelected(null)}
                      style={{ background: 'none', border: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer', padding: 4 }}
                    >✕</button>
                  </div>

                  {/* Controls row */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      {(['PRESENT', 'ABSENT'] as const).map(st => (
                        <button
                          key={st}
                          onClick={() => setOvStatus(st)}
                          style={{
                            padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                            fontWeight: 700, fontSize: 13, transition: 'all .15s', fontFamily: 'inherit',
                            border: `1.5px solid ${ovStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.border}`,
                            background: ovStatus === st ? (st === 'PRESENT' ? D.greenLight : D.redLight) : 'transparent',
                            color: ovStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.textSecondary,
                          }}
                        >
                          {st === 'PRESENT' ? '✅ Present' : '❌ Absent'}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={ovReason}
                      onChange={e => setOvReason(e.target.value)}
                      placeholder="Reason (required) — e.g. physically verified, student appeal…"
                      rows={2}
                      style={{
                        flex: 1, padding: '8px 12px', background: D.surface,
                        border: `1px solid ${D.border}`, borderRadius: 9,
                        color: D.textPrimary, fontSize: 13, resize: 'none',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
                      <Button size="sm" variant="primary" loading={saving} onClick={handleOverride}>
                        Save & Notify
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Full-screen image viewer */}
      {fullImg && <ImageFullscreen src={fullImg} onClose={() => setFullImg(null)} />}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
type FilterType = 'ALL' | 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'CANCELLED';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [courses, setCourses]           = useState<Course[]>([]);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [sessions, setSessions]         = useState<SessionSummary[]>([]);
  const [loading, setLoading]           = useState(false);
  const [filter, setFilter]             = useState<FilterType>('ALL');
  const [rosterSession, setRosterSession] = useState<string | null>(null);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  useEffect(() => {
    ProfAPI.getCourses().then(r => {
      const list: Course[] = r.data.data || [];
      setCourses(list);
      if (list.length > 0) selectCourse(list[0]);
    });
  }, []);

  const selectCourse = useCallback(async (c: Course) => {
    setActiveCourse(c); setSessions([]); setFilter('ALL'); setSelectedIds(new Set()); setLoading(true);
    try {
      const r = await ProfAPI.getCourseSessions(c.course_id);
      setSessions(r.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  async function handleDelete(sessionId: string) {
    if (!confirm('Permanently delete this session and all its attendance records?')) return;
    try {
      await ProfAPI.deleteSession(sessionId);
      setSessions(p => p.filter(s => s.session_id !== sessionId));
      notify('Session deleted');
    } catch (err: any) { notify(err.response?.data?.error || 'Failed', 'error'); }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds].filter(id => sessions.find(s => s.session_id === id && s.status !== 'ACTIVE'));
    if (ids.length === 0) { notify('No deletable sessions selected (ACTIVE sessions cannot be deleted)', 'error'); return; }
    if (!confirm(`Permanently delete ${ids.length} session(s)?`)) return;
    try {
      await ProfAPI.bulkDeleteSessions(ids);
      setSessions(p => p.filter(s => !ids.includes(s.session_id)));
      setSelectedIds(new Set());
      notify(`Deleted ${ids.length} session(s)`);
    } catch (err: any) { notify(err.response?.data?.error || 'Failed', 'error'); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const filtered = filter === 'ALL' ? sessions : sessions.filter(s => s.status === filter);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800 }}>Sessions</div>
        <div style={{ fontSize: 12, color: D.textMuted, marginTop: 2 }}>Browse and manage attendance sessions</div>
      </div>

      {/* Course pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {courses.map(c => (
          <Pill
            key={c.course_id}
            label={`${c.name}${c.section ? ` (${c.section})` : ''}`}
            active={activeCourse?.course_id === c.course_id}
            onClick={() => selectCourse(c)}
          />
        ))}
      </div>

      {/* Status filters + bulk actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18, alignItems: 'center' }}>
        {(['ALL', 'ACTIVE', 'ENDED', 'EXPIRED', 'CANCELLED'] as FilterType[]).map(f => (
          <Pill key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
        ))}
        {selectedIds.size > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button variant="danger" size="sm" onClick={handleBulkDelete}>
              🗑️ Delete {selectedIds.size} selected
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}
      </div>

      {/* Session list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="📋" title="No sessions found" sub="Start a session from the Home page" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: D.textMuted,
            textTransform: 'uppercase', letterSpacing: '.08em',
            padding: '0 4px', marginBottom: 2,
          }}>
            {filtered.length} session{filtered.length !== 1 ? 's' : ''}
          </div>

          {filtered.map(s => {
            const pct        = s.total_enrolled > 0 ? Math.round(s.present_count / s.total_enrolled * 100) : 0;
            const sc         = statusColor(s.status);
            const isSelected = selectedIds.has(s.session_id);

            return (
              <div
                key={s.session_id}
                style={{
                  background: D.surface,
                  border: `1px solid ${isSelected ? D.accent + '66' : D.border}`,
                  borderRadius: 14, borderLeft: `4px solid ${sc}`,
                  overflow: 'hidden', transition: 'border-color .15s',
                }}
              >
                <div style={{ padding: '14px 18px' }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(s.session_id)}
                      style={{ marginTop: 4, cursor: 'pointer', accentColor: D.accent, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                        {s.course_name}
                      </div>
                      <div style={{ fontSize: 11, color: D.textMuted }}>
                        {s.course_code}{s.section ? ` · ${s.section}` : ''} · {fmtDate(s.started_at)}
                      </div>
                    </div>

                    {/* Status pill */}
                    <span style={{
                      padding: '3px 10px', borderRadius: 99, fontSize: 11,
                      fontWeight: 700, flexShrink: 0,
                      background: sc + '18', color: sc, border: `1px solid ${sc}44`,
                    }}>
                      {statusLabel(s.status)}
                    </span>

                    <Button size="sm" variant="secondary" onClick={() => setRosterSession(s.session_id)}>
                      📋 Roster
                    </Button>
                    {s.status === 'ACTIVE' && (
                      <Button size="sm" variant="primary" onClick={() => navigate('/dashboard/' + s.session_id)}>
                        Live →
                      </Button>
                    )}
                    {s.status !== 'ACTIVE' && (
                      <Button size="sm" variant="danger" onClick={() => handleDelete(s.session_id)}>🗑️</Button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 10 }}>
                    <ProgressBar value={pct} color={pct >= 75 ? D.green : pct >= 50 ? D.amber : D.red} />
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: D.green,        fontWeight: 600 }}>✅ {s.present_count} present</span>
                    <span style={{ fontSize: 12, color: D.red,          fontWeight: 600 }}>❌ {s.absent_count} absent</span>
                    <span style={{ fontSize: 12, color: D.textSecondary               }}>👥 {s.total_enrolled} enrolled</span>
                    <span style={{ fontSize: 12, color: pct >= 75 ? D.green : pct >= 50 ? D.amber : D.red, fontWeight: 700 }}>{pct}%</span>
                    <span style={{ fontSize: 11, color: D.textMuted }}>⏱ {s.class_duration_minutes}min</span>
                    <span style={{ fontSize: 11, color: D.textMuted }}>📍 {s.radius_meters}m</span>
                    <span style={{ fontSize: 11, color: D.textMuted }}>⭐ {s.attendance_credits} credit{s.attendance_credits !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rosterSession && (
        <RosterModal sessionId={rosterSession} onClose={() => setRosterSession(null)} />
      )}
    </div>
  );
}