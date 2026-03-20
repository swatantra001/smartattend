import { io, Socket } from 'socket.io-client';
import { WS_URL } from '../constants';

let _socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (_socket?.connected) return _socket;

  _socket = io(WS_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => console.log('[Socket] Connected:', _socket?.id));
  _socket.on('connect_error', (err) => console.warn('[Socket] Error:', err.message));
  _socket.on('disconnect', (reason) => console.log('[Socket] Disconnected:', reason));

  return _socket;
}

export function joinSession(sessionId: string) {
  _socket?.emit('join_session', sessionId);
}

export function leaveSession(sessionId: string) {
  _socket?.emit('leave_session', sessionId);
}

export function onAttendanceStatusChanged(cb: (data: any) => void) {
  _socket?.on('ATTENDANCE_STATUS_CHANGED', cb);
  return () => _socket?.off('ATTENDANCE_STATUS_CHANGED', cb);
}

export function onManualOverride(cb: (data: any) => void) {
  _socket?.on('STUDENT_MANUAL_OVERRIDE', cb);
  return () => _socket?.off('STUDENT_MANUAL_OVERRIDE', cb);
}

export function onSessionEnded(cb: (data: any) => void) {
  const events = ['SESSION_ENDED', 'SESSION_EXPIRED', 'SESSION_CANCELLED'];
  events.forEach(e => _socket?.on(e, cb));
  return () => events.forEach(e => _socket?.off(e, cb));
}

export function getSocket(): Socket | null {
  return _socket?.connected ? _socket : null;
}

export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}