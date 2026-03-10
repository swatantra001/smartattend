// import admin from 'firebase-admin';
// import { logger } from './logger';

// let initialized = false;

// export function initFirebase(): void {
//   if (initialized) return;

//   const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
//   if (!serviceAccount) {
//     logger.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
//     return;
//   }

//   admin.initializeApp({
//     credential: admin.credential.cert(JSON.parse(serviceAccount))
//   });

//   initialized = true;
//   logger.info('✅ Firebase Admin initialized');
// }

// export async function sendPushNotification(
//   fcmToken: string,
//   title: string,
//   body: string,
//   data: Record<string, string>
// ): Promise<boolean> {
//   if (!initialized) {
//     logger.warn('Firebase not initialized — skipping push notification');
//     return false;
//   }

//   try {
//     await admin.messaging().send({
//       token: fcmToken,
//       notification: { title, body },
//       data,
//       android: {
//         priority: 'high',
//         notification: { channelId: 'attendance', priority: 'max', defaultSound: true }
//       },
//       apns: {
//         payload: {
//           aps: { alert: { title, body }, sound: 'default', badge: 1, contentAvailable: true }
//         },
//         headers: { 'apns-priority': '10' }
//       }
//     });
//     return true;
//   } catch (err: any) {
//     logger.error('FCM send error:', err.message);
//     return false;
//   }
// }

// export async function sendMulticastPush(
//   fcmTokens: string[],
//   title: string,
//   body: string,
//   data: Record<string, string>
// ): Promise<{ successCount: number; failureCount: number }> {
//   if (!initialized || fcmTokens.length === 0) {
//     return { successCount: 0, failureCount: fcmTokens.length };
//   }

//   // FCM multicast max 500 tokens per batch
//   const batches: string[][] = [];
//   for (let i = 0; i < fcmTokens.length; i += 500) {
//     batches.push(fcmTokens.slice(i, i + 500));
//   }

//   let successCount = 0;
//   let failureCount = 0;

//   for (const batch of batches) {
//     try {
//       const response = await admin.messaging().sendEachForMulticast({
//         tokens: batch,
//         notification: { title, body },
//         data,
//         android: { priority: 'high' },
//         apns: { payload: { aps: { contentAvailable: true, sound: 'default' } } }
//       });
//       successCount += response.successCount;
//       failureCount += response.failureCount;
//     } catch (err) {
//       logger.error('Multicast batch error:', err);
//       failureCount += batch.length;
//     }
//   }

//   return { successCount, failureCount };
// }









import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

let app: admin.app.App | null = null;

export function initFirebase(): admin.app.App | null {
  if (app) return app;
  if (admin.apps.length > 0) {
    app = admin.apps[0]!;
    return app;
  }

  const serviceAccountPath = path.join(__dirname, '../../smartattend-7803f-7e839dfe49db.json');

  if (!fs.existsSync(serviceAccountPath)) {
    logger.warn('⚠️  firebase-service-account.json not found — push notifications disabled');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info('✅ Firebase Admin SDK initialized');
    return app;
  } catch (err: any) {
    logger.error('Firebase Admin init failed:', err.message);
    return null;
  }
}

export async function sendMulticastPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<{ successCount: number; failureCount: number }> {

  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Split into Expo tokens and native FCM tokens
  const expoTokens = validTokens.filter(t => t.startsWith('ExponentPushToken'));
  const fcmTokens = validTokens.filter(t => !t.startsWith('ExponentPushToken'));

  let successCount = 0;
  let failureCount = 0;

  // ── Send via Expo Push Service (works with Expo Go) ──
  if (expoTokens.length > 0) {
    try {
      const { default: axios } = await import('axios');
      const messages = expoTokens.map(token => ({
        to: token,
        title,
        body,
        data,
        sound: 'default',
        priority: 'high',
        channelId: 'attendance',
      }));

      const response = await axios.post(
        'https://exp.host/--/api/v2/push/send',
        messages,
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
      );

      const results: any[] = response.data.data || [];
      results.forEach(r => {
        if (r.status === 'ok') successCount++;
        else {
          failureCount++;
          logger.warn(`Expo push error: ${r.message}`);
        }
      });

      logger.info(`Expo push: ${successCount} success, ${failureCount} failed`);
    } catch (err: any) {
      logger.error('Expo push service error:', err.message);
      failureCount += expoTokens.length;
    }
  }

  // ── Send via Firebase Admin (production APK) ──
  if (fcmTokens.length > 0) {
    const firebaseApp = initFirebase();
    if (firebaseApp) {
      try {
        const result = await admin.messaging(firebaseApp).sendEachForMulticast({
          tokens: fcmTokens,
          notification: { title, body },
          data,
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: 'attendance' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        });
        successCount += result.successCount;
        failureCount += result.failureCount;
        logger.info(`FCM: ${result.successCount} success, ${result.failureCount} failed`);
      } catch (err: any) {
        logger.error('Firebase Admin send error:', err.message);
        failureCount += fcmTokens.length;
      }
    }
  }

  return { successCount, failureCount };
}