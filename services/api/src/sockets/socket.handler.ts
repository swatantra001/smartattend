// import { Server as SocketIOServer, Socket } from 'socket.io';
// import jwt from 'jsonwebtoken';
// import { env } from '../config/env';
// import { logger } from '../config/logger';
// import { redis } from '../config/redis';

// export function initSocketHandlers(io: SocketIOServer): void {
//   // JWT auth for socket connections
//   io.use((socket, next) => {
//     const token = socket.handshake.auth?.token;
//     if (!token) return next(new Error('No token'));

//     try {
//       const payload = jwt.verify(token, env.JWT_SECRET) as any;
//       socket.data.user = payload;
//       next();
//     } catch {
//       next(new Error('Invalid token'));
//     }
//   });

//   io.on('connection', (socket: Socket) => {
//     const user = socket.data.user;
//     logger.info(`Socket connected: ${user.user_id} (${user.role})`);

//     // Professor joins their session room
//     socket.on('join_session', async (sessionId: string) => {
//       if (user.role !== 'PROFESSOR' && user.role !== 'ADMIN') {
//         socket.emit('error', { message: 'Unauthorized' });
//         return;
//       }
//       socket.join(`session:${sessionId}`);
//       logger.info(`Professor ${user.user_id} joined session room: ${sessionId}`);
//       socket.emit('joined', { session_id: sessionId });
//     });

//     socket.on('leave_session', (sessionId: string) => {
//       socket.leave(`session:${sessionId}`);
//     });

//     socket.on('disconnect', () => {
//       logger.info(`Socket disconnected: ${user.user_id}`);
//     });
//   });
// }

// // Called from controllers to emit events to professor dashboard
// export function emitToSession(
//   io: SocketIOServer,
//   sessionId: string,
//   event: string,
//   data: any
// ): void {
//   io.to(`session:${sessionId}`).emit(event, data);
// }














// D:\smartattend\services\api\src\sockets\socket.handler.ts
// FULL REPLACEMENT
//
// Events the professor dashboard [sessionId].tsx listens for:
//   'student_chat_message'  — a student sent a message
//   'chat_history'          — history replay response
//   'professor_reply_sent'  — echo of professor's own sent message (optimistic confirm)
//
// Events the student SessionChat listens for:
//   'professor_chat_message' — professor sent a message to all students
//   'chat_message_sent'      — echo of student's own message
//   'joined'                 — confirms room join
//
// Events emitted by clients:
//   'join_session'      — both roles
//   'leave_session'     — both roles
//   'chat_message'      — both roles (server routes by role)
//   'get_chat_history'  — professor only

import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { db } from '../config/database';

