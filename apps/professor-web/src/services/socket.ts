import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../constants';
import type { ChatMessage } from '../types';

let socket: Socket | null = null;

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket;
  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500,
  });
  socket.on('connect', () => console.log('✅ Socket connected'));
  socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function joinSession(sessionId: string) {
  socket?.emit('join_session', sessionId);
}

export function leaveSession(sessionId: string) {
  socket?.emit('leave_session', sessionId);
}

export function onSessionEvent(callback: (event: any) => void): () => void {
  const events = [
    'STUDENT_VERIFIED', 'STUDENT_FAILED', 'STUDENT_SUSPICIOUS',
    'STUDENT_MANUAL_OVERRIDE', 'SESSION_ENDED', 'SESSION_EXPIRED',
    'SESSION_CANCELLED', 'STUDENT_SCENE_FAILED',
  ];
  events.forEach((evt) => socket?.on(evt, callback));
  return () => events.forEach((evt) => socket?.off(evt, callback));
}

export function sendChatMessage(sessionId: string, message: string) {
  socket?.emit('chat_message', { session_id: sessionId, message });
}

export function requestChatHistory(sessionId: string) {
  socket?.emit('get_chat_history', { session_id: sessionId });
}

export function onStudentChatMessage(callback: (msg: ChatMessage) => void): () => void {
  socket?.on('student_chat_message', callback);
  return () => socket?.off('student_chat_message', callback);
}

export function onChatHistory(
  callback: (data: { session_id: string; messages: ChatMessage[] }) => void
): () => void {
  socket?.on('chat_history', callback);
  return () => socket?.off('chat_history', callback);
}

export function getSocket(): Socket | null {
  return socket?.connected ? socket : null;
}