// import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// import { useParams, useNavigate } from 'react-router-dom';
// import { ProfAPI } from '../services/api';
// import {
//   joinSession, leaveSession, onSessionEvent,
//   sendChatMessage, requestChatHistory,
//   onStudentChatMessage, onChatHistory, getSocket,
// } from '../services/socket';
// import { useAuthStore } from '../store/auth.store';
// import { connectSocket } from '../services/socket';
// import { D } from '../components/design-tokens';
// import { Button, Badge, Tabs, Spinner, EmptyState, notify } from '../components/ui';
// import type { StudentCard, ChatMessage } from '../types';

// function fmtTimer(sec: number) {
//   const m = Math.floor(sec / 60), s = sec % 60;
//   return `${m}:${String(s).padStart(2, '0')}`;
// }
// function fmtTime(iso: string) {
//   return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
// }
// function cardStatus(s: StudentCard): { cls: string; icon: string; borderColor: string; bg: string } {
//   if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS')
//     return { cls: 'present', icon: '✅', borderColor: 'rgba(34,197,94,.35)', bg: 'rgba(34,197,94,.03)' };
//   if (s.verification_status === 'SUSPICIOUS')
//     return { cls: 'suspicious', icon: '⚠️', borderColor: 'rgba(245,158,11,.35)', bg: 'rgba(245,158,11,.03)' };
//   if (s.verification_status === 'FAILED')
//     return { cls: 'failed', icon: '❌', borderColor: 'rgba(239,68,68,.25)', bg: 'transparent' };
//   if (s.marked_by === 'PROFESSOR')
//     return { cls: 'manual', icon: '✋', borderColor: D.border, bg: 'transparent' };
//   return { cls: '', icon: '⏳', borderColor: D.border, bg: 'transparent' };
// }

// export default function DashboardPage() {
//   const { sessionId } = useParams<{ sessionId: string }>();
//   const navigate = useNavigate();
//   const { user, accessToken } = useAuthStore();

//   const [session, setSession] = useState<any>(null);
//   const [studentsObj, setStudentsObj] = useState<Record<string, StudentCard>>({});
//   const [loading, setLoading] = useState(true);
//   const [sessionEnded, setSessionEnded] = useState(false);
//   const [timeLeft, setTimeLeft] = useState(0);
//   const [endingSession, setEndingSession] = useState(false);

//   const [mainTab, setMainTab] = useState('students');
//   const [studentFilter, setStudentFilter] = useState('all');

//   const [selectedStudent, setSelectedStudent] = useState<StudentCard | null>(null);
//   const [overrideStatus, setOverrideStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
//   const [overrideReason, setOverrideReason] = useState('');
//   const [overriding, setOverriding] = useState(false);

//   const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
//   const [chatInput, setChatInput] = useState('');
//   const [chatUnread, setChatUnread] = useState(0);
//   const chatRef = useRef<HTMLDivElement>(null);
//   const timerRef = useRef<ReturnType<typeof setInterval>>();
//   const mainTabRef = useRef(mainTab);
//   useEffect(() => { mainTabRef.current = mainTab; }, [mainTab]);

//   const loadDashboard = useCallback(async () => {
//     if (!sessionId) return;
//     try {
//       const res = await ProfAPI.getDashboard(sessionId);
//       const data = res.data.data;
//       setSession(data.session);
//       const obj: Record<string, StudentCard> = {};
//       data.students.forEach((s: StudentCard) => { obj[s.student_id] = s; });
//       setStudentsObj(obj);
//       if (data.session.status !== 'ACTIVE') setSessionEnded(true);
//     } catch { /* silent */ }
//     finally { setLoading(false); }
//   }, [sessionId]);

//   useEffect(() => {
//     loadDashboard();

//     // Connect socket
//     const token = accessToken || localStorage.getItem('prof_access') || '';
//     if (token) {
//       connectSocket(token);
//     }

//     if (!sessionId) return;
//     joinSession(sessionId);
//     requestChatHistory(sessionId);

//     const unsubSessions = onSessionEvent((event: any) => {
//       const t = event.type || '';
//       if (['SESSION_ENDED', 'SESSION_EXPIRED', 'SESSION_CANCELLED'].includes(t)) {
//         setSessionEnded(true);
//         return;
//       }
//       if (event.data?.student_id) {
//         setStudentsObj(prev => ({
//           ...prev,
//           [event.data.student_id]: { ...(prev[event.data.student_id] || {}), ...event.data },
//         }));
//       }
//     });

//     const unsubChat = onStudentChatMessage((msg) => {
//       setChatMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
//       if (mainTabRef.current !== 'chat') setChatUnread(n => n + 1);
//       else setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
//     });

//     const unsubHistory = onChatHistory((data) => {
//       setChatMessages(data.messages || []);
//     });

//     const sock = getSocket();
//     const profReplyHandler = (msg: ChatMessage) => {
//       setChatMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, { ...msg, sender_type: 'PROFESSOR' }]);
//       setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
//     };
//     sock?.on('professor_reply_sent', profReplyHandler);

//     return () => {
//       unsubSessions();
//       unsubChat();
//       unsubHistory();
//       sock?.off('professor_reply_sent', profReplyHandler);
//       leaveSession(sessionId);
//     };
//   }, [sessionId]);

