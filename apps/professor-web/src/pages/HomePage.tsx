// import React, { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { ProfAPI } from '../services/api';
// import { D } from '../components/design-tokens';
// import { Button, Badge, StatCard, Spinner, EmptyState, Pill, notify } from '../components/ui';
// import type { Course, ActiveSession, PreviewStudent } from '../types';

// export default function HomePage() {
//   const navigate = useNavigate();
//   const [courses, setCourses] = useState<Course[]>([]);
//   const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
//   const [loading, setLoading] = useState(true);

//   // Config modal
//   const [configCourse, setConfigCourse] = useState<Course | null>(null);
//   const [cfgRadius, setCfgRadius] = useState('200');
//   const [cfgDuration, setCfgDuration] = useState('60');
//   const [fetching, setFetching] = useState(false);

//   // Preview modal
//   const [previewData, setPreviewData] = useState<{
//     course: Course; students: PreviewStudent[];
//     total_enrolled: number; in_range: number;
//     lat: number; lng: number;
//   } | null>(null);
//   const [launching, setLaunching] = useState(false);

//   const load = useCallback(async () => {
//     try {
//       const [cRes, sRes] = await Promise.all([
//         ProfAPI.getCourses(),
//         ProfAPI.getActiveSession(),
//       ]);
//       setCourses(cRes.data.data || []);
//       setActiveSession(sRes.data.data || null);
//     } catch { /* silent */ }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { load(); }, [load]);

//   async function handleStartClick(course: Course) {
//     if (activeSession) {
//       notify('End your current session first', 'error');
//       return;
//     }
//     setConfigCourse(course);
//     setCfgRadius('200');
//     setCfgDuration('60');
//   }

//   async function handleFetchPreview() {
//     if (!configCourse) return;
//     const radius = parseInt(cfgRadius) || 200;
//     if (radius < 50 || radius > 500) { notify('Radius must be 50–500 m', 'error'); return; }
//     setFetching(true);
//     try {
//       const pos = await new Promise<GeolocationPosition>((res, rej) =>
//         navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
//       );
//       const { latitude: lat, longitude: lng } = pos.coords;
//       const r = await ProfAPI.previewStudents({
//         course_id: configCourse.course_id, lat, lng, radius_meters: radius,
//       });
//       const { students, total_enrolled, in_range } = r.data.data;
//       setPreviewData({ course: configCourse, students, total_enrolled, in_range, lat, lng });
//       setConfigCourse(null);
//     } catch (err: any) {
//       if (err.code === 1) notify('Location permission denied. Enable GPS.', 'error');
//       else notify(err.response?.data?.error || 'Could not get location', 'error');
//     } finally { setFetching(false); }
//   }

//   async function handleConfirmStart() {
//     if (!previewData) return;
//     setLaunching(true);
//     try {
//       const res = await ProfAPI.startSession({
//         course_id: previewData.course.course_id,
//         lat: previewData.lat, lng: previewData.lng,
//         radius_meters: parseInt(cfgRadius) || 200,
//         class_duration_minutes: parseInt(cfgDuration) || 60,
//       });
//       const data = res.data.data;
//       setActiveSession(data);
//       setPreviewData(null);
//       notify(`✅ Session started — ${data.students_notified} students notified`);
//       navigate('/dashboard/' + data.session_id);
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed to start session', 'error');
//     } finally { setLaunching(false); }
//   }

//   async function handleEndSession() {
//     if (!activeSession || !confirm('End the active session?')) return;
//     try {
//       await ProfAPI.endSession(activeSession.session_id);
//       setActiveSession(null);
//       notify('Session ended');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     }
//   }

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
//       <Spinner size={36} />
//     </div>
//   );

//   return (
//     <div>
//       {/* Active session banner */}
//       {activeSession && (
//         <div style={{
//           background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.2)',
//           borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center',
//           gap: 14, marginBottom: 24,
//         }}>
//           <span style={{ width: 10, height: 10, borderRadius: '50%', background: D.red, flexShrink: 0, animation: 'pulse 1.4s ease-in-out infinite', display: 'inline-block' }} />
//           <div style={{ flex: 1 }}>
//             <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>🔴 Live Session Active</div>
//             <div style={{ fontSize: 13, color: D.textSecondary, marginTop: 2 }}>{activeSession.course_name}</div>
//           </div>
//           <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard/' + activeSession.session_id)}>Open Dashboard →</Button>
//           <Button variant="danger" size="sm" onClick={handleEndSession}>End Session</Button>
//         </div>
//       )}

//       {/* Header row */}
//       <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
//         <div>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700 }}>My Courses</div>
//           <div style={{ fontSize: 13, color: D.textMuted, marginTop: 2 }}>Tap Start to open an attendance session</div>
//         </div>
//         <div style={{ marginLeft: 'auto' }}>
//           <Button variant="secondary" size="sm" onClick={() => navigate('/assign-courses')}>⚙ Manage Courses</Button>
//         </div>
//       </div>

//       {/* Courses grid */}
//       {courses.length === 0 ? (
//         <EmptyState icon="📚" title="No courses assigned" sub="Assign yourself to courses first">
//           <Button variant="primary" onClick={() => navigate('/assign-courses')}>⚙ Assign Courses</Button>
//         </EmptyState>
//       ) : (
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
//           {courses.map(c => {
//             const isActive = activeSession?.course_id === c.course_id;
//             return (
//               <div key={c.course_id} style={{
//                 background: D.surface, border: `1px solid ${isActive ? 'rgba(239,68,68,.3)' : D.border}`,
//                 borderRadius: 16, padding: 18, transition: 'border-color .15s',
//               }}>
//                 <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: D.textMuted, marginBottom: 6 }}>
//                   {c.code}{c.section ? ` · ${c.section}` : ''} · Sem {c.semester}
//                 </div>
//                 <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{c.name}</div>
//                 <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 14 }}>{c.dept_name}</div>
//                 {(c.student_count ?? 0) > 0 && (
//                   <div style={{ fontSize: 12, color: D.textSecondary, marginBottom: 12 }}>👥 {c.student_count} students</div>
//                 )}
//                 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
//                   {isActive ? (
//                     <>
//                       <Badge variant="red">LIVE</Badge>
//                       <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/dashboard/' + activeSession!.session_id)}>View →</Button>
//                     </>
//                   ) : (
//                     <Button variant="primary" size="sm" style={{ marginLeft: 'auto' }} disabled={!!activeSession} onClick={() => handleStartClick(c)}>▶ Start</Button>
//                   )}
//                   <Button variant="secondary" size="sm" onClick={() => navigate(`/manage-students/${c.course_id}?name=${encodeURIComponent(c.name)}`)}>👥</Button>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {/* Config Modal */}
//       {configCourse && (
//         <div onClick={e => e.target === e.currentTarget && setConfigCourse(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
//           <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, width: '100%', maxWidth: 480, overflow: 'auto' }}>
//             <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, flex: 1 }}>Start Attendance Session</div>
//               <button onClick={() => setConfigCourse(null)} style={{ background: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
//             </div>
//             <div style={{ padding: 22 }}>
//               <div style={{ fontWeight: 600, marginBottom: 20, color: D.textPrimary }}>
//                 {configCourse.name}{configCourse.section ? ` (${configCourse.section})` : ''}
//               </div>

