"use strict";
// // ─── USER ROLES ───────────────────────────────────────────────
// export type UserRole = 'STUDENT' | 'PROFESSOR' | 'ADMIN';
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceResetStatus = exports.LivenessChallenge = exports.VerificationStatus = exports.AttendanceStatus = exports.UserRole = void 0;
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
var UserRole;
(function (UserRole) {
    UserRole["STUDENT"] = "STUDENT";
    UserRole["PROFESSOR"] = "PROFESSOR";
    UserRole["ADMIN"] = "ADMIN";
})(UserRole || (exports.UserRole = UserRole = {}));
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["ABSENT"] = "ABSENT";
    AttendanceStatus["MANUAL_OVERRIDE"] = "MANUAL_OVERRIDE";
})(AttendanceStatus || (exports.AttendanceStatus = AttendanceStatus = {}));
var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["PENDING"] = "PENDING";
    VerificationStatus["FACE_PASSED"] = "FACE_PASSED";
    VerificationStatus["VERIFIED"] = "VERIFIED";
    VerificationStatus["FAILED"] = "FAILED";
    VerificationStatus["SUSPICIOUS"] = "SUSPICIOUS";
})(VerificationStatus || (exports.VerificationStatus = VerificationStatus = {}));
var LivenessChallenge;
(function (LivenessChallenge) {
    LivenessChallenge["BLINK_TWICE"] = "BLINK_TWICE";
    LivenessChallenge["TURN_HEAD_RIGHT"] = "TURN_HEAD_RIGHT";
    LivenessChallenge["TURN_HEAD_LEFT"] = "TURN_HEAD_LEFT";
    LivenessChallenge["SMILE"] = "SMILE";
    LivenessChallenge["NOD"] = "NOD";
    LivenessChallenge["OPEN_MOUTH"] = "OPEN_MOUTH";
})(LivenessChallenge || (exports.LivenessChallenge = LivenessChallenge = {}));
var DeviceResetStatus;
(function (DeviceResetStatus) {
    DeviceResetStatus["PENDING"] = "PENDING";
    DeviceResetStatus["APPROVED"] = "APPROVED";
    DeviceResetStatus["REJECTED"] = "REJECTED";
})(DeviceResetStatus || (exports.DeviceResetStatus = DeviceResetStatus = {}));
//# sourceMappingURL=index.js.map