//   // Countdown timer
//   useEffect(() => {
//     if (!session?.expires_at) return;
//     const update = () => {
//       const r = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
//       setTimeLeft(r);
//       if (r === 0) clearInterval(timerRef.current);
//     };
//     update();
//     timerRef.current = setInterval(update, 1000);
//     return () => clearInterval(timerRef.current);
//   }, [session?.expires_at]);

//   useEffect(() => {
//     if (chatMessages.length > 0) {
//       setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
//     }
//   }, [chatMessages]);

//   async function handleEndSession() {
//     if (!confirm('End the attendance session? Remaining students will be marked absent.')) return;
//     setEndingSession(true);
//     try {
//       await ProfAPI.endSession(sessionId!);
//       setSessionEnded(true);
//       notify('Session ended');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     } finally { setEndingSession(false); }
//   }

//   async function handleCancelSession() {
//     if (!confirm('CANCEL session? ALL attendance records will be permanently DELETED.')) return;
//     try {
//       await ProfAPI.cancelSession(sessionId!);
//       setSessionEnded(true);
//       notify('Session cancelled — no records saved');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Failed', 'error');
//     }
//   }

//   async function handleOverrideSubmit() {
//     if (!selectedStudent || !overrideReason.trim()) { notify('Reason required', 'error'); return; }
//     setOverriding(true);
//     try {
//       await ProfAPI.manualOverride(sessionId!, selectedStudent.student_id, overrideStatus, overrideReason.trim());
//       setStudentsObj(prev => ({
//         ...prev,
//         [selectedStudent.student_id]: {
//           ...prev[selectedStudent.student_id],
//           status: overrideStatus,
//           verification_status: 'VERIFIED',
//           marked_by: 'PROFESSOR',
//           override_reason: overrideReason.trim(),
//         },
//       }));
//       setSelectedStudent(null);
//       setOverrideReason('');
//       notify('Override applied');
//     } catch (err: any) {
//       notify(err.response?.data?.error || 'Override failed', 'error');
//     } finally { setOverriding(false); }
//   }

//   function handleSendChat() {
//     const text = chatInput.trim();
//     if (!text) return;
//     sendChatMessage(sessionId!, text);
//     setChatInput('');
//   }

//   const studentsArr = useMemo(() =>
//     Object.values(studentsObj).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
//     [studentsObj]
//   );

//   const notifiedArr   = studentsArr.filter(s => s.notified !== false);
//   const unnotifiedArr = studentsArr.filter(s => s.notified === false);
//   const presentCount  = studentsArr.filter(s => s.status === 'PRESENT').length;
//   const absentCount   = studentsArr.filter(s => s.status === 'ABSENT').length;
//   const suspCount     = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
//   const pendingCount  = studentsArr.filter(s => s.verification_status === 'PENDING').length;
//   const isTimeLow     = session ? (new Date(session.expires_at).getTime() - Date.now()) < 120000 : false;

//   const visibleStudents = studentFilter === 'notified' ? notifiedArr
//     : studentFilter === 'unnotified' ? unnotifiedArr : studentsArr;

//   if (loading) return (
//     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
//       <Spinner size={36} />
//     </div>
//   );

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
//       {/* Header */}
//       <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
//         <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← Back</Button>
//         <div style={{ flex: 1 }}>
//           <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17 }}>
//             {session?.course_name}{session?.section ? ` — ${session.section}` : ''}
//           </div>
//           <div style={{ fontSize: 12, color: D.textMuted }}>{session?.code} · {session?.attendance_credits} credit(s)</div>
//         </div>
//         {!sessionEnded && (
//           <div style={{
//             background: isTimeLow ? D.red : D.surface2,
//             border: `1px solid ${isTimeLow ? 'transparent' : D.border}`,
//             borderRadius: 8, padding: '6px 14px',
//             fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15,
//             color: isTimeLow ? '#fff' : D.textPrimary, letterSpacing: 1,
//           }}>⏱ {fmtTimer(timeLeft)}</div>
//         )}
//         {!sessionEnded ? (
//           <>
//             <Button variant="ghost" size="sm" style={{ color: D.textSecondary, border: `1px solid ${D.border}` }} onClick={handleCancelSession}>✕ Cancel</Button>
//             <Button variant="success" size="sm" loading={endingSession} onClick={handleEndSession}>✅ End Session</Button>
//           </>
//         ) : (
//           <Badge variant="gray">Session Ended</Badge>
//         )}
//       </div>

//       {sessionEnded && (
//         <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: D.amber, marginBottom: 14 }}>
//           🏁 Session ended — you can still override attendance below
//         </div>
//       )}

//       {/* Summary pills */}
//       <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
//         {[
//           ['Present', presentCount, D.green],
//           ['Absent', absentCount, D.red],
//           ['Suspicious', suspCount, D.amber],
//           ['Pending', pendingCount, D.textMuted],
//         ].map(([label, val, color]) => (
//           <div key={label as string} style={{ flex: 1, background: D.surface, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
//             <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: color as string }}>{val as number}</div>
//             <div style={{ fontSize: 10, color: D.textMuted, fontWeight: 600, textTransform: 'uppercase', marginTop: 2 }}>{label as string}</div>
//           </div>
//         ))}
//       </div>

