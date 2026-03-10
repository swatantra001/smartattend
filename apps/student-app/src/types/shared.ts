// // ─── USER ROLES ───────────────────────────────────────────────
// export type UserRole = 'STUDENT' | 'PROFESSOR' | 'ADMIN';

// // ─── ATTENDANCE STATUS ────────────────────────────────────────
// export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'MANUAL_OVERRIDE';
// export type MarkedBy = 'SYSTEM' | 'PROFESSOR';
// export type SessionStatus = 'ACTIVE' | 'ENDED' | 'EXPIRED';

// // ─── VERIFICATION STATUS ──────────────────────────────────────
// export type VerificationStatus = 'PENDING' | 'FACE_PASSED' | 'FAILED' | 'VERIFIED' | 'SUSPICIOUS';

// // ─── DEVICE RESET ─────────────────────────────────────────────
// export type DeviceResetStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// // ─── LIVENESS CHALLENGES ──────────────────────────────────────
// export type LivenessChallenge =
//   | 'BLINK_TWICE'
//   | 'TURN_HEAD_RIGHT'
//   | 'TURN_HEAD_LEFT'
//   | 'SMILE'
//   | 'NOD'
//   | 'OPEN_MOUTH';

// // ─── API RESPONSE WRAPPER ─────────────────────────────────────
// export interface ApiResponse<T> {
//   success: boolean;
//   data?: T;
//   error?: string;
//   message?: string;
// }

// // ─── USER ─────────────────────────────────────────────────────
// export interface User {
//   user_id: string;
//   role: UserRole;
//   email: string;
//   is_active: boolean;
//   created_at: string;
// }

// export interface Student {
//   student_id: string;
//   user_id: string;
//   roll_number: string;
//   name: string;
//   dept_id: string;
//   semester: number;
//   face_enrolled: boolean;
//   face_enrolled_at?: string;
// }

// export interface Professor {
//   professor_id: string;
//   user_id: string;
//   name: string;
//   dept_id: string;
// }

// // ─── SESSION ──────────────────────────────────────────────────
// export interface AttendanceSession {
//   session_id: string;
//   professor_id: string;
//   course_id: string;
//   started_at: string;
//   ended_at?: string;
//   professor_lat: number;
//   professor_lng: number;
//   radius_meters: number;
//   status: SessionStatus;
//   expires_at: string;
// }

// // ─── ATTENDANCE RECORD ────────────────────────────────────────
// export interface AttendanceRecord {
//   record_id: string;
//   session_id: string;
//   student_id: string;
//   status: AttendanceStatus;
//   verification_status: VerificationStatus;
//   face_score?: number;
//   liveness_score?: number;
//   scene_score?: number;
//   marked_by: MarkedBy;
//   verification_timestamp?: string;
// }

// // ─── DASHBOARD STUDENT CARD ───────────────────────────────────
// export interface DashboardStudentCard {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   photo_url?: string;
//   status: AttendanceStatus;
//   verification_status: VerificationStatus;
//   face_score?: number;
//   liveness_score?: number;
//   scene_score?: number;
//   marked_by: MarkedBy;
// }

// // ─── NOTIFICATION PAYLOAD ─────────────────────────────────────
// export interface AttendanceNotificationPayload {
//   session_id: string;
//   professor_name: string;
//   course_name: string;
//   expires_at: string;
//   challenges: LivenessChallenge[];
// }

// // ─── WEBSOCKET EVENTS ─────────────────────────────────────────
// export type WSEventType =
//   | 'STUDENT_VERIFIED'
//   | 'STUDENT_FAILED'
//   | 'STUDENT_SUSPICIOUS'
//   | 'STUDENT_MANUAL_OVERRIDE'
//   | 'SESSION_ENDED'
//   | 'SESSION_EXPIRED';

// export interface WSEvent {
//   type: WSEventType;
//   session_id: string;
//   student_id: string;
//   data: Partial<DashboardStudentCard>;
// }

