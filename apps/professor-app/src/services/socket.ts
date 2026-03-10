import { io, Socket } from 'socket.io-client';
// import { WS_URL } from '../constants';
import { WSEvent } from '../types/shared';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'http://10.201.59.185:4000';

// ─── ChatMessage type (used by [sessionId].tsx) ───────────────────────────────
export interface ChatMessage {
  message_id: string;
  session_id: string;
  sender_type: 'STUDENT' | 'PROFESSOR';
  // Student sender fields
  student_id?: string;
  student_name?: string;
  roll_number?: string;
  // Professor sender fields
  professor_name?: string;
  message: string;
  created_at: string;
}

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
  });

  return socket;
}

export function joinSession(sessionId: string): void {
  socket?.emit('join_session', sessionId);
}

export function leaveSession(sessionId: string): void {
  socket?.emit('leave_session', sessionId);
}

export function onSessionEvent(
  callback: (event: WSEvent) => void
): () => void {
  const events = [
    'STUDENT_VERIFIED',
    'STUDENT_FAILED',
    'STUDENT_SUSPICIOUS',
    'STUDENT_MANUAL_OVERRIDE',
    'SESSION_ENDED',
    'SESSION_EXPIRED',
	'SESSION_CANCELLED',
	'STUDENT_SCENE_FAILED' // TODO: update the attendance card in real-time when this happens
  ];

  events.forEach((evt) => socket?.on(evt, callback));

  return () => {
    events.forEach((evt) => socket?.off(evt, callback));
  };
}


// ── Chat: professor sends a message to all students in session ─────────────────
// Uses a single 'chat_message' event; server distinguishes by role.
export function sendChatMessage(sessionId: string, message: string): void {
  socket?.emit('chat_message', { session_id: sessionId, message });
}

// ── Chat: ask server to replay the last 100 messages ──────────────────────────
export function requestChatHistory(sessionId: string): void {
  socket?.emit('get_chat_history', { session_id: sessionId });
}

// ── Chat: listen for incoming student messages ─────────────────────────────────
export function onStudentChatMessage(
  callback: (msg: ChatMessage) => void
): () => void {
  socket?.on('student_chat_message', callback);
  return () => socket?.off('student_chat_message', callback);
}

// ── Chat: receive history replay ──────────────────────────────────────────────
export function onChatHistory(
  callback: (data: { session_id: string; messages: ChatMessage[] }) => void
): () => void {
  socket?.on('chat_history', callback);
  return () => socket?.off('chat_history', callback);
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function getSocket(): Socket | null {
  return socket?.connected ? socket : null;
}


export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