//       {/* Tabs */}
//       <Tabs
//         active={mainTab}
//         onChange={k => { setMainTab(k); if (k === 'chat') setChatUnread(0); }}
//         tabs={[
//           { key: 'students', label: `👥 Students (${studentsArr.length})` },
//           { key: 'chat', label: '💬 Chat', badge: chatUnread },
//         ]}
//       />

//       {/* Students Tab */}
//       {mainTab === 'students' && (
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
//           {/* Sub-filter */}
//           <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
//             {[
//               ['all', `All (${studentsArr.length})`],
//               ['notified', `📶 Notified (${notifiedArr.length})`],
//               ['unnotified', `⚠️ Outside (${unnotifiedArr.length})`],
//             ].map(([k, l]) => (
//               <div key={k} onClick={() => setStudentFilter(k)} style={{
//                 padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
//                 background: studentFilter === k ? D.accentLight : D.surface2,
//                 border: `1px solid ${studentFilter === k ? 'rgba(79,127,255,.3)' : D.border}`,
//                 color: studentFilter === k ? D.accent : D.textSecondary,
//               }}>{l}</div>
//             ))}
//           </div>

//           {studentFilter === 'unnotified' && unnotifiedArr.length > 0 && (
//             <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: D.amber, marginBottom: 10 }}>
//               ⚠️ These students were outside the classroom range when the session started — possible proxies.
//             </div>
//           )}

//           <div style={{ flex: 1, overflowY: 'auto' }}>
//             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
//               {visibleStudents.map(s => {
//                 const { icon, borderColor, bg } = cardStatus(s);
//                 return (
//                   <div key={s.student_id} onClick={() => { setSelectedStudent(s); setOverrideStatus(s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT'); setOverrideReason(''); }}
//                     style={{ border: `1.5px solid ${borderColor}`, borderRadius: 10, padding: 14, background: bg, position: 'relative', cursor: 'pointer', transition: 'border-color .15s' }}>
//                     {s.notified === false && (
//                       <div style={{ position: 'absolute', top: 8, left: 8, background: D.amber, borderRadius: 4, padding: '2px 5px', fontSize: 8, fontWeight: 800, color: '#000' }}>OUT</div>
//                     )}
//                     <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 14 }}>{icon}</div>
//                     <div style={{ width: 44, height: 44, borderRadius: 12, background: D.surface2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: D.textSecondary, marginBottom: 8 }}>
//                       {s.name?.charAt(0)?.toUpperCase() || '?'}
//                     </div>
//                     <div style={{ fontSize: 12, fontWeight: 600, color: D.textPrimary }}>{s.name}</div>
//                     <div style={{ fontSize: 10.5, color: D.textMuted, marginTop: 1 }}>{s.roll_number}</div>
//                     {s.face_score != null && (
//                       <div style={{ fontSize: 10, color: D.textMuted, marginTop: 3 }}>
//                         F:{Math.round(s.face_score * 100)}%{s.scene_score != null ? ` S:${Math.round(s.scene_score * 100)}%` : ''}
//                       </div>
//                     )}
//                     {s.marked_by === 'PROFESSOR' && <div style={{ fontSize: 9, color: D.accent, marginTop: 3, fontWeight: 700 }}>✋ Manual</div>}
//                   </div>
//                 );
//               })}
//             </div>
//             {visibleStudents.length === 0 && <EmptyState icon="👥" title="No students" sub="No students in this view" />}
//           </div>
//         </div>
//       )}

//       {/* Chat Tab */}
//       {mainTab === 'chat' && (
//         <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface, borderRadius: 12, border: `1px solid ${D.border}` }}>
//           <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
//             {chatMessages.length === 0 && <EmptyState icon="💬" title="No messages yet" sub="Students can message you here during the session" />}
//             {chatMessages.map((msg, i) => {
//               const isMe = msg.sender_type === 'PROFESSOR';
//               return (
//                 <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
//                   {!isMe && <div style={{ fontSize: 10, fontWeight: 700, color: D.textMuted, marginBottom: 3 }}>{msg.student_name} ({msg.roll_number})</div>}
//                   <div style={{ maxWidth: '72%', padding: '10px 13px', borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px', background: isMe ? D.accent : D.surface2, fontSize: 13, lineHeight: 1.5 }}>
//                     {msg.message}
//                     <div style={{ fontSize: 9.5, color: isMe ? 'rgba(255,255,255,.5)' : D.textMuted, marginTop: 3, textAlign: 'right' }}>{fmtTime(msg.created_at)}</div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//           <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${D.border}` }}>
//             <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()} placeholder="Reply to students…" maxLength={500}
//               style={{ flex: 1, padding: '8px 14px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 99, color: D.textPrimary, fontSize: 13, outline: 'none' }} />
//             <Button variant="primary" size="sm" disabled={!chatInput.trim()} onClick={handleSendChat}>Send</Button>
//           </div>
//         </div>
//       )}