export function initSocketHandlers(io: SocketIOServer): void {

  // ── JWT auth ────────────────────────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as any;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    logger.info(`Socket connected: ${user.user_id} (${user.role})`);

    // Each user always joins their own personal room (for future private notifications)
    socket.join(`user:${user.user_id}`);

    // ── join_session ──────────────────────────────────────────────────────────
    socket.on('join_session', async (sessionId: string) => {
      try {
        const session = await db.queryOne<{ session_id: string; status: string }>(
          `SELECT session_id, status FROM attendance_sessions WHERE session_id = $1`,
          [sessionId]
        );
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }
        socket.join(`session:${sessionId}`);
        logger.info(`${user.role} ${user.user_id} joined session:${sessionId}`);
        socket.emit('joined', { session_id: sessionId });
      } catch (err) {
        logger.error('join_session error', { err });
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    socket.on('leave_session', (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });

    // ── chat_message ──────────────────────────────────────────────────────────
    // Single event for both roles; server routes by role.
    socket.on('chat_message', async (data: { session_id: string; message: string }) => {
      try {
        if (!data.session_id || !data.message?.trim()) return;
        const message = data.message.trim().slice(0, 500);

        // ── STUDENT sends message → professor ──────────────────────────────
        if (user.role === 'STUDENT') {
          const student = await db.queryOne<any>(
            `SELECT s.student_id, s.name, s.roll_number
               FROM students s WHERE s.user_id = $1`,
            [user.user_id]
          );
          if (!student) {
            socket.emit('chat_error', { message: 'Student not found' });
            return;
          }

          // Verify student has an attendance record in this session
          const inSession = await db.queryOne(
            `SELECT record_id FROM attendance_records
             WHERE session_id = $1 AND student_id = $2`,
            [data.session_id, student.student_id]
          );
          if (!inSession) {
            socket.emit('chat_error', { message: 'You are not part of this session' });
            return;
          }

          // Persist
          const saved = await db.queryOne<any>(
            `INSERT INTO session_chat_messages
               (session_id, sender_type, student_id, message)
             VALUES ($1, 'STUDENT', $2, $3)
             RETURNING message_id, created_at`,
            [data.session_id, student.student_id, message]
          );

          const payload = {
            message_id: saved!.message_id,
            session_id: data.session_id,
            sender_type: 'STUDENT' as const,
            student_id: student.student_id,
            student_name: student.name,
            roll_number: student.roll_number,
            message,
            created_at: saved!.created_at,
          };

          // Echo back to student with is_mine flag
          socket.emit('chat_message_sent', payload);

          // Send to professor (everyone else in session room)
          // Professor dashboard listens for 'student_chat_message'
          socket.to(`session:${data.session_id}`).emit('student_chat_message', payload);

          logger.info(`Chat STUDENT ${student.roll_number} → session ${data.session_id}`);
        }

        // ── PROFESSOR sends message → all students ─────────────────────────
        else if (user.role === 'PROFESSOR') {
          const professor = await db.queryOne<any>(
            `SELECT p.professor_id, p.name
               FROM professors p WHERE p.user_id = $1`,
            [user.user_id]
          );
          if (!professor) {
            socket.emit('chat_error', { message: 'Professor not found' });
            return;
          }

          // Verify professor owns this session
          const session = await db.queryOne(
            `SELECT session_id FROM attendance_sessions
             WHERE session_id = $1 AND professor_id = $2`,
            [data.session_id, professor.professor_id]
          );
          if (!session) {
            socket.emit('chat_error', { message: 'Not your session' });
            return;
          }

          // Persist
          const saved = await db.queryOne<any>(
            `INSERT INTO session_chat_messages
               (session_id, sender_type, professor_id, message)
             VALUES ($1, 'PROFESSOR', $2, $3)
             RETURNING message_id, created_at`,
            [data.session_id, professor.professor_id, message]
          );

          const payload = {
            message_id: saved!.message_id,
            session_id: data.session_id,
            sender_type: 'PROFESSOR' as const,
            professor_name: professor.name,
            message,
            created_at: saved!.created_at,
          };

          // Send to ALL students in the session room
          // Student SessionChat listens for 'professor_chat_message'
          io.to(`session:${data.session_id}`).emit('professor_chat_message', payload);

          // The above io.to() includes the professor themselves.
          // The dashboard uses the optimistic message + this as a confirm.
          // We also emit 'professor_reply_sent' for the professor's own panel.
          socket.emit('professor_reply_sent', payload);

          logger.info(`Chat PROFESSOR ${professor.name} → session ${data.session_id}`);
        }

      } catch (err) {
        logger.error('chat_message error', { err });
        socket.emit('chat_error', { message: 'Failed to send message' });
      }
    });

    // ── get_chat_history (professor only) ─────────────────────────────────────
    socket.on('get_chat_history', async (data: { session_id: string }) => {
      if (user.role !== 'PROFESSOR') return;

      try {
        const { rows } = await db.query(
          `SELECT
             m.message_id,
             m.session_id,
             m.sender_type,
             m.message,
             m.created_at,
             -- Student fields (null for professor messages)
             s.student_id,
             s.name   AS student_name,
             s.roll_number,
             -- Professor fields (null for student messages)
             p.name   AS professor_name
           FROM session_chat_messages m
           LEFT JOIN students   s ON s.student_id   = m.student_id
           LEFT JOIN professors p ON p.professor_id = m.professor_id
           WHERE m.session_id = $1
           ORDER BY m.created_at ASC
           LIMIT 100`,
          [data.session_id]
        );

        socket.emit('chat_history', { session_id: data.session_id, messages: rows });
      } catch (err) {
        logger.error('get_chat_history error', { err });
      }
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${user.user_id}`);
    });
  });
}

// ─── Helpers (called from HTTP controllers) ───────────────────────────────────
export function emitToSession(
  io: SocketIOServer,
  sessionId: string,
  event: string,
  data: any
): void {
  io.to(`session:${sessionId}`).emit(event, data);
}

export function emitToUser(
  io: SocketIOServer,
  userId: string,
  event: string,
  data: any
): void {
  io.to(`user:${userId}`).emit(event, data);
}