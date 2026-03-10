import { create } from 'zustand';
import { DashboardStudentCard, WSEvent } from '../types/shared';

interface ActiveSession {
  session_id: string;
  course_id: string;
  course_name: string;
  started_at: string;
  expires_at: string;
  students_notified: number;
  challenges: string[];
}

interface SessionState {
  activeSession: ActiveSession | null;
  students: DashboardStudentCard[];
  summary: {
    total: number;
    present: number;
    absent: number;
    pending: number;
    suspicious: number;
  };
  isLoadingDashboard: boolean;

  setActiveSession: (session: ActiveSession | null) => void;
  setStudents: (students: DashboardStudentCard[], summary: any) => void;
  applyWSEvent: (event: WSEvent) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  activeSession: null,
  students: [],
  summary: { total: 0, present: 0, absent: 0, pending: 0, suspicious: 0 },
  isLoadingDashboard: false,

  setActiveSession: (session) => set({ activeSession: session }),

  setStudents: (students, summary) =>
    set({ students, summary, isLoadingDashboard: false }),

  applyWSEvent: (event: WSEvent) => {
    const { students, summary } = get();

    // Find student in list
    const idx = students.findIndex((s) => s.student_id === event.student_id);
    if (idx === -1) return;

    const updated = [...students];
    const oldStatus = updated[idx].status;
    const oldVerif = updated[idx].verification_status;

    // Merge event data into student card
    updated[idx] = { ...updated[idx], ...event.data };

    // Recompute summary
    const newSummary = { ...summary };

    // Reverse old counts
    if (oldStatus === 'PRESENT') newSummary.present = Math.max(0, newSummary.present - 1);
    else newSummary.absent = Math.max(0, newSummary.absent - 1);

    if (oldVerif === 'PENDING') newSummary.pending = Math.max(0, newSummary.pending - 1);
    else if (oldVerif === 'SUSPICIOUS') newSummary.suspicious = Math.max(0, newSummary.suspicious - 1);

    // Apply new counts
    const newStatus = updated[idx].status;
    const newVerif = updated[idx].verification_status;

    if (newStatus === 'PRESENT' || newStatus === 'MANUAL_OVERRIDE') newSummary.present++;
    else newSummary.absent++;

    if (newVerif === 'SUSPICIOUS') newSummary.suspicious++;
    if (newVerif === 'PENDING') newSummary.pending++;

    set({ students: updated, summary: newSummary });
  },

  clearSession: () =>
    set({
      activeSession: null,
      students: [],
      summary: { total: 0, present: 0, absent: 0, pending: 0, suspicious: 0 },
    }),
}));