//       {/* Override Modal */}
//       {selectedStudent && (
//         <div onClick={e => e.target === e.currentTarget && setSelectedStudent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
//           <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 16, width: '100%', maxWidth: 480 }}>
//             <div style={{ padding: '18px 22px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center' }}>
//               <div style={{ flex: 1 }}>
//                 <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>{selectedStudent.name}</div>
//                 <div style={{ fontSize: 13, color: D.textMuted }}>{selectedStudent.roll_number}</div>
//               </div>
//               <button onClick={() => setSelectedStudent(null)} style={{ background: 'none', color: D.textMuted, fontSize: 18, cursor: 'pointer' }}>✕</button>
//             </div>
//             <div style={{ padding: 22 }}>
//               {selectedStudent.notified === false && (
//                 <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: D.amber, marginBottom: 16 }}>
//                   ⚠️ Was outside classroom range — possible proxy
//                 </div>
//               )}
//               {/* Scores */}
//               {(selectedStudent.face_score != null || selectedStudent.liveness_score != null || selectedStudent.scene_score != null) && (
//                 <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
//                   {[['Face', selectedStudent.face_score, 0.65], ['Liveness', selectedStudent.liveness_score, 0.70], ['Scene', selectedStudent.scene_score, 0.60]].map(([l, v, t]) => (
//                     <div key={l as string} style={{ flex: 1, background: D.surface2, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
//                       <div style={{ fontSize: 10, color: D.textMuted, fontWeight: 600, marginBottom: 4 }}>{l as string}</div>
//                       <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: v == null ? D.textMuted : (v as number) >= (t as number) ? D.green : D.red }}>
//                         {v == null ? '—' : Math.round((v as number) * 100) + '%'}
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               )}
//               {/* Toggle */}
//               <div style={{ marginBottom: 16 }}>
//                 <div style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Change to</div>
//                 <div style={{ display: 'flex', gap: 8 }}>
//                   {(['PRESENT', 'ABSENT'] as const).map(st => (
//                     <button key={st} onClick={() => setOverrideStatus(st)} style={{
//                       flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, transition: 'all .15s',
//                       border: `2px solid ${overrideStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.border}`,
//                       background: overrideStatus === st ? (st === 'PRESENT' ? D.greenLight : D.redLight) : 'transparent',
//                       color: overrideStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.textSecondary,
//                     }}>{st === 'PRESENT' ? '✅ Present' : '❌ Absent'}</button>
//                   ))}
//                 </div>
//               </div>
//               {/* Reason */}
//               <div style={{ marginBottom: 4 }}>
//                 <div style={{ fontSize: 11.5, fontWeight: 600, color: D.textSecondary, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Reason (required)</div>
//                 <textarea value={overrideReason} onChange={e => setOverrideReason(e.target.value)} placeholder="e.g. physically verified, student appeal…" rows={3}
//                   style={{ width: '100%', padding: '9px 12px', background: D.surface2, border: `1px solid ${D.border}`, borderRadius: 8, color: D.textPrimary, fontSize: 13, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }} />
//               </div>
//             </div>
//             <div style={{ padding: '16px 22px', borderTop: `1px solid ${D.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
//               <Button variant="secondary" onClick={() => setSelectedStudent(null)}>Close</Button>
//               <Button variant="primary" loading={overriding} onClick={handleOverrideSubmit}>Apply Override</Button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }



















