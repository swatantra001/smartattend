// import React, { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { ProfAPI } from '../services/api';
// import { D } from '../components/design-tokens';
// import { Button, Badge, Pill, Spinner, EmptyState, notify } from '../components/ui';
// import type { Course } from '../types';

// export default function AssignCoursesPage() {
//   const navigate = useNavigate();
//   const [courses, setCourses] = useState<Course[]>([]);
//   const [filtered, setFiltered] = useState<Course[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState('');
//   const [showMine, setShowMine] = useState(false);
//   const [assigning, setAssigning] = useState<string | null>(null);
//   const [removing, setRemoving] = useState<string | null>(null);

//   const load = useCallback(async () => {
//     try {
//       const r = await ProfAPI.getAvailableCourses();
//       const data: Course[] = r.data.data || [];
//       setCourses(data);
//       applyFilter(data, search, showMine);
//     } catch { /* silent */ }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { load(); }, []);
//   useEffect(() => { applyFilter(courses, search, showMine); }, [search, showMine, courses]);

//   function applyFilter(data: Course[], q: string, mine: boolean) {
//     let r = mine ? data.filter(c => c.is_mine) : data;
//     if (q.trim()) {
//       const lq = q.toLowerCase();
//       r = r.filter(c =>
//         c.name.toLowerCase().includes(lq) ||
//         c.code.toLowerCase().includes(lq) ||
//         (c.section || '').toLowerCase().includes(lq) ||
//         c.dept_name.toLowerCase().includes(lq)
//       );
//     }
//     setFiltered(r);
//   }

//   async function handleAssign(c: Course) {
//     if (c.is_mine) return;
//     setAssigning(c.course_id);
//     try {
//       await ProfAPI.assignCourse(c.course_id);
//       setCourses(prev => prev.map(x => x.course_id === c.course_id ? { ...x, is_mine: true } : x));
//       notify(`✅ Assigned to ${c.name}`);
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     } finally { setAssigning(null); }
//   }

//   async function handleUnassign(c: Course) {
//     if (!confirm(`Remove ${c.name}${c.section ? ` (${c.section})` : ''} from your courses?\n\nStudent enrollment records will be kept.`)) return;
//     setRemoving(c.course_id);
//     try {
//       await ProfAPI.unassignCourse(c.course_id);
//       setCourses(prev => prev.map(x => x.course_id === c.course_id ? { ...x, is_mine: false, my_student_count: 0 } : x));
//       notify('Course removed');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     } finally { setRemoving(null); }
//   }

//   const mineCount = courses.filter(c => c.is_mine).length;

//   return (
//     <div>
//       <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: D.accent, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>← Back to Home</button>

//       <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
//         <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700 }}>Course Assignment</div>
//         <div style={{ fontSize: 13, color: D.textMuted, marginLeft: 'auto' }}>{mineCount} assigned · {courses.length} total</div>
//       </div>

//       {/* Filter tabs */}
//       <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
//         <Pill label="All Courses" active={!showMine} onClick={() => setShowMine(false)} />
//         <Pill label={`My Courses (${mineCount})`} active={showMine} onClick={() => setShowMine(true)} />
//       </div>

//       {/* Search */}
//       <div style={{ position: 'relative', marginBottom: 16 }}>
//         <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: D.textMuted, fontSize: 14, pointerEvents: 'none' }}>🔍</span>
//         <input
//           placeholder="Search by name, code, department…"
//           value={search} onChange={e => setSearch(e.target.value)}
//           style={{ width: '100%', padding: '9px 12px 9px 32px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 13.5, outline: 'none' }}
//         />
//       </div>

