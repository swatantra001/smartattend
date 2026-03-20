import React, { useState, useEffect } from 'react';
import { ProfAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, StatCard, Pill, ProgressBar, Spinner, EmptyState, notify } from '../components/ui';
import type { Course, StudentReport } from '../types';

function pctColor(pct: number) {
  if (pct >= 75) return '#22c55e';
  if (pct >= 60) return '#f59e0b';
  return '#ef4444';
}

export default function ReportsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selected, setSelected] = useState<Course | null>(null);
  const [report, setReport] = useState<StudentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [sortKey, setSortKey] = useState<'name' | 'roll' | 'pct'>('roll');
  const [sortAsc, setSortAsc] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    ProfAPI.getCourses()
      .then(r => setCourses(r.data.data || []))
      .finally(() => setLoadingCourses(false));
  }, []);

  async function loadReport(c: Course) {
    setSelected(c); setLoading(true); setSearch('');
    try {
      const r = await ProfAPI.getCourseReport(c.course_id);
      setReport(r.data.data || []);
    } catch { notify('Failed to load report', 'error'); }
    finally { setLoading(false); }
  }

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const displayed = [...report]
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.roll_number.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mult = sortAsc ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * mult;
      if (sortKey === 'roll') return a.roll_number.localeCompare(b.roll_number) * mult;
      return (Number(a.attendance_percentage) - Number(b.attendance_percentage)) * mult;
    });

  const avg = report.length ? (report.reduce((a, s) => a + Number(s.attendance_percentage), 0) / report.length).toFixed(1) : '0';
  const below75 = report.filter(s => Number(s.attendance_percentage) < 75).length;

  function exportCSV() {
    if (!selected || !report.length) return;
    const header = ['Name', 'Roll Number', 'Total Sessions', 'Present', 'Absent', 'Attendance %'];
    const rows = displayed.map(s => [
      `"${s.name}"`, s.roll_number, s.total_sessions,
      s.present_count, s.absent_count,
      `${Number(s.attendance_percentage).toFixed(1)}%`,
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${selected.code}_attendance.csv`;
    a.click();
    notify('CSV exported');
  }

  function exportJSON() {
    if (!selected || !report.length) return;
    const json = JSON.stringify({
      course_name: selected.name, course_code: selected.code,
      generated_at: new Date().toISOString(), total_students: report.length,
      avg_attendance: avg + '%', students: displayed,
    }, null, 2);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `${selected.code}_attendance.json`;
    a.click();
    notify('JSON exported');
  }

  function SortTh({ label, k }: { label: string; k: typeof sortKey }) {
    const active = sortKey === k;
    return (
      <th onClick={() => handleSort(k)} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: active ? D.accent : D.textMuted, borderBottom: `1px solid ${D.border}`, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
        {label} {active ? (sortAsc ? '↑' : '↓') : ''}
      </th>
    );
  }

  if (loadingCourses) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>;

  return (
    <div>
      {/* Course picker */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {courses.map(c => (
          <Pill key={c.course_id} label={`${c.name}${c.section ? ` (${c.section})` : ''}`} active={selected?.course_id === c.course_id} onClick={() => loadReport(c)} />
        ))}
      </div>

      {!selected ? (
        <EmptyState icon="📊" title="Select a course" sub="Click a course above to view its attendance report" />
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
      ) : report.length === 0 ? (
        <EmptyState icon="📋" title="No data yet" sub="No sessions have been held for this course" />
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <StatCard label="Total Students" value={report.length} />
            <StatCard label="Avg Attendance" value={avg + '%'} color={Number(avg) >= 75 ? D.green : D.amber} />
            <StatCard label="Below 75% ⚠️" value={below75} color={below75 > 0 ? D.red : D.green} />
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              placeholder="Search by name or roll number…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 13, outline: 'none' }}
            />
            <Button variant="secondary" size="sm" onClick={exportCSV}>⬇ CSV</Button>
            <Button variant="secondary" size="sm" onClick={exportJSON}>⬇ JSON</Button>
          </div>

          {/* Table */}
          <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>#</th>
                    <SortTh label="Student" k="name" />
                    <SortTh label="Roll Number" k="roll" />
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>Total</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>Present</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>Absent</th>
                    <SortTh label="Attendance %" k="pct" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((s, i) => {
                    const pct = Number(s.attendance_percentage) || 0;
                    const color = pctColor(pct);
                    return (
                      <tr key={s.roll_number}>
                        <td style={{ padding: '12px 14px', color: D.textMuted, fontSize: 12, borderBottom: `1px solid ${D.border}` }}>{i + 1}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>{s.name}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: D.textSecondary, borderBottom: `1px solid ${D.border}` }}>{s.roll_number}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>{s.total_sessions}</td>
                        <td style={{ padding: '12px 14px', color: D.green, fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>{s.present_count}</td>
                        <td style={{ padding: '12px 14px', color: D.red, fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>{s.absent_count}</td>
                        <td style={{ padding: '12px 14px', borderBottom: `1px solid ${D.border}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 70 }}><ProgressBar value={pct} color={color} /></div>
                            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, color, fontSize: 13, minWidth: 40 }}>{pct}%</span>
                            {pct < 75 && <span style={{ fontSize: 10, color: D.red }}>⚠️</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: D.textMuted, marginTop: 10, textAlign: 'right' }}>
            Showing {displayed.length} of {report.length} students
          </div>
        </>
      )}
    </div>
  );
}