import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ProfAPI } from '../services/api';
import {
  joinSession, leaveSession, onSessionEvent,
  sendChatMessage, requestChatHistory,
  onStudentChatMessage, onChatHistory, getSocket,
} from '../services/socket';
import { useAuthStore } from '../store/auth.store';
import { connectSocket } from '../services/socket';
import { D } from '../components/design-tokens';
import { Button, Badge, Tabs, Spinner, EmptyState, notify } from '../components/ui';
import type { StudentCard, ChatMessage } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTimer(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function cardAccent(s: StudentCard): string {
  if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return D.green;
  if (s.verification_status === 'SUSPICIOUS') return D.amber;
  if (s.verification_status === 'FAILED')     return D.red;
  if (s.marked_by === 'PROFESSOR')            return D.accent;
  return D.border;
}
function cardIcon(s: StudentCard): string {
  if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '✅';
  if (s.verification_status === 'SUSPICIOUS') return '⚠️';
  if (s.verification_status === 'FAILED')     return '❌';
  if (s.marked_by === 'PROFESSOR')            return '✋';
  return '⏳';
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.4} }
@keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
@keyframes blip    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
`;

// ─── ScorePill ────────────────────────────────────────────────────────────────
function ScorePill({ label, value, threshold }: { label: string; value?: number; threshold: number }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = value >= threshold ? D.green : D.red;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700,
      background: color + '18', color, border: `1px solid ${color}44`,
    }}>
      {label} {pct}%
    </span>
  );
}

// ─── ImageFullscreen ──────────────────────────────────────────────────────────
function ImageFullscreen({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,.92)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <img
        src={`data:image/jpeg;base64,${src}`}
        alt="Captured face"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '86vw', maxHeight: '86vh', borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,.8)', objectFit: 'contain',
        }}
      />
      <button onClick={onClose} style={{
        position: 'absolute', top: 20, right: 20,
        background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)',
        borderRadius: '50%', width: 40, height: 40, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 18, cursor: 'pointer',
      }}>✕</button>
      <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,.35)', fontSize: 12 }}>
        Press Esc or click anywhere to close
      </div>
    </div>
  );
}

// ─── StudentCardItem ──────────────────────────────────────────────────────────
function StudentCardItem({ s, onPress, onImageClick }: {
  s: StudentCard;
  onPress: () => void;
  onImageClick: (src: string) => void;
}) {
  const accent   = cardAccent(s);
  const icon     = cardIcon(s);
  const initials = (s.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onPress}
      style={{
        background: D.surface, borderRadius: 16,
        border: `1px solid ${D.border}`, borderTop: `3px solid ${accent}`,
        overflow: 'hidden', cursor: 'pointer', position: 'relative',
        transition: 'transform .12s, box-shadow .12s',
        boxShadow: '0 2px 8px rgba(0,0,0,.18)',
        animation: 'blip .3s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLElement).style.boxShadow = `0 6px 20px rgba(0,0,0,.28)`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,.18)';
      }}
    >
      {/* OUT badge */}
      {s.notified === false && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 5,
          background: D.amber, borderRadius: 5,
          padding: '2px 6px', fontSize: 8, fontWeight: 900, color: '#000',
        }}>OUT</div>
      )}

      {/* Status icon badge */}
      <div style={{
        position: 'absolute', top: 8, right: 8, zIndex: 5,
        width: 26, height: 26, borderRadius: '50%',
        background: accent + '22', border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13,
      }}>{icon}</div>

      {/* Photo / avatar */}
      <div style={{ position: 'relative' }}>
        {s.captured_image_b64 ? (
          <>
            <img
              src={`data:image/jpeg;base64,${s.captured_image_b64}`}
              alt={s.name}
              onClick={e => { e.stopPropagation(); onImageClick(s.captured_image_b64!); }}
              style={{
                width: '100%', height: 110, objectFit: 'cover',
                display: 'block', cursor: 'zoom-in',
                borderBottom: `2px solid ${accent}55`,
              }}
            />
            {/* Zoom hint */}
            <div
              onClick={e => { e.stopPropagation(); onImageClick(s.captured_image_b64!); }}
              style={{
                position: 'absolute', bottom: 6, right: 6,
                background: 'rgba(0,0,0,.55)', borderRadius: 6,
                padding: '2px 6px', fontSize: 9, color: '#fff',
                fontWeight: 700, cursor: 'zoom-in',
              }}
            >🔍 Tap to enlarge</div>
          </>
        ) : (
          <div style={{
            width: '100%', height: 72,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: accent + '10', borderBottom: `1px solid ${D.border}`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: accent + '22', border: `2px solid ${accent}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 800,
              color: accent,
            }}>{initials}</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: D.textPrimary, lineHeight: 1.3, marginBottom: 1 }}>
          {s.name}
        </div>
        <div style={{ fontSize: 10.5, color: D.textMuted, marginBottom: 6 }}>{s.roll_number}</div>

        {/* Score pills */}
        {(s.face_score != null || s.liveness_score != null || s.scene_score != null) && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 4 }}>
            <ScorePill label="F" value={s.face_score}     threshold={0.65} />
            <ScorePill label="L" value={s.liveness_score} threshold={0.70} />
            <ScorePill label="S" value={s.scene_score}    threshold={0.60} />
          </div>
        )}

        {s.marked_by === 'PROFESSOR' && (
          <div style={{ fontSize: 9.5, color: D.accent, fontWeight: 700, marginTop: 2 }}>✋ Manual</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();

  const [session, setSession]             = useState<any>(null);
  const [studentsObj, setStudentsObj]     = useState<Record<string, StudentCard>>({});
  const [loading, setLoading]             = useState(true);
  const [sessionEnded, setSessionEnded]   = useState(false);
  const [timeLeft, setTimeLeft]           = useState(0);
  const [endingSession, setEndingSession] = useState(false);

  const [mainTab, setMainTab]           = useState('students');
  const [studentFilter, setStudentFilter] = useState('all');

  // Override modal
  const [selectedStudent, setSelectedStudent]   = useState<StudentCard | null>(null);
  const [overrideStatus, setOverrideStatus]     = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [overrideReason, setOverrideReason]     = useState('');
  const [overriding, setOverriding]             = useState(false);

  // Full-screen image viewer
  const [fullImg, setFullImg] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [chatUnread, setChatUnread]     = useState(0);
  const chatRef    = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval>>();
  const mainTabRef = useRef(mainTab);
  useEffect(() => { mainTabRef.current = mainTab; }, [mainTab]);

  // ── Load dashboard ────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res  = await ProfAPI.getDashboard(sessionId);
      const data = res.data.data;
      setSession(data.session);
      const obj: Record<string, StudentCard> = {};
      data.students.forEach((s: StudentCard) => { obj[s.student_id] = s; });
      setStudentsObj(obj);
      if (data.session.status !== 'ACTIVE') setSessionEnded(true);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [sessionId]);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    loadDashboard();

    const token = accessToken || localStorage.getItem('prof_access') || '';
    if (token) connectSocket(token);
    if (!sessionId) return;

    joinSession(sessionId);
    requestChatHistory(sessionId);

    const unsubSessions = onSessionEvent((event: any) => {
      const t = event.type || '';
      if (['SESSION_ENDED', 'SESSION_EXPIRED', 'SESSION_CANCELLED'].includes(t)) {
        setSessionEnded(true);
        return;
      }
      if (event.data?.student_id) {
        setStudentsObj(prev => ({
          ...prev,
          [event.data.student_id]: { ...(prev[event.data.student_id] || {}), ...event.data },
        }));
      }
    });

    const unsubChat = onStudentChatMessage((msg) => {
      setChatMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
      if (mainTabRef.current !== 'chat') setChatUnread(n => n + 1);
      else setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
    });

    const unsubHistory = onChatHistory((data) => { setChatMessages(data.messages || []); });

    const sock = getSocket();
    const profReplyHandler = (msg: ChatMessage) => {
      setChatMessages(prev => prev.some(m => m.message_id === msg.message_id) ? prev : [...prev, { ...msg, sender_type: 'PROFESSOR' }]);
      setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
    };
    sock?.on('professor_reply_sent', profReplyHandler);

    return () => {
      unsubSessions(); unsubChat(); unsubHistory();
      sock?.off('professor_reply_sent', profReplyHandler);
      leaveSession(sessionId);
    };
  }, [sessionId]);

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.expires_at) return;
    const update = () => {
      const r = Math.max(0, Math.floor((new Date(session.expires_at).getTime() - Date.now()) / 1000));
      setTimeLeft(r);
      if (r === 0) clearInterval(timerRef.current);
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => clearInterval(timerRef.current);
  }, [session?.expires_at]);

  useEffect(() => {
    if (chatMessages.length > 0)
      setTimeout(() => chatRef.current?.scrollTo(0, 9999), 100);
  }, [chatMessages]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleEndSession() {
    if (!confirm('End the attendance session? Remaining students will be marked absent.')) return;
    setEndingSession(true);
    try {
      await ProfAPI.endSession(sessionId!);
      setSessionEnded(true);
      notify('Session ended');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    } finally { setEndingSession(false); }
  }

  async function handleCancelSession() {
    if (!confirm('CANCEL session? ALL attendance records will be permanently DELETED.')) return;
    try {
      await ProfAPI.cancelSession(sessionId!);
      setSessionEnded(true);
      notify('Session cancelled — no records saved');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Failed', 'error');
    }
  }

  async function handleOverrideSubmit() {
    if (!selectedStudent || !overrideReason.trim()) { notify('Reason required', 'error'); return; }
    setOverriding(true);
    try {
      await ProfAPI.manualOverride(sessionId!, selectedStudent.student_id, overrideStatus, overrideReason.trim());
      setStudentsObj(prev => ({
        ...prev,
        [selectedStudent.student_id]: {
          ...prev[selectedStudent.student_id],
          status: overrideStatus,
          verification_status: 'VERIFIED',
          marked_by: 'PROFESSOR',
          override_reason: overrideReason.trim(),
        },
      }));
      setSelectedStudent(null);
      setOverrideReason('');
      notify('Override applied');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Override failed', 'error');
    } finally { setOverriding(false); }
  }

  function handleSendChat() {
    const text = chatInput.trim();
    if (!text) return;
    sendChatMessage(sessionId!, text);
    setChatInput('');
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const studentsArr = useMemo(() =>
    Object.values(studentsObj).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [studentsObj]
  );

  const notifiedArr   = studentsArr.filter(s => s.notified !== false);
  const unnotifiedArr = studentsArr.filter(s => s.notified === false);
  const presentCount  = studentsArr.filter(s => s.status === 'PRESENT').length;
  const absentCount   = studentsArr.filter(s => s.status === 'ABSENT').length;
  const suspCount     = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;
  const pendingCount  = studentsArr.filter(s => s.verification_status === 'PENDING').length;
  const isTimeLow     = session ? (new Date(session.expires_at).getTime() - Date.now()) < 120000 : false;

  const visibleStudents = studentFilter === 'notified'   ? notifiedArr
                        : studentFilter === 'unnotified' ? unnotifiedArr
                        : studentsArr;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <Spinner size={36} />
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← Back</Button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17 }}>
              {session?.course_name}{session?.section ? ` — ${session.section}` : ''}
            </div>
            <div style={{ fontSize: 12, color: D.textMuted }}>{session?.code} · {session?.attendance_credits} credit(s)</div>
          </div>

          {!sessionEnded && (
            <div style={{
              background: isTimeLow ? D.red : D.surface2,
              border: `1px solid ${isTimeLow ? 'transparent' : D.border}`,
              borderRadius: 8, padding: '6px 14px',
              fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15,
              color: isTimeLow ? '#fff' : D.textPrimary, letterSpacing: 1,
            }}>⏱ {fmtTimer(timeLeft)}</div>
          )}

          {!sessionEnded ? (
            <>
              <Button variant="ghost" size="sm"
                style={{ color: D.textSecondary, border: `1px solid ${D.border}` }}
                onClick={handleCancelSession}>✕ Cancel</Button>
              <Button variant="success" size="sm" loading={endingSession} onClick={handleEndSession}>✅ End Session</Button>
            </>
          ) : (
            <Badge variant="gray">Session Ended</Badge>
          )}
        </div>

        {sessionEnded && (
          <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: D.amber, marginBottom: 14 }}>
            🏁 Session ended — you can still override attendance below
          </div>
        )}

        {/* ── Stat strip ── */}
        <div style={{
          display: 'flex', gap: 0,
          background: D.surface, border: `1px solid ${D.border}`,
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        }}>
          {[
            ['Present',    presentCount, D.green   ],
            ['Absent',     absentCount,  D.red     ],
            ['Suspicious', suspCount,    D.amber   ],
            ['Pending',    pendingCount, D.textMuted],
          ].map(([label, val, color], i, arr) => (
            <div key={label as string} style={{
              flex: 1, padding: '12px 0', textAlign: 'center',
              borderRight: i < arr.length - 1 ? `1px solid ${D.border}` : 'none',
            }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: color as string }}>{val as number}</div>
              <div style={{ fontSize: 9.5, color: D.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>{label as string}</div>
            </div>
          ))}
        </div>

        {/* ── Main tabs ── */}
        <Tabs
          active={mainTab}
          onChange={k => { setMainTab(k); if (k === 'chat') setChatUnread(0); }}
          tabs={[
            { key: 'students', label: `👥 Students (${studentsArr.length})` },
            { key: 'chat',     label: '💬 Chat', badge: chatUnread },
          ]}
        />

        {/* ════ STUDENTS TAB ════ */}
        {mainTab === 'students' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sub-filter chips */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {[
                ['all',        `All (${studentsArr.length})`],
                ['notified',   `📶 Notified (${notifiedArr.length})`],
                ['unnotified', `⚠️ Outside (${unnotifiedArr.length})`],
              ].map(([k, l]) => (
                <div key={k} onClick={() => setStudentFilter(k)} style={{
                  padding: '4px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                  background: studentFilter === k ? D.accentLight : D.surface2,
                  border: `1px solid ${studentFilter === k ? 'rgba(79,127,255,.3)' : D.border}`,
                  color: studentFilter === k ? D.accent : D.textSecondary,
                  transition: 'all .12s',
                }}>{l}</div>
              ))}
            </div>

            {studentFilter === 'unnotified' && unnotifiedArr.length > 0 && (
              <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 8, padding: '8px 12px', fontSize: 11, color: D.amber, marginBottom: 10 }}>
                ⚠️ These students were outside the classroom range when the session started — possible proxies.
              </div>
            )}

            {/* Card grid */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {visibleStudents.length === 0 ? (
                <EmptyState icon="👥" title="No students" sub="No students in this view" />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, paddingBottom: 16 }}>
                  {visibleStudents.map(s => (
                    <StudentCardItem
                      key={s.student_id}
                      s={s}
                      onImageClick={setFullImg}
                      onPress={() => {
                        setSelectedStudent(s);
                        setOverrideStatus(s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT');
                        setOverrideReason('');
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════ CHAT TAB ════ */}
        {mainTab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: D.surface, borderRadius: 12, border: `1px solid ${D.border}` }}>
            <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatMessages.length === 0 && (
                <EmptyState icon="💬" title="No messages yet" sub="Students can message you here during the session" />
              )}
              {chatMessages.map((msg, i) => {
                const isMe = msg.sender_type === 'PROFESSOR';
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: D.textMuted, marginBottom: 3 }}>
                        {msg.student_name} ({msg.roll_number})
                      </div>
                    )}
                    <div style={{
                      maxWidth: '72%', padding: '10px 13px', fontSize: 13, lineHeight: 1.5,
                      borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      background: isMe ? D.accent : D.surface2,
                      color: isMe ? '#fff' : D.textPrimary,
                    }}>
                      {msg.message}
                      <div style={{ fontSize: 9.5, color: isMe ? 'rgba(255,255,255,.5)' : D.textMuted, marginTop: 3, textAlign: 'right' }}>
                        {fmtTime(msg.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${D.border}` }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                placeholder="Reply to students…"
                maxLength={500}
                style={{
                  flex: 1, padding: '8px 14px',
                  background: D.surface2, border: `1px solid ${D.border}`,
                  borderRadius: 99, color: D.textPrimary, fontSize: 13, outline: 'none',
                }}
              />
              <Button variant="primary" size="sm" disabled={!chatInput.trim()} onClick={handleSendChat}>Send</Button>
            </div>
          </div>
        )}

        {/* ════ OVERRIDE MODAL ════ */}
        {selectedStudent && (
          <div onClick={e => e.target === e.currentTarget && setSelectedStudent(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)',
            backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', zIndex: 1000, padding: '0 0',
          }}>
            <div style={{
              background: D.surface, width: '100%', maxWidth: 520,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              maxHeight: '92vh', overflow: 'auto',
              border: `1px solid ${D.border}`,
              boxShadow: '0 -8px 40px rgba(0,0,0,.5)',
              animation: 'fadeIn .2s ease',
            }}>
              {/* Drag handle */}
              <div style={{ width: 40, height: 4, background: D.border, borderRadius: 2, margin: '14px auto 0' }} />

              <div style={{ padding: '16px 22px 0' }}>
                {/* Student header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                  {/* Photo or initials */}
                  {selectedStudent.captured_image_b64 ? (
                    <div
                      onClick={() => setFullImg(selectedStudent.captured_image_b64!)}
                      style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', cursor: 'zoom-in', flexShrink: 0, border: `2px solid ${cardAccent(selectedStudent)}55` }}
                    >
                      <img
                        src={`data:image/jpeg;base64,${selectedStudent.captured_image_b64}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 64, height: 64, borderRadius: 14, flexShrink: 0,
                      background: cardAccent(selectedStudent) + '18',
                      border: `2px solid ${cardAccent(selectedStudent)}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22,
                      color: cardAccent(selectedStudent),
                    }}>
                      {(selectedStudent.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18 }}>{selectedStudent.name}</div>
                    <div style={{ fontSize: 13, color: D.textMuted, marginTop: 2 }}>{selectedStudent.roll_number}</div>
                    {selectedStudent.captured_image_b64 && (
                      <button
                        onClick={() => setFullImg(selectedStudent.captured_image_b64!)}
                        style={{
                          marginTop: 4, background: 'none', border: 'none',
                          color: D.accent, fontSize: 11, fontWeight: 700,
                          cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                        }}
                      >🔍 Enlarge capture →</button>
                    )}
                  </div>

                  <button onClick={() => setSelectedStudent(null)} style={{
                    background: D.surface2, border: `1px solid ${D.border}`,
                    borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: D.textMuted, fontSize: 14, cursor: 'pointer', flexShrink: 0,
                  }}>✕</button>
                </div>

                {/* Proxy warning */}
                {selectedStudent.notified === false && (
                  <div style={{ background: D.amberLight, border: `1px solid rgba(245,158,11,.2)`, borderRadius: 10, padding: '8px 12px', fontSize: 12, color: D.amber, marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span>⚠️</span><span>Was outside classroom range — possible proxy</span>
                  </div>
                )}

                {/* Score tiles */}
                {(selectedStudent.face_score != null || selectedStudent.liveness_score != null || selectedStudent.scene_score != null) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {[
                      ['Face',     selectedStudent.face_score,     0.65],
                      ['Liveness', selectedStudent.liveness_score, 0.70],
                      ['Scene',    selectedStudent.scene_score,    0.60],
                    ].map(([l, v, t]) => {
                      const color = v == null ? D.textMuted : (v as number) >= (t as number) ? D.green : D.red;
                      return (
                        <div key={l as string} style={{ flex: 1, background: color + '12', border: `1px solid ${color}40`, borderRadius: 10, padding: '10px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 9.5, color: D.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{l as string}</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color }}>
                            {v == null ? '—' : Math.round((v as number) * 100) + '%'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Current status */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: cardAccent(selectedStudent) + '10',
                  border: `1px solid ${cardAccent(selectedStudent)}44`,
                  borderRadius: 10, padding: '10px 12px', marginBottom: 16,
                }}>
                  <span style={{ fontSize: 20 }}>{cardIcon(selectedStudent)}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: cardAccent(selectedStudent) }}>
                      Currently {selectedStudent.status === 'PRESENT' ? 'Present' : 'Absent'}
                    </div>
                    {selectedStudent.marked_by === 'PROFESSOR' && (
                      <div style={{ fontSize: 11, color: D.textMuted, marginTop: 2 }}>
                        Manual override{selectedStudent.override_reason ? `: ${selectedStudent.override_reason}` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Change to toggle */}
                <div style={{ fontSize: 11, fontWeight: 700, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Change to</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {(['PRESENT', 'ABSENT'] as const).map(st => (
                    <button key={st} onClick={() => setOverrideStatus(st)} style={{
                      flex: 1, padding: '11px', borderRadius: 10, cursor: 'pointer',
                      fontWeight: 700, fontSize: 14, transition: 'all .15s', fontFamily: 'inherit',
                      border: `1.5px solid ${overrideStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.border}`,
                      background: overrideStatus === st ? (st === 'PRESENT' ? D.greenLight : D.redLight) : 'transparent',
                      color: overrideStatus === st ? (st === 'PRESENT' ? D.green : D.red) : D.textSecondary,
                    }}>
                      {st === 'PRESENT' ? '✅ Present' : '❌ Absent'}
                    </button>
                  ))}
                </div>

                {/* Reason */}
                <div style={{ fontSize: 11, fontWeight: 700, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Reason (required)</div>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="e.g. physically verified, student appeal…"
                  rows={3}
                  style={{
                    width: '100%', padding: '9px 12px',
                    background: D.surface2, border: `1px solid ${D.border}`,
                    borderRadius: 9, color: D.textPrimary, fontSize: 13,
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    marginBottom: 4,
                  }}
                />
              </div>

              <div style={{ padding: '14px 22px 32px', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={() => setSelectedStudent(null)}>Close</Button>
                <Button variant="primary" loading={overriding} onClick={handleOverrideSubmit}>Apply Override & Notify</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════ FULL-SCREEN IMAGE ════ */}
      {fullImg && <ImageFullscreen src={fullImg} onClose={() => setFullImg(null)} />}
    </>
  );
}