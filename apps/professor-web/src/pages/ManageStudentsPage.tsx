import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ProfAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, Badge, Tabs, Spinner, EmptyState, notify } from '../components/ui';
import type { EnrolledStudent, SearchStudent } from '../types';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ManageStudentsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseName = searchParams.get('name') || 'Course';

  const [students, setStudents] = useState<EnrolledStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('enrolled');
  const [removing, setRemoving] = useState<string | null>(null);

  // Search & add
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Bulk add
  const [bulkText, setBulkText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    if (!courseId) return;
    ProfAPI.getCourseStudents(courseId)
      .then(r => setStudents(r.data.data || []))
      .finally(() => setLoading(false));
  }, [courseId]);

  // Live search
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (searchQ.trim().length < 2) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      if (!courseId) return;
      setSearching(true);
      try {
        const r = await ProfAPI.searchStudents(courseId, searchQ.trim());
        setSearchResults(r.data.data || []);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 400);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQ, courseId]);

  async function enrollSingle(s: SearchStudent) {
    if (s.already_enrolled || !courseId) return;
    try {
      const r = await ProfAPI.enrollStudents(courseId, [s.roll_number]);
      const d = r.data.data;
      if (d.enrolled > 0) {
        notify(`✅ ${s.name} enrolled`);
        const refreshed = await ProfAPI.getCourseStudents(courseId);
        setStudents(refreshed.data.data || []);
        setSearchQ(''); setSearchResults([]);
        setActiveTab('enrolled');
      } else {
        notify(d.not_added?.[0]?.reason || 'Could not enroll', 'error');
      }
    } catch (err: any) { notify(err.response?.data?.error || 'Failed', 'error'); }
  }

  async function handleRemove(s: EnrolledStudent) {
    if (!courseId || !confirm(`Remove ${s.name} (${s.roll_number}) from this course?\n\nPast attendance records will be preserved.`)) return;
    setRemoving(s.student_id);
    try {
      await ProfAPI.removeStudent(courseId, s.student_id);
      setStudents(prev => prev.filter(x => x.student_id !== s.student_id));
      notify(`${s.name} removed`);
    } catch (err: any) { notify(err.response?.data?.error || 'Failed', 'error'); }
    finally { setRemoving(null); }
  }

  async function handleBulkEnroll() {
    if (!courseId) return;
    const rolls = bulkText.split(/[\n,;]+/).map(s => s.trim().toUpperCase()).filter(s => s.length > 1);
    if (!rolls.length) { notify('Enter at least one roll number', 'error'); return; }
    setImporting(true); setImportResult(null);
    try {
      const r = await ProfAPI.enrollStudents(courseId, rolls);
      setImportResult(r.data.data);
      if (r.data.data.enrolled > 0) {
        const refreshed = await ProfAPI.getCourseStudents(courseId);
        setStudents(refreshed.data.data || []);
        notify(`✅ ${r.data.data.enrolled} student(s) enrolled`);
      }
    } catch (err: any) { notify(err.response?.data?.error || 'Failed', 'error'); }
    finally { setImporting(false); }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>;

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back</button>

      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{courseName}</div>
      <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 20 }}>Manage student enrollment</div>

      <Tabs
        active={activeTab}
        onChange={setActiveTab}
        tabs={[
          { key: 'enrolled', label: `👥 Enrolled (${students.length})` },
          { key: 'add', label: '➕ Add Students' },
        ]}
      />

      {/* ── Enrolled tab ── */}
      {activeTab === 'enrolled' && (
        students.length === 0 ? (
          <EmptyState icon="👥" title="No students enrolled yet" sub="Switch to Add Students tab to enroll">
            <Button variant="primary" onClick={() => setActiveTab('add')}>➕ Add Students</Button>
          </EmptyState>
        ) : (
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Student', 'Roll', 'Semester', 'Department', 'Face ID', 'Enrolled', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.student_id}>
                      <td style={{ padding: '12px 14px', fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: D.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: D.accent, flexShrink: 0 }}>
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div>{s.name}</div>
                            <div style={{ fontSize: 11, color: D.textMuted }}>{s.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: D.textSecondary, borderBottom: `1px solid ${D.border}` }}>{s.roll_number}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, borderBottom: `1px solid ${D.border}` }}>Sem {s.semester}</td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: D.textSecondary, borderBottom: `1px solid ${D.border}` }}>{s.dept_name}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
                        <Badge variant={s.face_enrolled ? 'green' : 'amber'}>{s.face_enrolled ? '✅ Enrolled' : '⚠️ None'}</Badge>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>{fmtDate(s.enrolled_at)}</td>
                      <td style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
                        <Button size="xs" variant="danger" loading={removing === s.student_id} onClick={() => handleRemove(s)}>✕ Remove</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* ── Add students tab ── */}
      {activeTab === 'add' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Search */}
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔍 Search & Add</div>
            <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 10 }}>Search by roll number, name, or email</div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: D.textMuted, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
              <input placeholder="e.g. 22CS001 or Rahul…" value={searchQ} onChange={e => setSearchQ(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 32px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 13.5, outline: 'none' }} />
            </div>
            {searching && <div style={{ fontSize: 12, color: D.textMuted }}>Searching…</div>}
            {searchResults.map(s => (
              <div key={s.student_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: D.surface2, borderRadius: 8, marginBottom: 6, border: `1px solid ${D.border}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: D.textMuted }}>{s.roll_number} · Sem {s.semester} · {s.dept_name}</div>
                </div>
                {s.already_enrolled
                  ? <Badge variant="green">Already Enrolled</Badge>
                  : <Button size="sm" variant="primary" onClick={() => enrollSingle(s)}>+ Add</Button>
                }
              </div>
            ))}
            {searchQ.length >= 2 && !searching && searchResults.length === 0 && (
              <div style={{ fontSize: 12, color: D.textMuted, padding: '10px 14px', background: D.surface2, borderRadius: 8, border: `1px solid ${D.border}` }}>
                No students found. Ask admin to register them first.
              </div>
            )}
          </div>

          <div style={{ height: 1, background: D.border }} />

          {/* Bulk */}
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📋 Bulk Add by Roll Numbers</div>
            <div style={{ fontSize: 13, color: D.textMuted, marginBottom: 10 }}>Paste roll numbers separated by commas or new lines</div>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6}
              placeholder={'22CS001, 22CS002, 22CS003\nor one per line:\n22CS001\n22CS002'}
              style={{ width: '100%', padding: '10px 12px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 13, fontFamily: 'monospace', resize: 'vertical', outline: 'none', marginBottom: 10 }} />
            <Button variant="primary" loading={importing} disabled={!bulkText.trim()} onClick={handleBulkEnroll}>Enroll Students</Button>

            {importResult && (
              <div style={{ marginTop: 14, background: D.surface2, borderRadius: 10, padding: 16, border: `1px solid ${D.border}` }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, marginBottom: 10 }}>Import Result</div>
                <div style={{ color: D.green, marginBottom: 4 }}>✅ Enrolled: {importResult.enrolled}</div>
                <div style={{ color: D.textMuted, marginBottom: 4, fontSize: 13 }}>⏭ Already enrolled: {importResult.already_enrolled}</div>
                {importResult.not_added?.length > 0 && (
                  <>
                    <div style={{ color: D.red, marginBottom: 6, fontSize: 13 }}>❌ Not added ({importResult.not_added.length}):</div>
                    <div style={{ background: D.surface, borderRadius: 8, padding: 10, maxHeight: 160, overflowY: 'auto' }}>
                      {importResult.not_added.map((n: any, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: D.textSecondary, marginBottom: 3 }}>• {n.roll_number} — {n.reason}</div>
                      ))}
                    </div>
                  </>
                )}
                <Button size="sm" variant="secondary" style={{ marginTop: 10 }} onClick={() => setImportResult(null)}>Clear</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}