// // ─── DEVICE BINDING ───────────────────────────────────────────
// export interface DeviceBinding {
//   binding_id: string;
//   user_id: string;
//   device_id: string;
//   device_model?: string;
//   bound_at: string;
//   is_active: boolean;
// }

// export interface DeviceResetRequest {
//   request_id: string;
//   user_id: string;
//   student_name: string;
//   roll_number: string;
//   old_device_id?: string;
//   new_device_id: string;
//   reason: string;
//   status: DeviceResetStatus;
//   created_at: string;
//   resolved_at?: string;
// }












// packages/shared/src/index.ts

export enum UserRole {
  STUDENT = 'STUDENT',
  PROFESSOR = 'PROFESSOR',
  ADMIN = 'ADMIN',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  FACE_PASSED = 'FACE_PASSED',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  SUSPICIOUS = 'SUSPICIOUS',
}

export enum LivenessChallenge {
  BLINK_TWICE = 'BLINK_TWICE',
  TURN_HEAD_RIGHT = 'TURN_HEAD_RIGHT',
  TURN_HEAD_LEFT = 'TURN_HEAD_LEFT',
  SMILE = 'SMILE',
  NOD = 'NOD',
  OPEN_MOUTH = 'OPEN_MOUTH',
}

export enum DeviceResetStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface User {
  user_id: string;
  email: string;
  role: UserRole;
  college_id: string;
  is_active: boolean;
  created_at: string;
}

export interface Student {
  student_id: string;
  user_id: string;
  name: string;
  roll_number: string;
  dept_id: string;
  semester: number;
  face_embedding?: number[];
  face_enrolled_at?: string;
  face_photo_url?: string;
}

export interface Professor {
  professor_id: string;
  user_id: string;
  name: string;
  employee_code: string;
  dept_id: string;
}

export interface AttendanceSession {
  session_id: string;
  professor_id: string;
  course_id: string;
  radius_meters: number;
  status: 'ACTIVE' | 'ENDED' | 'EXPIRED';
  challenges: string[];
  started_at: string;
  ended_at?: string;
  expires_at: string;
}

export interface AttendanceRecord {
  record_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  verification_status: VerificationStatus;
  face_score?: number;
  liveness_score?: number;
  scene_score?: number;
  marked_by: 'SYSTEM' | 'PROFESSOR';
  verification_timestamp?: string;
}

export interface DashboardStudentCard {
  student_id: string;
  name: string;
  roll_number: string;
  status: AttendanceStatus;
  verification_status: VerificationStatus;
  face_score?: number;
  liveness_score?: number;
  scene_score?: number;
  marked_by?: 'SYSTEM' | 'PROFESSOR';
}

export interface AttendanceNotificationPayload {
  type: 'ATTENDANCE_REQUEST';
  session_id: string;
  course_name: string;
  professor_name: string;
  expires_at: string;
  challenges: string[];
}

export interface WSEvent {
  type:
    | 'STUDENT_VERIFIED'
    | 'STUDENT_FAILED'
    | 'STUDENT_SUSPICIOUS'
    | 'STUDENT_MANUAL_OVERRIDE'
    | 'SESSION_ENDED'
    | 'SESSION_EXPIRED';
  student_id?: string;
  session_id: string;
  data?: Partial<DashboardStudentCard>;
  timestamp: string;
}

export interface DeviceBinding {
  binding_id: string;
  user_id: string;
  device_id: string;
  device_model?: string;
  platform?: string;
  fcm_token?: string;
  is_active: boolean;
  last_seen_at: string;
}

export interface DeviceResetRequest {
  request_id: string;
  user_id: string;
  old_device_id?: string;
  new_device_id: string;
  reason: string;
  proof_url?: string;
  status: DeviceResetStatus;
  admin_id?: string;
  admin_note?: string;
  resolved_at?: string;
  created_at: string;
}