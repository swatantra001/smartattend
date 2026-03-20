// export interface User {
//   user_id: string;
//   email: string;
//   role: string;
//   college_id: string;
//   professor_id: string;
//   name: string;
//   employee_code: string;
// }

// export interface Course {
//   course_id: string;
//   name: string;
//   code: string;
//   section: string | null;
//   semester: number;
//   dept_name: string;
//   student_count?: number;
//   is_mine?: boolean;
//   my_student_count?: number;
//   total_student_count?: number;
// }

// export interface ActiveSession {
//   session_id: string;
//   course_id: string;
//   course_name: string;
//   course_code?: string;
//   section?: string;
//   started_at: string;
//   expires_at: string;
//   students_notified: number;
//   challenges: string[];
//   attendance_credits?: number;
//   status?: string;
//   radius_meters?: number;
//   class_duration_minutes?: number;
// }

// export interface StudentCard {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   face_photo_url?: string;
//   face_score?: number;
//   liveness_score?: number;
//   scene_score?: number;
//   status: 'PRESENT' | 'ABSENT';
//   verification_status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'SUSPICIOUS';
//   marked_by?: string;
//   override_reason?: string;
//   notified?: boolean;
//   verification_timestamp?: string;
// }

// export interface SessionSummary {
//   session_id: string;
//   course_id: string;
//   course_name: string;
//   course_code: string;
//   section: string;
//   status: 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'CANCELLED';
//   started_at: string;
//   ended_at: string | null;
//   expires_at: string;
//   present_count: number;
//   absent_count: number;
//   total_enrolled: number;
//   attendance_credits: number;
//   class_duration_minutes: number;
//   radius_meters: number;
// }

// export interface RosterStudent {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   face_enrolled: boolean;
//   status: 'PRESENT' | 'ABSENT';
//   verification_status?: string;
//   marked_by?: string;
//   override_reason?: string;
//   marked_at?: string;
//   face_score?: number;
//   liveness_score?: number;
//   scene_score?: number;
// }

// export interface StudentReport {
//   name: string;
//   roll_number: string;
//   total_sessions: number;
//   present_count: number;
//   absent_count: number;
//   attendance_percentage: number;
// }

// export interface EnrolledStudent {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   semester: number;
//   dept_name: string;
//   email: string;
//   face_enrolled: boolean;
//   enrolled_at: string;
// }

// export interface SearchStudent {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   semester: number;
//   dept_name: string;
//   email: string;
//   already_enrolled: boolean;
//   face_enrolled: boolean;
// }

// export interface PreviewStudent {
//   student_id: string;
//   name: string;
//   roll_number: string;
//   distance_meters: number | null;
//   bearing_degrees: number | null;
//   location_status: 'IN_RANGE' | 'STALE' | 'OUT_OF_RANGE' | 'UNKNOWN';
//   face_enrolled: boolean;
//   location_updated_at?: string;
// }

// export interface ChatMessage {
//   message_id: string;
//   session_id: string;
//   sender_type: 'STUDENT' | 'PROFESSOR';
//   student_id?: string;
//   student_name?: string;
//   roll_number?: string;
//   professor_name?: string;
//   message: string;
//   created_at: string;
// }

// export interface Assignment {
//   id: string;
//   course_id: string;
//   title: string;
//   description?: string;
//   deadline: string;
//   professor_files?: string[];
//   created_at?: string;
// }

// export interface Submission {
//   id: string;
//   student_name: string;
//   roll_no: string;
//   email: string;
//   student_files?: string[];
//   is_flagged?: boolean;
//   flag_reason?: string;
//   submitted_at: string;
//   cluster_id?: string;
//   ai_score?: number;
// }

// export interface Cluster {
//   cluster_id: string;
//   match_probability: number;
//   ai_written_probability: number;
//   leader_name: string;
//   leader_roll: string;
//   copiers: { name: string; roll_no: string }[];
// }










export interface User {
  user_id: string;
  email: string;
  role: string;
  college_id: string;
  professor_id: string;
  name: string;
  employee_code: string;
}

export interface Course {
  course_id: string;
  name: string;
  code: string;
  section: string | null;
  semester: number;
  dept_name: string;
  student_count?: number;
  is_mine?: boolean;
  my_student_count?: number;
  total_student_count?: number;
}

export interface ActiveSession {
  session_id: string;
  course_id: string;
  course_name: string;
  course_code?: string;
  section?: string;
  started_at: string;
  expires_at: string;
  students_notified: number;
  challenges: string[];
  attendance_credits?: number;
  status?: string;
  radius_meters?: number;
  class_duration_minutes?: number;
}

export interface StudentCard {
  student_id: string;
  name: string;
  roll_number: string;
  face_photo_url?: string;
  face_score?: number;
  liveness_score?: number;
  scene_score?: number;
  status: 'PRESENT' | 'ABSENT';
  verification_status: 'PENDING' | 'VERIFIED' | 'FAILED' | 'SUSPICIOUS';
  marked_by?: string;
  override_reason?: string;
  notified?: boolean;
  verification_timestamp?: string;
  captured_image_b64?: string;
}

export interface SessionSummary {
  session_id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  section: string;
  status: 'ACTIVE' | 'ENDED' | 'EXPIRED' | 'CANCELLED';
  started_at: string;
  ended_at: string | null;
  expires_at: string;
  present_count: number;
  absent_count: number;
  total_enrolled: number;
  attendance_credits: number;
  class_duration_minutes: number;
  radius_meters: number;
}

export interface RosterStudent {
  student_id: string;
  name: string;
  roll_number: string;
  face_enrolled: boolean;
  status: 'PRESENT' | 'ABSENT';
  verification_status?: string;
  marked_by?: string;
  override_reason?: string;
  marked_at?: string;
  face_score?: number;
  liveness_score?: number;
  scene_score?: number;
  captured_image_b64?: string;
}

export interface StudentReport {
  name: string;
  roll_number: string;
  total_sessions: number;
  present_count: number;
  absent_count: number;
  attendance_percentage: number;
}

export interface EnrolledStudent {
  student_id: string;
  name: string;
  roll_number: string;
  semester: number;
  dept_name: string;
  email: string;
  face_enrolled: boolean;
  enrolled_at: string;
}

export interface SearchStudent {
  student_id: string;
  name: string;
  roll_number: string;
  semester: number;
  dept_name: string;
  email: string;
  already_enrolled: boolean;
  face_enrolled: boolean;
}

export interface PreviewStudent {
  student_id: string;
  name: string;
  roll_number: string;
  distance_meters: number | null;
  bearing_degrees: number | null;
  location_status: 'IN_RANGE' | 'STALE' | 'OUT_OF_RANGE' | 'UNKNOWN';
  face_enrolled: boolean;
  location_updated_at?: string;
}

export interface ChatMessage {
  message_id: string;
  session_id: string;
  sender_type: 'STUDENT' | 'PROFESSOR';
  student_id?: string;
  student_name?: string;
  roll_number?: string;
  professor_name?: string;
  message: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  deadline: string;
  professor_files?: string[];
  created_at?: string;
}

export interface Submission {
  id: string;
  student_name: string;
  roll_no: string;
  email: string;
  student_files?: string[];
  is_flagged?: boolean;
  flag_reason?: string;
  submitted_at: string;
  cluster_id?: string;
  ai_score?: number;
}

export interface Cluster {
  cluster_id: string;
  match_probability: number;
  ai_written_probability: number;
  leader_name: string;
  leader_roll: string;
  copiers: { name: string; roll_no: string }[];
}