//               {/* Radius */}
//               <div style={{ marginBottom: 20 }}>
//                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
//                   <label style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>Geofence Radius</label>
//                   <span style={{ fontSize: 11, fontWeight: 700, color: D.accent, background: D.accentLight, padding: '2px 8px', borderRadius: 99 }}>{cfgRadius}m</span>
//                 </div>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//                   <button onClick={() => setCfgRadius(r => String(Math.max(50, parseInt(r) - 25)))} style={{ width: 38, height: 38, borderRadius: 9, background: D.surface2, border: `1px solid ${D.border}`, color: D.textPrimary, fontSize: 18, cursor: 'pointer' }}>−</button>
//                   <input type="number" value={cfgRadius} onChange={e => setCfgRadius(e.target.value)} min={50} max={500} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", outline: 'none' }} />
//                   <button onClick={() => setCfgRadius(r => String(Math.min(500, parseInt(r) + 25)))} style={{ width: 38, height: 38, borderRadius: 9, background: D.surface2, border: `1px solid ${D.border}`, color: D.textPrimary, fontSize: 18, cursor: 'pointer' }}>+</button>
//                 </div>
//                 <div style={{ fontSize: 10, color: D.textMuted, marginTop: 6, textAlign: 'center' }}>50m tight · 200m standard · 500m wide</div>
//               </div>

//               {/* Duration */}
//               <div style={{ marginBottom: 24 }}>
//                 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
//                   <label style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em' }}>Class Duration</label>
//                   <span style={{ fontSize: 11, fontWeight: 700, color: D.accent, background: D.accentLight, padding: '2px 8px', borderRadius: 99 }}>
//                     {cfgDuration}min · {parseInt(cfgDuration) > 75 ? '2 credits' : '1 credit'}
//                   </span>
//                 </div>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//                   <button onClick={() => setCfgDuration(d => String(Math.max(30, parseInt(d) - 15)))} style={{ width: 38, height: 38, borderRadius: 9, background: D.surface2, border: `1px solid ${D.border}`, color: D.textPrimary, fontSize: 18, cursor: 'pointer' }}>−</button>
//                   <input type="number" value={cfgDuration} onChange={e => setCfgDuration(e.target.value)} min={30} max={300} style={{ flex: 1, padding: '9px 0', textAlign: 'center', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 20, fontWeight: 800, fontFamily: "'Syne',sans-serif", outline: 'none' }} />
//                   <button onClick={() => setCfgDuration(d => String(Math.min(300, parseInt(d) + 15)))} style={{ width: 38, height: 38, borderRadius: 9, background: D.surface2, border: `1px solid ${D.border}`, color: D.textPrimary, fontSize: 18, cursor: 'pointer' }}>+</button>
//                 </div>
//                 <div style={{ fontSize: 10, color: D.textMuted, marginTop: 6, textAlign: 'center' }}>Sessions &gt;75 min automatically award 2 attendance credits</div>
//               </div>
//             </div>
//             <div style={{ padding: '16px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
//               <Button variant="secondary" onClick={() => setConfigCourse(null)}>Cancel</Button>
//               <Button variant="primary" loading={fetching} onClick={handleFetchPreview}>
//                 {fetching ? 'Getting location…' : 'Scan Students →'}
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Preview Modal */}
//       {previewData && (
//         <div onClick={e => e.target === e.currentTarget && setPreviewData(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
//           <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto' }}>
//             <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
//               <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, flex: 1 }}>Student Radar Preview</div>
//               <button onClick={() => setPreviewData(null)} style={{ background: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
//             </div>
//             <div style={{ padding: 22 }}>
//               {/* Stats */}
//               <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
//                 <StatCard label="Total Enrolled" value={previewData.total_enrolled} />
//                 <StatCard label="In Range ✅" value={previewData.in_range} color={D.green} />
//                 <StatCard label="Outside ❌" value={previewData.total_enrolled - previewData.in_range} color={D.red} />
//               </div>
//               <div style={{ fontSize: 11, color: D.textMuted, marginBottom: 14 }}>
//                 Radius: {cfgRadius}m · Duration: {cfgDuration}min · GPS: {previewData.lat.toFixed(5)}, {previewData.lng.toFixed(5)}
//               </div>
//               {/* Table */}
//               <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
//                 <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//                   <thead>
//                     <tr>
//                       {['#', 'Student', 'Roll', 'Distance', 'GPS Status', 'Face ID'].map(h => (
//                         <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>{h}</th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {previewData.students.map((s, i) => {
//                       const color = s.location_status === 'IN_RANGE' ? D.green : s.location_status === 'STALE' ? D.amber : D.red;
//                       return (
//                         <tr key={s.student_id}>
//                           <td style={{ padding: '10px 12px', color: D.textMuted, fontSize: 12, borderBottom: `1px solid ${D.border}` }}>{i + 1}</td>
//                           <td style={{ padding: '10px 12px', fontWeight: 600, borderBottom: `1px solid ${D.border}` }}>{s.name}</td>
//                           <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: `1px solid ${D.border}` }}>{s.roll_number}</td>
//                           <td style={{ padding: '10px 12px', fontSize: 12, borderBottom: `1px solid ${D.border}` }}>{s.distance_meters != null ? `${s.distance_meters}m` : '—'}</td>
//                           <td style={{ padding: '10px 12px', borderBottom: `1px solid ${D.border}` }}><span style={{ color, fontWeight: 600, fontSize: 11 }}>{s.location_status}</span></td>
//                           <td style={{ padding: '10px 12px', borderBottom: `1px solid ${D.border}` }}><span style={{ fontSize: 11, color: s.face_enrolled ? D.green : D.amber }}>{s.face_enrolled ? '✅' : '⚠️'}</span></td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </div>
//             </div>
//             <div style={{ padding: '16px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
//               <Button variant="secondary" onClick={() => setPreviewData(null)}>Abort</Button>
//               <Button variant="primary" loading={launching} onClick={handleConfirmStart}>▶ Deploy Session</Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }


















// import React, { useState, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { ProfAPI } from '../services/api';
// import { D } from '../components/design-tokens';
// import { Button, Badge, StatCard, Spinner, EmptyState, Pill, notify } from '../components/ui';
// import type { Course, ActiveSession, PreviewStudent } from '../types';

// export default function HomePage() {
//   const navigate = useNavigate();
//   const [courses, setCourses]             = useState<Course[]>([]);
//   const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
//   const [loading, setLoading]             = useState(true);

//   // Config modal
//   const [configCourse, setConfigCourse] = useState<Course | null>(null);
//   const [cfgRadius, setCfgRadius]       = useState('200');
//   const [cfgDuration, setCfgDuration]   = useState('60');
//   const [fetching, setFetching]         = useState(false);

//   // Preview modal
//   const [previewData, setPreviewData] = useState<{
//     course: Course; students: PreviewStudent[];
//     total_enrolled: number; in_range: number;
//     lat: number; lng: number;
//   } | null>(null);
//   const [launching, setLaunching] = useState(false);

//   const load = useCallback(async () => {
//     try {
//       const [cRes, sRes] = await Promise.all([
//         ProfAPI.getCourses(),
//         ProfAPI.getActiveSession(),
//       ]);
//       setCourses(cRes.data.data || []);
//       setActiveSession(sRes.data.data || null);
//     } catch { /* silent */ }
//     finally { setLoading(false); }
//   }, []);

//   useEffect(() => { load(); }, [load]);

