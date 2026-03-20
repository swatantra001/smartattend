export interface User {
  user_id: string;
  email: string;
  role: 'STUDENT' | 'PROFESSOR' | 'ADMIN';
  college_id: string;
  // student profile fields
  student_id?: string;
  name?: string;
  roll_number?: string;
  semester?: number;
  dept_id?: string;
  face_enrolled_at?: string | null;
  face_photo_url?: string | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

export interface NearbySession {
  session_id: string;
  course_id: string;
  course_name: string;
  code: string;
  professor_name: string;
  challenges: string[];
  expires_at: string;
  attendance_credits: number;
  class_duration_minutes: number;
  radius_meters: number;
  distance_meters: number;
  my_status: 'PRESENT' | 'ABSENT' | null;
  my_verification: string | null;
  attempt_count: number;
}

export interface AttendanceRecord {
  record_id: string;
  status: 'PRESENT' | 'ABSENT';
  verification_status: string;
  face_score?: number;
  liveness_score?: number;
  scene_score?: number;
  marked_by: 'SYSTEM' | 'PROFESSOR';
  verification_timestamp?: string;
  override_reason?: string;
  started_at: string;
  course_name: string;
  course_code: string;
  professor_name: string;
}

export interface CourseAttendance {
  course_id: string;
  course_name: string;
  course_code: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
}

export interface Course {
  course_id: string;
  name: string;
  code: string;
  section?: string;
  semester?: number;
  dept_name?: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  deadline: string;
  professor_files?: string[];
  has_submitted?: boolean;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_files: string[];
  submitted_at: string;
  is_flagged?: boolean;
  flag_reason?: string;
  ai_score?: number;
}

export interface EnrollmentStatus {
  enrolled: boolean;
  face_enrolled_at?: string;
  face_photo_url?: string;
}

export interface DeviceResetRequest {
  request_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
  admin_note?: string;
  created_at: string;
  resolved_at?: string;
}

export interface CalendarDay {
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'NO_SESSION';
  session_id?: string;
  course_name?: string;
}