//       {loading ? (
//         <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
//       ) : filtered.length === 0 ? (
//         <EmptyState icon={showMine ? '📚' : '🔍'} title={showMine ? 'No assigned courses' : 'No courses found'} sub={showMine ? 'Switch to All Courses to assign yourself' : 'Try a different search'} />
//       ) : (
//         <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
//           {filtered.map(c => {
//             const isLoading = assigning === c.course_id || removing === c.course_id;
//             return (
//               <div key={c.course_id} style={{
//                 background: D.surface, border: `1px solid ${c.is_mine ? D.accent + '44' : D.border}`,
//                 borderRadius: 14, padding: '14px 18px',
//                 display: 'flex', alignItems: 'center', gap: 12,
//                 // background: c.is_mine ? D.accent + '06' : D.surface,
//               } as React.CSSProperties}>
//                 <div style={{ flex: 1, minWidth: 0 }}>
//                   <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
//                     <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>{c.name}</span>
//                     {c.is_mine && <Badge variant="blue">MINE</Badge>}
//                   </div>
//                   <div style={{ fontSize: 12, color: D.textSecondary, marginTop: 2 }}>
//                     {c.code}{c.section ? ` · ${c.section}` : ''} · Sem {c.semester} · {c.dept_name}
//                   </div>
//                   {c.is_mine && (c.my_student_count ?? 0) > 0 && (
//                     <div style={{ fontSize: 11, color: D.accent, marginTop: 3 }}>👥 {c.my_student_count} students enrolled</div>
//                   )}
//                 </div>

//                 <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
//                   {isLoading ? <Spinner size={18} /> :
//                     c.is_mine ? (
//                       <>
//                         <Button size="sm" variant="secondary" onClick={() => navigate(`/manage-students/${c.course_id}?name=${encodeURIComponent(c.name)}`)}>👥 Students</Button>
//                         <Button size="sm" variant="danger" onClick={() => handleUnassign(c)}>Remove</Button>
//                       </>
//                     ) : (
//                       <Button size="sm" variant="primary" onClick={() => handleAssign(c)}>+ Assign</Button>
//                     )
//                   }
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }











import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, Badge, Pill, Spinner, EmptyState, notify } from '../components/ui';
import type { Course } from '../types';

