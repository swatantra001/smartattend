import cron from 'node-cron';
import { db } from '../config/database';
import { sendPushNotifications } from '../utils/push';
import { logger } from '../config/logger';

cron.schedule('*/5 * * * *', async () => {
  const end = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const start = new Date(Date.now() + 5.9 * 60 * 60 * 1000);
  
  const pending = await db.query(`
    SELECT a.title, db.fcm_token 
    FROM assignments a
    JOIN course_enrollments ce ON a.course_id = ce.course_id
    JOIN students s ON ce.student_id = s.student_id
    JOIN device_bindings db ON s.user_id = db.user_id
    LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id AND sub.student_id = s.student_id
    WHERE sub.id IS NULL 
      AND a.deadline >= $1 
      AND a.deadline <= $2 
      AND db.fcm_token IS NOT NULL
      AND db.is_active = true
  `, [start, end]);

  const tokens = pending.rows.map(r => r.fcm_token);
  if (tokens.length > 0) {
    await sendPushNotifications(tokens, { title: 'Deadline Approaching! ⏰', body: `6 hours left for an assignment!` });
  }
});





export function startCronJobs() {
  // This cron expression means: "Run at 02:00 AM every single day"
  cron.schedule('0 2 * * *', async () => {
    logger.info('🧹 [CRON] Starting nightly attendance image cleanup...');
    
    try {
      // Wipe the heavy Base64 strings from records older than 2 days
      const result = await db.query(`
        UPDATE attendance_records 
        SET captured_image_b64 = NULL 
        WHERE verification_timestamp < NOW() - INTERVAL '1 days'
          AND captured_image_b64 IS NOT NULL;
      `);
      
      logger.info(`✨ [CRON] Cleanup complete: Freed up space from ${(result as any).rowCount} old records.`);
    } catch (error) {
      logger.error('❌ [CRON] Failed to run image cleanup job:', error);
    }
  });
}