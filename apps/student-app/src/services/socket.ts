//
// BUG FIX: was using EXPO_PUBLIC_API_URL which ends in /api — Socket.IO treats
// that as a namespace → "Invalid namespace" error.
// Must use the bare root URL (no path). Use EXPO_PUBLIC_WS_URL (same as professor app)
// or strip /api from the API URL.

import { io, Socket } from 'socket.io-client';
  // reuse the same base URL your axios instance uses

let _socket: Socket | null = null;

/**
 * Connect (or return existing) socket for a given session.
 * Authenticates via the student's JWT access token.
 */
export function connectSocket(accessToken: string): Socket {
  if (_socket && _socket.connected) return _socket;

  const API_BASE_URL = process.env.EXPO_PUBLIC_WS_URL  || 'http://51.20.16.157:4000';

  _socket = io(API_BASE_URL, {
    transports: ['websocket', 'polling'],
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.log('[Socket] Connected:', _socket?.id);
  });

  _socket.on('connect_error', (err) => {
    console.warn('[Socket] Connect error:', err.message);
  });

  _socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return _socket;
}

export function joinSession(sessionId: string): void {
  _socket?.emit('join_session', sessionId);
}

export function leaveSession(sessionId: string): void {
  _socket?.emit('leave_session', sessionId);
}


//TODO: socket.on('ATTENDANCE_STATUS_CHANGED', callback) to update the attendance card in real-time when professor manually overrides or when scene check fails
//TODO:  get a FCM notification working for this too so the student knows to re-verify

/** Return the existing socket (null if not yet connected). */
export function getSocket(): Socket | null {
  return _socket && _socket.connected ? _socket : null;
}

/** Tear down the socket — call when session ends / student navigates away. */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}