export default function AssignCoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses]   = useState<Course[]>([]);
  const [filtered, setFiltered] = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showMine, setShowMine] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving]   = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await ProfAPI.getAvailableCourses();
      const data: Course[] = r.data.data || [];
      setCourses(data);
      applyFilter(data, search, showMine);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);
  useEffect(() => { applyFilter(courses, search, showMine); }, [search, showMine, courses]);

  function applyFilter(data: Course[], q: string, mine: boolean) {
    let r = mine ? data.filter(c => c.is_mine) : data;
    if (q.trim()) {
      const lq = q.toLowerCase();
      r = r.filter(c =>
        c.name.toLowerCase().includes(lq) ||
        c.code.toLowerCase().includes(lq) ||
        (c.section || '').toLowerCase().includes(lq) ||
        c.dept_name.toLowerCase().includes(lq)
      );
    }
    setFiltered(r);
  }

  async function handleAssign(c: Course) {
    if (c.is_mine) return;
    setAssigning(c.course_id);
    try {
      await ProfAPI.assignCourse(c.course_id);
      setCourses(prev => prev.map(x => x.course_id === c.course_id ? { ...x, is_mine: true } : x));
      notify(`✅ Assigned to ${c.name}`);
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setAssigning(null); }
  }

  async function handleUnassign(c: Course) {
    if (!confirm(`Remove ${c.name}${c.section ? ` (${c.section})` : ''} from your courses?\n\nStudent enrollment records will be kept.`)) return;
    setRemoving(c.course_id);
    try {
      await ProfAPI.unassignCourse(c.course_id);
      setCourses(prev => prev.map(x => x.course_id === c.course_id ? { ...x, is_mine: false, my_student_count: 0 } : x));
      notify('Course removed');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setRemoving(null); }
  }

  const mineCount = courses.filter(c => c.is_mine).length;

  return (
    <div>

      {/* ── Back link ── */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: '#8b5cf6',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          marginBottom: 20, fontFamily: "'DM Sans',sans-serif",
          padding: 0, transition: 'opacity .14s',
        }}>
        ← Back to Home
      </button>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 22 }}>
        <div>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800,
            color: '#2e1065', letterSpacing: '-.4px',
          }}>Course Assignment</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>
            Assign courses to manage and run attendance sessions
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#6d28d9',
            background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.2)',
            borderRadius: 8, padding: '4px 12px',
          }}>
            {mineCount} assigned
          </span>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#9ca3af',
            background: 'rgba(255,255,255,.7)', border: '1px solid rgba(139,92,246,.15)',
            borderRadius: 8, padding: '4px 12px',
          }}>
            {courses.length} total
          </span>
        </div>
      </div>

      {/* ── Filter + Search row ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18,
        flexWrap: 'wrap',
      }}>
        {/* Pill tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          <Pill label="All Courses" active={!showMine} onClick={() => setShowMine(false)}/>
          <Pill label={`My Courses (${mineCount})`} active={showMine} onClick={() => setShowMine(true)}/>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: '#8b5cf6', fontSize: 14, pointerEvents: 'none',
          }}>🔍</span>
          <input
            placeholder="Search by name, code, department…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '9px 13px 9px 34px',
              background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(139,92,246,.18)',
              borderRadius: 10, color: '#2e1065', fontSize: 13.5, outline: 'none',
              fontFamily: "'DM Sans',sans-serif",
              transition: 'all .15s',
            }}
          />
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Spinner size={32}/>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={showMine ? '📚' : '🔍'}
          title={showMine ? 'No assigned courses' : 'No courses found'}
          sub={showMine ? 'Switch to All Courses to assign yourself' : 'Try a different search'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const isLoading = assigning === c.course_id || removing === c.course_id;
            return (
              <div key={c.course_id} style={{
                background: c.is_mine ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.72)',
                backdropFilter: 'blur(16px)',
                border: `1.5px solid ${c.is_mine ? 'rgba(139,92,246,.30)' : 'rgba(139,92,246,.14)'}`,
                borderRadius: 16, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 14,
                transition: 'all .18s',
                boxShadow: c.is_mine
                  ? '0 4px 20px rgba(139,92,246,.12)'
                  : '0 2px 8px rgba(139,92,246,.06)',
                position: 'relative', overflow: 'hidden',
              }}>
                {/* Left accent bar for assigned */}
                {c.is_mine && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, background: 'linear-gradient(180deg, #8b5cf6, #ec4899)',
                  }}/>
                )}

                {/* Course icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: c.is_mine
                    ? 'rgba(139,92,246,.12)'
                    : 'rgba(139,92,246,.06)',
                  border: '1px solid rgba(139,92,246,.18)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20,
                }}>📚</div>

                {/* Course info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{
                      fontFamily: "'Syne',sans-serif", fontWeight: 800,
                      fontSize: 14, color: '#2e1065',
                    }}>{c.name}</span>
                    {c.is_mine && <Badge variant="violet">MINE</Badge>}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    <span style={{ fontWeight: 600, color: '#8b5cf6' }}>{c.code}</span>
                    {c.section ? ` · ${c.section}` : ''} · Sem {c.semester} · {c.dept_name}
                  </div>
                  {c.is_mine && (c.my_student_count ?? 0) > 0 && (
                    <div style={{
                      fontSize: 11.5, color: '#6d28d9', fontWeight: 600, marginTop: 4,
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'rgba(139,92,246,.08)', borderRadius: 6, padding: '2px 8px',
                    }}>
                      👥 {c.my_student_count} students enrolled
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexShrink: 0 }}>
                  {isLoading ? (
                    <Spinner size={18}/>
                  ) : c.is_mine ? (
                    <>
                      <Button size="sm" variant="violet"
                        onClick={() => navigate(`/manage-students/${c.course_id}?name=${encodeURIComponent(c.name)}`)}>
                        👥 Students
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleUnassign(c)}>
                        Remove
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="primary" onClick={() => handleAssign(c)}>
                      + Assign
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}