// D:\smartattend\apps\admin-web\src\pages\ProfessorSessionPage.tsx
// NEW FILE — Professor live session dashboard
// Shows: attendance cards, cancel session button, manual override, chat with ALL students

import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:4000';

interface StudentCard {
  student_id: string;
  name: string;
  roll_number: string;
  face_photo_url: string | null;
  status: string;
  verification_status: string;
  face_score: number | null;
  liveness_score: number | null;
  scene_score: number | null;
  marked_by: string;
  override_reason: string | null;
  verification_timestamp: string | null;
}

interface ChatMessage {
  message_id: string;
  sender_type: 'STUDENT' | 'PROFESSOR';
  student_id?: string;
  student_name?: string;
  roll_number?: string;
  professor_name?: string;
  message: string;
  created_at: string;
}

interface SessionInfo {
  session_id: string;
  status: string;
  course_name: string;
  code: string;
  section: string | null;
  started_at: string;
  expires_at: string;
  attendance_credits: number;
}

interface Props {
  sessionId: string;
  accessToken: string;
  professorName: string;
  onSessionEnded: () => void;
}

export default function ProfessorSessionPage({
  sessionId, accessToken, professorName, onSessionEnded
}: Props) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [students, setStudents] = useState<Map<string, StudentCard>>(new Map());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'students' | 'chat'>('students');
  const [overrideModal, setOverrideModal] = useState<StudentCard | null>(null);
  const [overrideForm, setOverrideForm] = useState({ status: 'PRESENT', reason: '' });
  const [chatUnread, setChatUnread] = useState(0);
  const [timeLeft, setTimeLeft] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadDashboard();
    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const diff = new Date(session.expires_at).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Expired'); clearInterval(interval); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  async function loadDashboard() {
    const res = await fetch(`${API_URL}/sessions/${sessionId}/dashboard`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    if (data.success) {
      setSession(data.data.session);
      const map = new Map<string, StudentCard>();
      data.data.students.forEach((s: StudentCard) => map.set(s.student_id, s));
      setStudents(map);
    }
  }

  function initSocket() {
    const socket = io(WS_URL, { auth: { token: accessToken }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_session', sessionId);
      // Load chat history
      socket.emit('get_chat_history', { session_id: sessionId });
    });

    // Attendance events
    const attendanceEvents = [
      'STUDENT_VERIFIED', 'STUDENT_SUSPICIOUS', 'STUDENT_FAILED',
      'STUDENT_OVERRIDE', 'STUDENT_SCENE_FAILED'
    ];
    attendanceEvents.forEach(event => {
      socket.on(event, (payload: any) => {
        if (payload.data) {
          setStudents(prev => {
            const next = new Map(prev);
            const existing = next.get(payload.data.student_id) || {} as StudentCard;
            next.set(payload.data.student_id, { ...existing, ...payload.data });
            return next;
          });
        }
      });
    });

    // Chat events
    socket.on('student_chat_message', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      if (activeTab !== 'chat') {
        setChatUnread(n => n + 1);
      }
    });

    socket.on('chat_history', (data: { messages: ChatMessage[] }) => {
      setChatMessages(data.messages);
    });

    socket.on('SESSION_ENDED', () => { onSessionEnded(); });
    socket.on('SESSION_CANCELLED', () => { onSessionEnded(); });
  }

  function sendChatMessage() {
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.emit('chat_message', {
      session_id: sessionId,
      message: text
    });

    // Optimistic add
    setChatMessages(prev => [...prev, {
      message_id: `local_${Date.now()}`,
      sender_type: 'PROFESSOR',
      professor_name: professorName,
      message: text,
      created_at: new Date().toISOString()
    }]);
    setChatInput('');
  }

  async function handleOverrideSubmit() {
    if (!overrideModal || !overrideForm.reason) {
      alert('Please provide a reason');
      return;
    }

    const res = await fetch(
      `${API_URL}/sessions/${sessionId}/students/${overrideModal.student_id}/override`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(overrideForm)
      }
    );
    const data = await res.json();
    if (data.success) {
      setOverrideModal(null);
      setOverrideForm({ status: 'PRESENT', reason: '' });
    } else {
      alert(data.error || 'Override failed');
    }
  }

  async function handleEndSession() {
    if (!confirm('End the attendance session?')) return;
    await fetch(`${API_URL}/sessions/${sessionId}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    onSessionEnded();
  }

  async function handleCancelSession() {
    if (!confirm('CANCEL session? This will delete all attendance records for this class. No attendance will be recorded.')) return;
    await fetch(`${API_URL}/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    onSessionEnded();
  }

  const studentsArr = Array.from(students.values());
  const present = studentsArr.filter(s => s.status === 'PRESENT').length;
  const absent = studentsArr.filter(s => s.status === 'ABSENT').length;
  const suspicious = studentsArr.filter(s => s.verification_status === 'SUSPICIOUS').length;

  function getStatusColor(s: StudentCard) {
    if (s.status === 'PRESENT' && s.verification_status !== 'SUSPICIOUS') return '#22c55e';
    if (s.verification_status === 'SUSPICIOUS') return '#f59e0b';
    return '#ef4444';
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-700 text-white p-4 flex items-center justify-between shadow">
        <div>
          <div className="font-bold text-lg">
            {session?.course_name} {session?.section ? `— ${session.section}` : ''}
          </div>
          <div className="text-sm text-indigo-200">
            Session active • {session?.attendance_credits} credit(s) • Expires in {timeLeft}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            className="bg-yellow-500 hover:bg-yellow-400 text-white px-4 py-2 rounded-lg text-sm font-semibold"
            onClick={handleCancelSession}
          >
            ❌ Cancel Session
          </button>
          <button
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-semibold"
            onClick={handleEndSession}
          >
            ✅ End Session
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 p-3 bg-white border-b text-sm">
        <span className="text-green-600 font-semibold">✅ Present: {present}</span>
        <span className="text-red-500 font-semibold">❌ Absent: {absent}</span>
        <span className="text-amber-500 font-semibold">⚠️ Suspicious: {suspicious}</span>
        <span className="text-gray-500">Total: {studentsArr.length}</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white">
        <button
          className={`px-6 py-3 text-sm font-semibold ${activeTab === 'students' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('students')}
        >
          Students
        </button>
        <button
          className={`px-6 py-3 text-sm font-semibold relative ${activeTab === 'chat' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
          onClick={() => { setActiveTab('chat'); setChatUnread(0); }}
        >
          Chat
          {chatUnread > 0 && (
            <span className="absolute top-2 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {chatUnread}
            </span>
          )}
        </button>
      </div>

      {/* Students tab */}
      {activeTab === 'students' && (
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {studentsArr.map(s => (
            <div
              key={s.student_id}
              className="bg-white rounded-xl shadow p-3 border-l-4"
              style={{ borderLeftColor: getStatusColor(s) }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{s.roll_number}</div>
                </div>
                <div className="text-xs font-bold" style={{ color: getStatusColor(s) }}>
                  {s.status === 'PRESENT' ? '✅ Present' : '❌ Absent'}
                </div>
              </div>
              {s.face_score && (
                <div className="flex gap-2 mt-2 text-xs">
                  <span className="bg-gray-100 rounded px-1">F:{Math.round(s.face_score * 100)}%</span>
                  <span className="bg-gray-100 rounded px-1">L:{Math.round((s.liveness_score ?? 0) * 100)}%</span>
                  <span className="bg-gray-100 rounded px-1">S:{Math.round((s.scene_score ?? 0) * 100)}%</span>
                </div>
              )}
              {s.marked_by === 'PROFESSOR' && (
                <div className="text-xs text-indigo-600 mt-1">✋ Manual: {s.override_reason}</div>
              )}
              {s.verification_status === 'SUSPICIOUS' && (
                <div className="text-xs text-amber-600 mt-1">⚠️ Suspicious location</div>
              )}
              <button
                className="mt-2 w-full text-xs border border-indigo-200 text-indigo-600 rounded py-1 hover:bg-indigo-50"
                onClick={() => setOverrideModal(s)}
              >
                Override
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-400 py-8">
                No messages yet. Students will appear here if they have concerns.
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.sender_type === 'PROFESSOR' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-xs lg:max-w-md rounded-xl px-3 py-2 ${
                  msg.sender_type === 'PROFESSOR'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border shadow-sm'
                }`}>
                  {msg.sender_type === 'STUDENT' && (
                    <div className="text-xs font-bold text-indigo-600 mb-1">
                      {msg.student_name} ({msg.roll_number})
                    </div>
                  )}
                  <div className={`text-sm ${msg.sender_type === 'PROFESSOR' ? 'text-white' : 'text-gray-800'}`}>
                    {msg.message}
                  </div>
                  <div className={`text-xs mt-1 ${msg.sender_type === 'PROFESSOR' ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t bg-white p-3 flex gap-2">
            <input
              type="text"
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Reply to students..."
              onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
              maxLength={500}
            />
            <button
              className="bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50"
              onClick={sendChatMessage}
              disabled={!chatInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1">Override Attendance</h2>
            <p className="text-sm text-gray-500 mb-4">{overrideModal.name} ({overrideModal.roll_number})</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">New Status</label>
                <div className="flex gap-3 mt-1">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="PRESENT" checked={overrideForm.status === 'PRESENT'}
                      onChange={() => setOverrideForm({ ...overrideForm, status: 'PRESENT' })} />
                    <span className="text-green-600 font-semibold">Present</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="ABSENT" checked={overrideForm.status === 'ABSENT'}
                      onChange={() => setOverrideForm({ ...overrideForm, status: 'ABSENT' })} />
                    <span className="text-red-500 font-semibold">Absent</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Reason *</label>
                <textarea
                  className="w-full border rounded-lg p-2 text-sm mt-1"
                  rows={3}
                  value={overrideForm.reason}
                  onChange={e => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="e.g. Student physically verified / Student feedback from class..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button className="btn btn-primary flex-1" onClick={handleOverrideSubmit}>
                Apply Override
              </button>
              <button className="btn btn-secondary flex-1"
                onClick={() => { setOverrideModal(null); setOverrideForm({ status: 'PRESENT', reason: '' }); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}