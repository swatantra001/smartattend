import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { rateLimit } from 'express-rate-limit';

import { db } from './config/database';
import { redis } from './config/redis';
import { logger } from './config/logger';
import { initFirebase } from './config/firebase';

import authRoutes from './routes/auth.routes';
import sessionRoutes from './routes/session.routes';
import studentRoutes from './routes/student.routes';
import professorRoutes from './routes/professor.routes';

import locationRoutes from './routes/location.routes';
import attendanceRoutes from './routes/attendance.routes';
import adminRoutes from './routes/admin.routes';

// Add these 3 lines:
import courseRoutes from './routes/courseRoutes';
import assignmentRoutes from './routes/assignmentRoutes';
import './cron/assignmentCron'; // This starts the 6-hour deadline background checker

import { errorHandler } from './middleware/error.middleware';
import { deviceBindingMiddleware } from './middleware/device.middleware';
import { initSocketHandlers } from './sockets/socket.handler';
import { authenticate } from './middleware/auth.middleware';
import { startCronJobs } from './cron/assignmentCron';

const app = express();
const httpServer = createServer(app);

// ─── SOCKET.IO SETUP ──────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3001',
      'http://localhost:3000',
      'http://localhost:3002',
      'http://10.111.223.185:3001',
      '*'
    ],
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// ─── SECURITY MIDDLEWARE ──────────────────────────────────────────────────────
app.use(helmet());
// app.use(cors({
//   origin: process.env.ALLOWED_ORIGINS?.split(',') || [
//     'http://localhost:3001',
//     'http://localhost:3000',
//     'http://10.111.223.185:3001',
//     '*'
//   ],
//   credentials: true,
// }));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:3001',
  'http://localhost:3000',
  'http://localhost:3002',
  'http://10.111.223.185:3001',
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman / mobile apps

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
// Node.js Backend - index.ts
// Remove the old app.use(cors(...)) line entirely to avoid conflicts!
app.use(compression());
app.use(express.json({ limit: '10mb' })); // allow base64 frame uploads
app.use(express.urlencoded({ extended: true }));

// ─── GLOBAL RATE LIMITING ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: 'Too many auth attempts.' }
});

app.use(globalLimiter);

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sessions', deviceBindingMiddleware, sessionRoutes);
app.use('/api/students', deviceBindingMiddleware, studentRoutes);
app.use('/api/professors', authenticate, professorRoutes);
app.use('/api/location', deviceBindingMiddleware, locationRoutes);
app.use('/api/attendance', deviceBindingMiddleware, attendanceRoutes);
app.use('/api/admin', adminRoutes); // admin has its own auth middleware
// Add these 2 lines:
app.use('/api/courses', authenticate, courseRoutes);
app.use('/api/assignments', authenticate, assignmentRoutes);

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.json({ success: true, status: 'healthy', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ success: false, status: 'unhealthy' });
  }
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── SOCKET HANDLERS ─────────────────────────────────────────────────────────
initSocketHandlers(io);

// ─── STARTUP ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await db.connect();
    logger.info('✅ PostgreSQL connected');

    await redis.ping();
    logger.info('✅ Redis connected');

    initFirebase();
    logger.info('✅ Firebase initialized');

    const PORT = process.env.PORT || 4000;
    httpServer.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀 SmartAttend API running on port ${PORT}`);
      // 👈 Start the background jobs
      startCronJobs();
    });
  } catch (err) {
    logger.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();