//   async function handleStartClick(course: Course) {
//     if (activeSession) { notify('End your current session first', 'error'); return; }
//     setConfigCourse(course);
//     setCfgRadius('200');
//     setCfgDuration('60');
//   }

//   async function handleFetchPreview() {
//     if (!configCourse) return;
//     const radius = parseInt(cfgRadius) || 200;
//     if (radius < 50 || radius > 500) { notify('Radius must be 50–500 m', 'error'); return; }
//     setFetching(true);
//     try {
//       const pos = await new Promise<GeolocationPosition>((res, rej) =>
//         navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true })
//       );
//       const { latitude: lat, longitude: lng } = pos.coords;
//       const r = await ProfAPI.previewStudents({
//         course_id: configCourse.course_id, lat, lng, radius_meters: radius,
//       });
//       const { students, total_enrolled, in_range } = r.data.data;
//       setPreviewData({ course: configCourse, students, total_enrolled, in_range, lat, lng });
//       setConfigCourse(null);
//     } catch (err: any) {
//       if (err.code === 1) notify('Location permission denied. Enable GPS.', 'error');
//       else notify(err.response?.data?.error || 'Could not get location', 'error');
//     } finally { setFetching(false); }
//   }

//   async function handleConfirmStart() {
//     if (!previewData) return;
//     setLaunching(true);
//     try {
//       const res = await ProfAPI.startSession({
//         course_id:              previewData.course.course_id,
//         lat:                    previewData.lat,
//         lng:                    previewData.lng,
//         radius_meters:          parseInt(cfgRadius) || 200,
//         class_duration_minutes: parseInt(cfgDuration) || 60,
//       });
//       const data = res.data.data;
//       setActiveSession(data);
//       setPreviewData(null);
//       notify(`✅ Session started — ${data.students_notified} students notified`);
//       navigate('/dashboard/' + data.session_id);
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed to start session', 'error');
//     } finally { setLaunching(false); }
//   }

//   async function handleEndSession() {
//     if (!activeSession || !confirm('End the active session?')) return;
//     try {
//       await ProfAPI.endSession(activeSession.session_id);
//       setActiveSession(null);
//       notify('Session ended');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     }
//   }

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
//       <Spinner size={36}/>
//     </div>
//   );

//   // ── Stepper helper ────────────────────────────────────────────────────────
//   function StepperInput({
//     label, value, onChange, min, max, step, badge,
//   }: {
//     label: string; value: string; onChange: (v: string) => void;
//     min: number; max: number; step: number; badge: string;
//   }) {
//     return (
//       <div style={{ marginBottom: 22 }}>
//         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
//           <label style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.10em' }}>
//             {label}
//           </label>
//           <span style={{
//             fontSize: 11.5, fontWeight: 700, color: '#6d28d9',
//             background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.2)',
//             padding: '3px 10px', borderRadius: 99,
//           }}>{badge}</span>
//         </div>
//         <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
//           <button
//             onClick={() => onChange(String(Math.max(min, parseInt(value) - step)))}
//             style={{
//               width: 40, height: 40, borderRadius: 10,
//               background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)',
//               color: '#6d28d9', fontSize: 20, cursor: 'pointer', fontWeight: 700,
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//               transition: 'all .13s',
//             }}>−</button>
//           <input
//             type="number" value={value}
//             onChange={e => onChange(e.target.value)}
//             min={min} max={max}
//             style={{
//               flex: 1, padding: '10px 0', textAlign: 'center',
//               background: 'rgba(139,92,246,.06)', border: '1.5px solid rgba(139,92,246,.2)',
//               borderRadius: 10, color: '#2e1065',
//               fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", outline: 'none',
//             }}/>
//           <button
//             onClick={() => onChange(String(Math.min(max, parseInt(value) + step)))}
//             style={{
//               width: 40, height: 40, borderRadius: 10,
//               background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)',
//               color: '#6d28d9', fontSize: 20, cursor: 'pointer', fontWeight: 700,
//               display: 'flex', alignItems: 'center', justifyContent: 'center',
//               transition: 'all .13s',
//             }}>+</button>
//         </div>
//       </div>
//     );
//   }

//   // ── Render ─────────────────────────────────────────────────────────────────
//   return (
//     <div>

//       {/* ── Active session banner ── */}
//       {activeSession && (
//         <div style={{
//           background: 'rgba(239,68,68,.07)',
//           border: '1px solid rgba(239,68,68,.22)',
//           borderRadius: 16, padding: '14px 20px',
//           display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
//           backdropFilter: 'blur(8px)',
//           boxShadow: '0 4px 16px rgba(239,68,68,.10)',
//         }}>
//           <span style={{
//             width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
//             display: 'inline-block', animation: 'pulse 1.4s ease-in-out infinite',
//             boxShadow: '0 0 0 4px rgba(239,68,68,.2)',
//           }}/>
//           <div style={{ flex: 1 }}>
//             <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: '#dc2626' }}>
//               🔴 Live Session Active
//             </div>
//             <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>
//               {activeSession.course_name}
//             </div>
//           </div>
//           <Button variant="secondary" size="sm"
//             onClick={() => navigate('/dashboard/' + activeSession.session_id)}>
//             Open Dashboard →
//           </Button>
//           <Button variant="danger" size="sm" onClick={handleEndSession}>
//             End Session
//           </Button>
//         </div>
//       )}

//       {/* ── Header row ── */}
//       <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
//         <div>
//           <div style={{
//             fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800,
//             color: '#2e1065', letterSpacing: '-.3px',
//           }}>My Courses</div>
//           <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 3 }}>
//             Tap Start to open an attendance session
//           </div>
//         </div>
//         <div style={{ marginLeft: 'auto' }}>
//           <Button variant="secondary" size="sm" onClick={() => navigate('/assign-courses')}>
//             ⚙ Manage Courses
//           </Button>
//         </div>
//       </div>

//       {/* ── Courses grid ── */}
//       {courses.length === 0 ? (
//         <EmptyState icon="📚" title="No courses assigned" sub="Assign yourself to courses first">
//           <Button variant="primary" onClick={() => navigate('/assign-courses')}>
//             ⚙ Assign Courses
//           </Button>
//         </EmptyState>
//       ) : (
//         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))', gap: 16 }}>
//           {courses.map(c => {
//             const isActive = activeSession?.course_id === c.course_id;
//             return (
//               <div key={c.course_id} style={{
//                 background: isActive ? 'rgba(239,68,68,.06)' : 'rgba(255,255,255,.82)',
//                 backdropFilter: 'blur(16px)',
//                 border: `1px solid ${isActive ? 'rgba(239,68,68,.28)' : 'rgba(139,92,246,.16)'}`,
//                 borderRadius: 18, padding: '20px',
//                 transition: 'all .18s',
//                 boxShadow: isActive
//                   ? '0 4px 20px rgba(239,68,68,.12)'
//                   : '0 2px 12px rgba(139,92,246,.08)',
//                 position: 'relative', overflow: 'hidden',
//               }}>
//                 {/* Subtle gradient shimmer top-right */}
//                 <div style={{
//                   position: 'absolute', top: 0, right: 0,
//                   width: 80, height: 80,
//                   background: isActive
//                     ? 'radial-gradient(circle, rgba(239,68,68,.12) 0%, transparent 70%)'
//                     : 'radial-gradient(circle, rgba(139,92,246,.10) 0%, transparent 70%)',
//                   pointerEvents: 'none',
//                 }}/>

