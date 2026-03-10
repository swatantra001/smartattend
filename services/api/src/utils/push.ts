import * as admin from 'firebase-admin';
import axios from 'axios';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs';

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  if (admin.apps.length > 0) {
    firebaseApp = admin.apps[0]!;
    return firebaseApp;
  }

  const serviceAccountPath = path.join(__dirname, '../../firebase-service-account.json');

  if (!fs.existsSync(serviceAccountPath)) {
    logger.warn('firebase-service-account.json not found — push disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('✅ Firebase Admin initialized');
    return firebaseApp;
  } catch (err: any) {
    logger.error('Firebase Admin init failed:', err.message);
    return null;
  }
}

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Sends to both Expo tokens (ExponentPushToken[...]) and native FCM tokens
export async function sendPushNotifications(
  tokens: string[],
  payload: PushPayload
): Promise<void> {
  if (!tokens || tokens.length === 0) return;

  const expoTokens = tokens.filter(t => t?.startsWith('ExponentPushToken'));
  const fcmTokens = tokens.filter(t => t && !t.startsWith('ExponentPushToken'));

  // Send to Expo tokens via Expo Push Service (works with Expo Go)
  if (expoTokens.length > 0) {
    await sendViaExpoPush(expoTokens, payload);
  }

  // Send to native FCM tokens via Firebase Admin (production APK)
  if (fcmTokens.length > 0) {
    await sendViaFirebaseAdmin(fcmTokens, payload);
  }
}

async function sendViaExpoPush(tokens: string[], payload: PushPayload): Promise<void> {
  const messages = tokens.map(token => ({
    to: token,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    sound: 'default',
    priority: 'high',
    channelId: 'attendance',
  }));

  try {
    const response = await axios.post(
      'https://exp.host/--/api/v2/push/send',
      messages,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      }
    );
    logger.info(`✅ Expo push sent to ${tokens.length} devices`);
    // Log any errors
    const results = response.data.data || [];
    results.forEach((result: any, i: number) => {
      if (result.status === 'error') {
        logger.warn(`Expo push failed for token ${tokens[i]}: ${result.message}`);
      }
    });
  } catch (err: any) {
    logger.error('Expo push service failed:', err.message);
  }
}

async function sendViaFirebaseAdmin(tokens: string[], payload: PushPayload): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const response = await admin.messaging(app).sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'attendance' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    logger.info(`✅ FCM sent: ${response.successCount} success, ${response.failureCount} failed`);
  } catch (err: any) {
    logger.error('Firebase Admin send failed:', err.message);
  }
}