//                 <div style={{
//                   fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em',
//                   textTransform: 'uppercase', color: '#8b5cf6', marginBottom: 7,
//                 }}>
//                   {c.code}{c.section ? ` · ${c.section}` : ''} · Sem {c.semester}
//                 </div>
//                 <div style={{
//                   fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800,
//                   color: '#2e1065', marginBottom: 4, letterSpacing: '-.2px',
//                 }}>{c.name}</div>
//                 <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
//                   {c.dept_name}
//                 </div>

//                 {(c.student_count ?? 0) > 0 && (
//                   <div style={{
//                     display: 'inline-flex', alignItems: 'center', gap: 5,
//                     fontSize: 12, color: '#6d28d9', fontWeight: 600,
//                     background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)',
//                     borderRadius: 8, padding: '3px 10px', marginBottom: 14,
//                   }}>
//                     👥 {c.student_count} students
//                   </div>
//                 )}

//                 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
//                   {isActive ? (
//                     <>
//                       <Badge variant="red">● LIVE</Badge>
//                       <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }}
//                         onClick={() => navigate('/dashboard/' + activeSession!.session_id)}>
//                         View →
//                       </Button>
//                     </>
//                   ) : (
//                     <Button variant="primary" size="sm"
//                       style={{ marginLeft: 'auto', boxShadow: '0 4px 12px rgba(139,92,246,.28)' }}
//                       disabled={!!activeSession}
//                       onClick={() => handleStartClick(c)}>
//                       ▶ Start
//                     </Button>
//                   )}
//                   <Button variant="secondary" size="sm"
//                     onClick={() => navigate(`/manage-students/${c.course_id}?name=${encodeURIComponent(c.name)}`)}>
//                     👥
//                   </Button>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {/* ════════ Config Modal ════════ */}
//       {configCourse && (
//         <div
//           onClick={e => e.target === e.currentTarget && setConfigCourse(null)}
//           style={{
//             position: 'fixed', inset: 0,
//             background: 'rgba(46,16,101,.55)',
//             backdropFilter: 'blur(8px)',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             zIndex: 1000, padding: 20,
//             animation: 'fadeIn .15s ease',
//           }}>
//           <div style={{
//             background: 'rgba(255,255,255,.96)',
//             backdropFilter: 'blur(20px)',
//             border: '1px solid rgba(139,92,246,.18)',
//             borderRadius: 20, width: '100%', maxWidth: 480,
//             boxShadow: '0 24px 64px rgba(46,16,101,.25)',
//             animation: 'slideUp .2s ease', overflow: 'hidden',
//           }}>
//             {/* Header */}
//             <div style={{
//               padding: '18px 22px', borderBottom: '1px solid rgba(139,92,246,.12)',
//               display: 'flex', alignItems: 'center',
//               background: 'linear-gradient(135deg, rgba(139,92,246,.06), rgba(236,72,153,.04))',
//             }}>
//               <div>
//                 <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
//                   Session Configuration
//                 </div>
//                 <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: '#2e1065' }}>
//                   Start Attendance Session
//                 </div>
//               </div>
//               <button onClick={() => setConfigCourse(null)} style={{
//                 marginLeft: 'auto', background: 'rgba(139,92,246,.08)',
//                 border: '1px solid rgba(139,92,246,.18)', color: '#8b5cf6',
//                 fontSize: 14, padding: '5px 9px', cursor: 'pointer', borderRadius: 8, lineHeight: 1,
//               }}>✕</button>
//             </div>

//             <div style={{ padding: '22px 22px 4px' }}>
//               {/* Course tag */}
//               <div style={{
//                 display: 'inline-flex', alignItems: 'center', gap: 8,
//                 background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.2)',
//                 borderRadius: 10, padding: '8px 14px', marginBottom: 22,
//               }}>
//                 <span style={{ fontSize: 16 }}>📚</span>
//                 <div>
//                   <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13.5, color: '#2e1065' }}>
//                     {configCourse.name}{configCourse.section ? ` (${configCourse.section})` : ''}
//                   </div>
//                   <div style={{ fontSize: 11, color: '#8b5cf6' }}>{configCourse.code}</div>
//                 </div>
//               </div>

//               <StepperInput
//                 label="Geofence Radius"
//                 value={cfgRadius}
//                 onChange={setCfgRadius}
//                 min={50} max={500} step={25}
//                 badge={`${cfgRadius}m`}
//               />
//               <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -16, marginBottom: 22, textAlign: 'center' }}>
//                 50m tight · 200m standard · 500m wide
//               </div>

//               <StepperInput
//                 label="Class Duration"
//                 value={cfgDuration}
//                 onChange={setCfgDuration}
//                 min={30} max={300} step={15}
//                 badge={`${cfgDuration}min · ${parseInt(cfgDuration) > 75 ? '2 credits' : '1 credit'}`}
//               />
//               <div style={{ fontSize: 11, color: '#9ca3af', marginTop: -16, marginBottom: 10, textAlign: 'center' }}>
//                 Sessions &gt;75 min automatically award 2 attendance credits
//               </div>
//             </div>

//             <div style={{
//               padding: '16px 22px', borderTop: '1px solid rgba(139,92,246,.10)',
//               display: 'flex', justifyContent: 'flex-end', gap: 8,
//             }}>
//               <Button variant="secondary" onClick={() => setConfigCourse(null)}>Cancel</Button>
//               <Button variant="primary" loading={fetching} onClick={handleFetchPreview}>
//                 {fetching ? 'Getting location…' : 'Scan Students →'}
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ════════ Preview Modal ════════ */}
//       {previewData && (
//         <div
//           onClick={e => e.target === e.currentTarget && setPreviewData(null)}
//           style={{
//             position: 'fixed', inset: 0,
//             background: 'rgba(46,16,101,.55)',
//             backdropFilter: 'blur(8px)',
//             display: 'flex', alignItems: 'center', justifyContent: 'center',
//             zIndex: 1000, padding: 20,
//             animation: 'fadeIn .15s ease',
//           }}>
//           <div style={{
//             background: 'rgba(255,255,255,.96)',
//             backdropFilter: 'blur(20px)',
//             border: '1px solid rgba(139,92,246,.18)',
//             borderRadius: 20, width: '100%', maxWidth: 740, maxHeight: '90vh', overflow: 'auto',
//             boxShadow: '0 24px 64px rgba(46,16,101,.25)',
//             animation: 'slideUp .2s ease',
//           }}>
//             {/* Header */}
//             <div style={{
//               padding: '18px 22px', borderBottom: '1px solid rgba(139,92,246,.12)',
//               display: 'flex', alignItems: 'center',
//               background: 'linear-gradient(135deg, rgba(139,92,246,.06), rgba(236,72,153,.04))',
//             }}>
//               <div>
//                 <div style={{ fontSize: 10, fontWeight: 700, color: '#8b5cf6', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 3 }}>
//                   Radar Scan Complete
//                 </div>
//                 <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 800, color: '#2e1065' }}>
//                   Student Radar Preview
//                 </div>
//               </div>
//               <button onClick={() => setPreviewData(null)} style={{
//                 marginLeft: 'auto', background: 'rgba(139,92,246,.08)',
//                 border: '1px solid rgba(139,92,246,.18)', color: '#8b5cf6',
//                 fontSize: 14, padding: '5px 9px', cursor: 'pointer', borderRadius: 8, lineHeight: 1,
//               }}>✕</button>
//             </div>

//             <div style={{ padding: 22 }}>
//               {/* Stats */}
//               <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
//                 <StatCard label="Total Enrolled" value={previewData.total_enrolled}/>
//                 <StatCard label="In Range ✅" value={previewData.in_range} color="#10b981"/>
//                 <StatCard label="Outside ❌" value={previewData.total_enrolled - previewData.in_range} color="#ef4444"/>
//               </div>

//               {/* Meta info */}
//               <div style={{
//                 display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16,
//               }}>
//                 {[
//                   `📡 Radius: ${cfgRadius}m`,
//                   `⏱ Duration: ${cfgDuration}min`,
//                   `📍 ${previewData.lat.toFixed(5)}, ${previewData.lng.toFixed(5)}`,
//                 ].map(tag => (
//                   <span key={tag} style={{
//                     fontSize: 11, color: '#6d28d9', fontWeight: 600,
//                     background: 'rgba(139,92,246,.08)', border: '1px solid rgba(139,92,246,.15)',
//                     borderRadius: 8, padding: '4px 10px',
//                   }}>{tag}</span>
//                 ))}
//               </div>

//               {/* Table */}
//               <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto', borderRadius: 12, border: '1px solid rgba(139,92,246,.12)' }}>
//                 <table style={{ width: '100%', borderCollapse: 'collapse' }}>
//                   <thead>
//                     <tr style={{ background: 'rgba(139,92,246,.05)' }}>
//                       {['#', 'Student', 'Roll', 'Distance', 'GPS Status', 'Face ID'].map(h => (
//                         <th key={h} style={{
//                           textAlign: 'left', padding: '10px 14px',
//                           fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase',
//                           letterSpacing: '.08em', color: '#8b5cf6',
//                           borderBottom: '1px solid rgba(139,92,246,.12)',
//                           whiteSpace: 'nowrap', position: 'sticky', top: 0,
//                           background: 'rgba(250,245,255,.97)',
//                         }}>{h}</th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {previewData.students.map((s, i) => {
//                       const locColor = s.location_status === 'IN_RANGE' ? '#10b981' :
//                                        s.location_status === 'STALE'    ? '#f59e0b' : '#ef4444';
//                       return (
//                         <tr key={s.student_id}>
//                           <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12, borderBottom: '1px solid rgba(139,92,246,.07)' }}>{i + 1}</td>
//                           <td style={{ padding: '10px 14px', fontWeight: 600, color: '#2e1065', borderBottom: '1px solid rgba(139,92,246,.07)' }}>{s.name}</td>
//                           <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid rgba(139,92,246,.07)' }}>{s.roll_number}</td>
//                           <td style={{ padding: '10px 14px', fontSize: 12, color: '#6b7280', borderBottom: '1px solid rgba(139,92,246,.07)' }}>{s.distance_meters != null ? `${s.distance_meters}m` : '—'}</td>
//                           <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(139,92,246,.07)' }}>
//                             <span style={{
//                               color: locColor, fontWeight: 700, fontSize: 11,
//                               background: locColor + '15', padding: '2px 8px', borderRadius: 6,
//                             }}>{s.location_status}</span>
//                           </td>
//                           <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(139,92,246,.07)' }}>
//                             <span style={{ fontSize: 14 }}>{s.face_enrolled ? '✅' : '⚠️'}</span>
//                           </td>
//                         </tr>
//                       );
//                     })}
//                   </tbody>
//                 </table>
//               </div>
//             </div>

//             <div style={{
//               padding: '16px 22px', borderTop: '1px solid rgba(139,92,246,.10)',
//               display: 'flex', justifyContent: 'flex-end', gap: 8,
//             }}>
//               <Button variant="secondary" onClick={() => setPreviewData(null)}>Abort</Button>
//               <Button variant="primary" loading={launching} onClick={handleConfirmStart}>
//                 ▶ Deploy Session
//               </Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }












import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfAPI } from '../services/api';
import { D } from '../components/design-tokens';
import { Button, Badge, StatCard, Spinner, EmptyState, Pill, notify } from '../components/ui';
import type { Course, ActiveSession, PreviewStudent } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso?: string): string {
  if (!iso) return 'No ping';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function locColor(status: string) {
  if (status === 'IN_RANGE')    return '#22c55e';
  if (status === 'STALE')       return '#f59e0b';
  if (status === 'OUT_OF_RANGE') return '#ef4444';
  return '#64748b';
}
function locLabel(status: string) {
  if (status === 'IN_RANGE')    return 'IN RANGE';
  if (status === 'STALE')       return 'STALE (>5m)';
  if (status === 'OUT_OF_RANGE') return 'OUT OF RANGE';
  return 'NO GPS';
}

// ─── CSS keyframe injection ───────────────────────────────────────────────────
const STYLES = `
@keyframes radarSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes blipPulse  { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.7); opacity: 0.4; } }
@keyframes fadeSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes overlayIn  { from { opacity: 0; } to { opacity: 1; } }
`;

// ─── Radar constants ──────────────────────────────────────────────────────────
const RADAR_SIZE = 300;
const RADAR_R    = RADAR_SIZE / 2;

// ─── MobileWarningModal ───────────────────────────────────────────────────────
function MobileWarningModal({ onContinue, onClose }: { onContinue: () => void; onClose: () => void }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20,
      animation: 'overlayIn .15s ease',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460,
        boxShadow: '0 32px 80px rgba(0,0,0,.35)', overflow: 'hidden',
        animation: 'fadeSlideUp .2s ease',
      }}>
        {/* Yellow-amber top strip */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#f59e0b,#fbbf24)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 18,
          }}>📱</div>

          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, color: '#1c1917', marginBottom: 10 }}>
            Better accuracy on mobile
          </div>
          <div style={{ fontSize: 14, color: '#57534e', lineHeight: 1.65, marginBottom: 8 }}>
            The <strong>SmartAttend mobile app</strong> uses the phone's GPS chip directly, giving you a much more accurate classroom geofence.
          </div>
          <div style={{ fontSize: 14, color: '#57534e', lineHeight: 1.65, marginBottom: 20 }}>
            Web browsers often use Wi-Fi or cell-tower triangulation instead of GPS, which can be off by <strong>50–200 metres</strong>.
          </div>

          {/* Comparison pills */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            {[
              { icon: '📱', label: 'Mobile app', sub: '3–10m accuracy', ok: true },
              { icon: '🌐', label: 'Web browser', sub: '50–200m accuracy', ok: false },
            ].map(p => (
              <div key={p.label} style={{
                flex: 1, padding: '12px 14px', borderRadius: 12,
                background: p.ok ? '#f0fdf4' : '#fff7ed',
                border: `1.5px solid ${p.ok ? '#bbf7d0' : '#fed7aa'}`,
              }}>
                <div style={{ fontSize: 20, marginBottom: 5 }}>{p.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#1c1917' }}>{p.label}</div>
                <div style={{ fontSize: 11.5, color: p.ok ? '#16a34a' : '#ea580c', fontWeight: 600, marginTop: 2 }}>{p.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: 10,
              background: '#f5f5f4', border: '1px solid #e7e5e4',
              color: '#57534e', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
            <button onClick={onContinue} style={{
              flex: 2, padding: '12px', borderRadius: 10,
              background: '#1c1917', border: 'none',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Continue on web anyway →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RadarModal ───────────────────────────────────────────────────────────────
function RadarModal({
  course, students, total, inRange, radius, lat, lng, launching,
  onConfirm, onClose, onRescan,
}: {
  course: Course;
  students: PreviewStudent[];
  total: number;
  inRange: number;
  radius: number;
  lat: number;
  lng: number;
  launching: boolean;
  onConfirm: () => void;
  onClose: () => void;
  onRescan: () => void;
}) {
  const [selected, setSelected] = useState<PreviewStudent | null>(null);
  const [tick, setTick]         = useState(0);         // forces timeAgo re-render
  const rescanRef               = useRef<ReturnType<typeof setInterval>>();

  // Continuous rescan every 10 s (mirrors app behaviour)
  useEffect(() => {
    rescanRef.current = setInterval(() => { onRescan(); setTick(t => t + 1); }, 10000);
    return () => clearInterval(rescanRef.current);
  }, [onRescan]);

  // Tick every second so timeAgo values update live
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const displayStudents = [...students].sort((a, b) =>
    (a.distance_meters ?? 9999) - (b.distance_meters ?? 9999)
  );
// replace green with violet, light green with light violet means replace green with respective violet shade
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#f0f4f9',
      zIndex: 1050, display: 'flex', flexDirection: 'column',
      animation: 'fadeSlideUp .22s ease',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px', background: '#fff',
        borderBottom: '1px solid #e8f0f8',
        boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, borderRadius: '50%',
          background: '#d8f3dc', border: 'none',
          color: '#2d6a4f', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
        }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' }}>Attendance Radar</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginTop: 1 }} >{course.name}</div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(139,92,246,.1)', borderRadius: 99,
          padding: '5px 12px', border: '1px solid rgba(139,92,246,.25)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9' }}>{inRange}/{total} in range</span>
        </div>
      </div>

      {/* ── Main content: radar + list side by side ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: radar + detail card */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 16px', gap: 14, background: '#f0f4f9', borderRight: '1px solid #e2e8f0', minWidth: 550 }}>

          {/* ── Radar display ── */}
          <div style={{ position: 'relative', width: RADAR_SIZE, height: RADAR_SIZE, flexShrink: 0 }}>
            {/* Dark screen */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: '#0a1628', border: '2px solid #6d28d9',
              overflow: 'hidden',
            }}>
              {/* Concentric rings */}
              {[0.25, 0.5, 0.75, 1.0].map(r => (
                <div key={r} style={{
                  position: 'absolute',
                  width: RADAR_SIZE * r, height: RADAR_SIZE * r,
                  borderRadius: '50%',
                  border: `1px solid ${r === 1.0 ? 'rgba(27,58,92,.6)' : 'rgba(27,58,92,.25)'}`,
                  left: RADAR_R - (RADAR_SIZE * r) / 2,
                  top:  RADAR_R - (RADAR_SIZE * r) / 2,
                }} />
              ))}

              {/* Crosshairs */}
              <div style={{ position: 'absolute', top: RADAR_R - 0.5, left: 0, right: 0, height: 1, background: 'rgba(45,90,142,.3)' }} />
              <div style={{ position: 'absolute', left: RADAR_R - 0.5, top: 0, bottom: 0, width: 1, background: 'rgba(45,90,142,.3)' }} />

              {/* Compass labels */}
              {['N','E','S','W'].map((d, i) => {
                const a = i * Math.PI / 2;
                return (
                  <div key={d} style={{
                    position: 'absolute',
                    left: RADAR_R + Math.sin(a) * (RADAR_R - 12) - 5,
                    top:  RADAR_R - Math.cos(a) * (RADAR_R - 12) - 8,
                    fontSize: 8, fontWeight: 800, color: 'rgba(45,90,142,.7)',
                  }}>{d}</div>
                );
              })}

              {/* Sweep */}
              <div style={{
                position: 'absolute', inset: 0,
                borderRadius: '50%', overflow: 'hidden',
                animation: 'radarSweep 3s linear infinite',
                transformOrigin: '50% 50%',
              }}>
                <div style={{
                  position: 'absolute',
                  left: RADAR_R - 1, top: 0,
                  width: 2, height: RADAR_R,
                  background: 'rgba(139,92,246,.9)',
                  boxShadow: '0 0 8px #8b5cf6',
                  transformOrigin: 'bottom center',
                }} />
                {/* Sweep trail - sector fade */}
                <div style={{
                  position: 'absolute', left: 0, top: 0,
                  width: '50%', height: '100%',
                  background: 'conic-gradient(from 0deg, rgba(139,92,246,0.08) 0deg, transparent 60deg)',
                  transformOrigin: 'right center',
                }} />
              </div>

              {/* Professor center dot */}
              <div style={{
                position: 'absolute',
                left: RADAR_R - 5, top: RADAR_R - 5,
                width: 10, height: 10, borderRadius: '50%',
                background: '#60a5fa',
                boxShadow: '0 0 8px #60a5fa',
                zIndex: 10,
              }} />
              <div style={{
                position: 'absolute',
                left: RADAR_R + 7, top: RADAR_R - 6,
                fontSize: 7, fontWeight: 800, color: 'rgba(96,165,250,.7)',
                letterSpacing: 1, zIndex: 10,
              }}>YOU</div>

              {/* Student blips */}
              {students.map(s => {
                if (s.distance_meters == null || s.bearing_degrees == null) return null;
                const maxDist = radius;
                const distPct = Math.min(s.distance_meters / maxDist, 0.93);
                const bearRad = (s.bearing_degrees * Math.PI) / 180;
                const px = RADAR_R + Math.sin(bearRad) * distPct * RADAR_R;
                const py = RADAR_R - Math.cos(bearRad) * distPct * RADAR_R;
                const color = locColor(s.location_status);
                const isSel = selected?.student_id === s.student_id;

                return (
                  <div
                    key={s.student_id}
                    onClick={() => setSelected(isSel ? null : s)}
                    style={{
                      position: 'absolute',
                      left: px - 12, top: py - 12,
                      width: 24, height: 24,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 5,
                    }}
                  >
                    {/* Pulse ring */}
                    <div style={{
                      position: 'absolute',
                      width: 18, height: 18, borderRadius: '50%',
                      border: `1.5px solid ${color}`,
                      opacity: isSel ? 1 : 0.5,
                      animation: 'blipPulse 1.4s ease-in-out infinite',
                    }} />
                    {/* Core */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color,
                      boxShadow: `0 0 6px ${color}`,
                      border: isSel ? '2px solid #fff' : 'none',
                    }} />
                  </div>
                );
              })}

              {/* Range label */}
              <div style={{
                position: 'absolute', top: 6, right: RADAR_R + 4,
                fontSize: 8, color: 'rgba(45,90,142,.5)',
              }}>{radius}m</div>

              {/* Live badge */}
              <div style={{
                position: 'absolute', bottom: 8, left: 0, right: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6' }} />
                <span style={{ fontSize: 8, color: 'rgba(139,92,246,.7)', fontWeight: 600, letterSpacing: .5 }}>LIVE · updates every 10s</span>
              </div>
            </div>
          </div>

          {/* ── Selected student detail card ── */}
          {selected ? (
            <div style={{
              width: '100%', background: '#fff', borderRadius: 16, padding: 14,
              border: '1.5px solid #ede9fe',
              boxShadow: '0 2px 12px rgba(109,40,217,.1)',
              animation: 'fadeSlideUp .15s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: locColor(selected.location_status), flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{selected.roll_number}</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: 4 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'DISTANCE', value: selected.distance_meters != null ? `${selected.distance_meters}m` : '—' },
                  { label: 'BEARING',  value: selected.bearing_degrees != null ? `${Math.round(selected.bearing_degrees)}°` : '—' },
                  { label: 'STATUS',   value: locLabel(selected.location_status), color: locColor(selected.location_status) },
                  { label: 'FACE ID',  value: selected.face_enrolled ? '✓ YES' : '✗ NO', color: selected.face_enrolled ? '#8b5cf6' : '#ef4444' },
                ].map(c => (
                  <div key={c.label} style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: '#94a3b8', letterSpacing: 1, marginBottom: 3 }}>{c.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: c.color || '#0f172a' }}>{c.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              width: '100%', background: '#fff', borderRadius: 12, padding: '10px 14px',
              border: '1px solid #e2e8f0', display: 'flex', gap: 16,
            }}>
              {[
                { label: 'Total',     value: total,    color: '#0f172a'  },
                { label: 'In Range',  value: inRange,  color: '#7c3aed'  },
                { label: 'Outside',   value: total - inRange, color: '#ef4444' },
                { label: 'Radius',    value: `${radius}m`, color: '#6d28d9' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .8 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: student list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid #e2e8f0',
            fontSize: 9, fontWeight: 800, color: '#94a3b8', letterSpacing: 1.5, textTransform: 'uppercase',
          }}>
            Enrolled Students ({total})
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {displayStudents.map(s => {
              const color = locColor(s.location_status);
              const isSel = selected?.student_id === s.student_id;
              return (
                <div
                  key={s.student_id}
                  onClick={() => setSelected(isSel ? null : s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px', borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer', transition: 'background .1s',
                    background: isSel ? '#f5f3ff' : 'transparent',
                  }}
                  onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{s.roll_number}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9' }}>
                      {s.distance_meters != null ? `${s.distance_meters}m` : '—'}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>
                      {timeAgo((s as any).location_updated_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: '#cbd5e1', marginLeft: 2 }}>›</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom actions ── */}
      <div style={{
        display: 'flex', gap: 10, padding: '14px 20px',
        background: '#fff', borderTop: '1px solid #e8f0f8',
        boxShadow: '0 -2px 8px rgba(0,0,0,.04)',
      }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '13px', borderRadius: 12,
          border: '1.5px solid #e2e8f0', background: '#fff',
          color: '#64748b', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Abort
        </button>
        <button onClick={onConfirm} disabled={launching} style={{
          flex: 2.5, padding: '13px', borderRadius: 12,
          background: launching ? '#6d28d999' : '#6d28d9',
          border: 'none', color: '#fff',
          fontWeight: 900, fontSize: 15, cursor: launching ? 'wait' : 'pointer',
          fontFamily: 'inherit', letterSpacing: .3,
          boxShadow: '0 4px 14px rgba(109,40,217,.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {launching && <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'radarSweep .7s linear infinite', display: 'inline-block' }} />}
          ▶ Deploy Session
        </button>
      </div>
    </div>
  );
}

// ─── StepperInput (config modal) ─────────────────────────────────────────────
function StepperInput({ label, value, onChange, min, max, step, badge }: {
  label: string; value: string; onChange: (v: string) => void;
  min: number; max: number; step: number; badge: string;
}) {
  const P  = '#6d28d9';
  const PA = '#ede9fe';
  const PL = '#8b5cf6';

  const numVal   = parseInt(value) || min;
  const trackPct = Math.max(2, Math.round(((numVal - min) / (max - min)) * 100));

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', letterSpacing: .3 }}>{label}</label>
        <span style={{ fontSize: 11, fontWeight: 700, color: P, background: PA, borderRadius: 99, padding: '3px 10px' }}>{badge}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => onChange(String(Math.max(min, numVal - step)))}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: PA, border: `1.5px solid ${PL}`,
            color: P, fontSize: 20, cursor: 'pointer', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>−</button>
        <input
          type="number" value={value} onChange={e => onChange(e.target.value)}
          min={min} max={max}
          style={{
            flex: 1, padding: '10px 0', textAlign: 'center',
            background: '#f8fafc', border: `1.5px solid #e2e8f0`,
            borderRadius: 10, color: '#0f172a',
            fontSize: 22, fontWeight: 800, fontFamily: "'Syne',sans-serif", outline: 'none',
          }} />
        <button
          onClick={() => onChange(String(Math.min(max, numVal + step)))}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: PA, border: `1.5px solid ${PL}`,
            color: P, fontSize: 20, cursor: 'pointer', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
      </div>
      {/* Slider track visual */}
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, marginTop: 12, position: 'relative' }}>
        <div style={{ height: '100%', width: `${trackPct}%`, background: P, borderRadius: 3 }} />
        <div style={{
          position: 'absolute', top: -5, left: `${trackPct - 1.5}%`,
          width: 16, height: 16, borderRadius: '50%', background: P,
          boxShadow: `0 2px 6px rgba(109,40,217,.4)`,
        }} />
      </div>
    </div>
  );
}

// ─── Main HomePage ────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();

  const [courses, setCourses]             = useState<Course[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading]             = useState(true);

  // Modal states — flows: configCourse → mobileWarning → radarVisible
  const [configCourse, setConfigCourse]   = useState<Course | null>(null);
  const [cfgRadius, setCfgRadius]         = useState('200');
  const [cfgDuration, setCfgDuration]     = useState('60');
  const [fetching, setFetching]           = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(false);

  // Radar modal
  const [radarData, setRadarData] = useState<{
    course: Course; students: PreviewStudent[];
    total_enrolled: number; in_range: number;
    lat: number; lng: number;
  } | null>(null);
  const [launching, setLaunching] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        ProfAPI.getCourses(),
        ProfAPI.getActiveSession(),
      ]);
      setCourses(cRes.data.data || []);
      setActiveSession(sRes.data.data || null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Step 1: professor clicks Start on a course
  async function handleStartClick(course: Course) {
    if (activeSession) { notify('End your current session first', 'error'); return; }
    setConfigCourse(course);
    setCfgRadius('200');
    setCfgDuration('60');
  }

  // Step 2: professor clicks "Scan Students →" in config modal
  // → show mobile accuracy warning first
  function handleScanClick() {
    const radius = parseInt(cfgRadius) || 200;
    if (radius < 50 || radius > 500) { notify('Radius must be 50–500 m', 'error'); return; }
    setShowMobileWarning(true);
  }

  // Step 3: professor dismisses warning and wants to continue on web
  async function handleFetchPreview() {
    setShowMobileWarning(false);
    if (!configCourse) return;
    const radius = parseInt(cfgRadius) || 200;
    setFetching(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000 })
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      const r = await ProfAPI.previewStudents({
        course_id: configCourse.course_id, lat, lng, radius_meters: radius,
      });
      const { students, total_enrolled, in_range } = r.data.data;
      setRadarData({ course: configCourse, students, total_enrolled, in_range, lat, lng });
      setConfigCourse(null);
    } catch (err: any) {
      if (err.code === 1) notify('Location permission denied. Enable GPS.', 'error');
      else notify(err.response?.data?.error || 'Could not get location', 'error');
    } finally { setFetching(false); }
  }

  // Rescan students (called every 10s by RadarModal)
  const handleRescan = useCallback(async () => {
    if (!radarData) return;
    try {
      const r = await ProfAPI.previewStudents({
        course_id: radarData.course.course_id,
        lat: radarData.lat,
        lng: radarData.lng,
        radius_meters: parseInt(cfgRadius) || 200,
      });
      const { students, in_range } = r.data.data;
      setRadarData(prev => prev ? { ...prev, students, in_range } : null);
    } catch { /* silent */ }
  }, [radarData, cfgRadius]);

  // Confirm and deploy session
  async function handleConfirmStart() {
    if (!radarData) return;
    setLaunching(true);
    try {
      const res = await ProfAPI.startSession({
        course_id:              radarData.course.course_id,
        lat:                    radarData.lat,
        lng:                    radarData.lng,
        radius_meters:          parseInt(cfgRadius) || 200,
        class_duration_minutes: parseInt(cfgDuration) || 60,
      });
      const data = res.data.data;
      setActiveSession(data);
      setRadarData(null);
      notify(`✅ Session started — ${data.students_notified} students notified`);
      navigate('/dashboard/' + data.session_id);
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed to start session', 'error');
    } finally { setLaunching(false); }
  }

  async function handleEndSession() {
    if (!activeSession || !confirm('End the active session?')) return;
    try {
      await ProfAPI.endSession(activeSession.session_id);
      setActiveSession(null);
      notify('Session ended');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <Spinner size={36} />
    </div>
  );

  return (
    <>
      {/* Inject keyframes */}
      <style>{STYLES}</style>

      <div>
        {/* ── Active session banner ── */}
        {activeSession && (
          <div style={{
            background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.22)',
            borderRadius: 16, padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            boxShadow: '0 4px 16px rgba(239,68,68,.10)',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
              display: 'inline-block', animation: 'blipPulse 1.4s ease-in-out infinite',
              boxShadow: '0 0 0 4px rgba(239,68,68,.2)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: '#dc2626' }}>🔴 Live Session Active</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{activeSession.course_name}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => navigate('/dashboard/' + activeSession.session_id)}>Open Dashboard →</Button>
            <Button variant="danger" size="sm" onClick={handleEndSession}>End Session</Button>
          </div>
        )}

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 800, color: D.textPrimary, letterSpacing: '-.3px' }}>My Courses</div>
            <div style={{ fontSize: 13, color: D.textMuted, marginTop: 3 }}>Tap Start to open an attendance session</div>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <Button variant="secondary" size="sm" onClick={() => navigate('/assign-courses')}>⚙ Manage Courses</Button>
          </div>
        </div>

        {/* ── Courses grid ── */}
        {courses.length === 0 ? (
          <EmptyState icon="📚" title="No courses assigned" sub="Assign yourself to courses first"
            action={<Button variant="primary" onClick={() => navigate('/assign-courses')}>⚙ Assign Courses</Button>} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(288px, 1fr))', gap: 16 }}>
            {courses.map(c => {
              const isActive = activeSession?.course_id === c.course_id;
              return (
                <div key={c.course_id} style={{
                  background: D.surface, backdropFilter: 'blur(16px)',
                  border: `1px solid ${isActive ? 'rgba(239,68,68,.28)' : D.border}`,
                  borderRadius: 18, padding: '20px', transition: 'all .18s',
                  boxShadow: isActive ? '0 4px 20px rgba(239,68,68,.12)' : '0 2px 8px rgba(0,0,0,.1)',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, right: 0, width: 80, height: 80, pointerEvents: 'none',
                    background: isActive
                      ? 'radial-gradient(circle, rgba(239,68,68,.10) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(79,127,255,.07) 0%, transparent 70%)',
                  }} />

                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: D.accent, marginBottom: 7 }}>
                    {c.code}{c.section ? ` · ${c.section}` : ''} · Sem {c.semester}
                  </div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 800, color: D.textPrimary, marginBottom: 4, letterSpacing: '-.2px' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: D.textMuted, marginBottom: 14 }}>{c.dept_name}</div>

                  {(c.student_count ?? 0) > 0 && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 12, color: D.accent, fontWeight: 600,
                      background: D.accentLight, border: `1px solid ${D.accent}33`,
                      borderRadius: 8, padding: '3px 10px', marginBottom: 14,
                    }}>👥 {c.student_count} students</div>
                  )}

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {isActive ? (
                      <>
                        <Badge variant="red">● LIVE</Badge>
                        <Button variant="secondary" size="sm" style={{ marginLeft: 'auto' }} onClick={() => navigate('/dashboard/' + activeSession!.session_id)}>View →</Button>
                      </>
                    ) : (
                      <Button variant="primary" size="sm" style={{ marginLeft: 'auto' }} disabled={!!activeSession} onClick={() => handleStartClick(c)}>▶ Start</Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/manage-students/${c.course_id}?name=${encodeURIComponent(c.name)}`)}>👥</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ════ Config Modal ════ */}
      {configCourse && !showMobileWarning && (
        <div onClick={e => e.target === e.currentTarget && setConfigCourse(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20, animation: 'overlayIn .15s ease',
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480,
            boxShadow: '0 24px 64px rgba(0,0,0,.25)', overflow: 'hidden',
            animation: 'fadeSlideUp .2s ease',
          }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg,rgba(237,233,254,.4),rgba(139,92,246,.05))',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📡</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: '#0f172a' }}>Start Attendance Session</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{configCourse.name}{configCourse.section ? ` · ${configCourse.section}` : ''}</div>
              </div>
              <button onClick={() => setConfigCourse(null)} style={{
                background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8,
                color: '#64748b', fontSize: 14, padding: '5px 9px', cursor: 'pointer',
              }}>✕</button>
            </div>

            <div style={{ padding: '22px 22px 4px' }}>
              <StepperInput label="Geofence Radius" value={cfgRadius} onChange={setCfgRadius}
                min={50} max={500} step={25} badge={`${cfgRadius}m`} />
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: -16, marginBottom: 22 }}>
                50m tight · 200m standard · 500m wide
              </div>
              <StepperInput label="Class Duration" value={cfgDuration} onChange={setCfgDuration}
                min={30} max={300} step={15} badge={`${cfgDuration}min · ${parseInt(cfgDuration) > 75 ? '2 credits' : '1 credit'}`} />
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: -16, marginBottom: 10 }}>
                Sessions &gt;75 min automatically award 2 attendance credits
              </div>
            </div>

            <div style={{ padding: '16px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfigCourse(null)} style={{
                padding: '10px 18px', borderRadius: 10, border: '1px solid #e2e8f0',
                background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={handleScanClick} disabled={fetching} style={{
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: '#6d28d9', color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: fetching ? 'wait' : 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(109,40,217,.3)',
              }}>
                {fetching && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'radarSweep .7s linear infinite', display: 'inline-block' }} />}
                {fetching ? 'Getting location…' : 'Scan Students →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ Mobile Warning Modal ════ */}
      {showMobileWarning && (
        <MobileWarningModal
          onClose={() => setShowMobileWarning(false)}
          onContinue={handleFetchPreview}
        />
      )}

      {/* ════ Radar Modal ════ */}
      {radarData && (
        <RadarModal
          course={radarData.course}
          students={radarData.students}
          total={radarData.total_enrolled}
          inRange={radarData.in_range}
          radius={parseInt(cfgRadius) || 200}
          lat={radarData.lat}
          lng={radarData.lng}
          launching={launching}
          onConfirm={handleConfirmStart}
          onClose={() => setRadarData(null)}
          onRescan={handleRescan}
        />
      )}
    </>
  );
}