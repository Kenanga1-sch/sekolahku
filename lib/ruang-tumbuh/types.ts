// Tipe bersama modul Ruang Tumbuh (skrining & perkembangan peserta didik).

export interface ScreeningGame {
  id: string;
  code: string;
  name: string;
  domain: string;
  description?: string;
  icon?: string;
  version: string;
  orderNumber: number;
  isActive: boolean;
}

export interface ScreeningSession {
  id: string;
  gameId: string;
  gameName?: string;
  gameIcon?: string;
  domain?: string;
  classId: string;
  className?: string;
  teacherUserId: string;
  teacherName?: string;
  academicYear?: string;
  title?: string;
  status: "pending" | "active" | "finished" | "cancelled";
  startedAt?: number;
  finishedAt?: number;
  notes?: string;
  createdAt: number;
  totalStudents?: number;
  completedCount?: number;
}

export interface MySessionView extends ScreeningSession {
  myAttemptId?: string;
  myAttemptStatus?: string;
}

export interface SessionRosterItem {
  studentId: string;
  studentName: string;
  attemptId?: string;
  attemptNo?: number;
  attemptStatus?: string;
  accuracy?: number;
  levelReached?: number;
  hasObservation?: boolean;
}

export interface ScreeningAttempt {
  id: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  gameId: string;
  gameName?: string;
  domain?: string;
  gameVersion?: string;
  attemptNumber: number;
  status: "in_progress" | "completed" | "abandoned";
  startedAt?: number;
  completedAt?: number;
}

export interface TrialRecord {
  trialNumber: number;
  level: number;
  stimulus: string;
  response: string;
  isCorrect: boolean;
  reactionTimeMs: number;
}

export interface ScreeningMetrics {
  totalTrials: number;
  correct: number;
  incorrect: number;
  missed: number;
  rtAvg: number;
  rtMedian: number;
  rtMin: number;
  rtMax: number;
  rtVariability: number;
  accuracy: number;
  levelReached: number;
  errorBreakpoint?: number;
}

export interface ScreeningResult {
  id: string;
  attemptId: string;
  sessionId: string;
  studentId: string;
  gameId: string;
  domain: string;
  metrics: ScreeningMetrics;
  levelReached?: number;
  accuracy: number;
  computedAt: number;
}

// Kontrak tiap game: diberi attempt + config, memanggil onComplete dengan
// kumpulan trial mentah yang akan dikirim ke server.
export interface GameProps {
  attemptId: string;
  onComplete: (trials: TrialRecord[]) => void;
}

// Utilitas device info (§36: catat perangkat yang dipakai).
export function collectDeviceInfo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Chrome\//.test(ua)) browser = "chrome";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/Safari\//.test(ua)) browser = "safari";
  return {
    deviceType: isMobile ? "mobile" : "desktop",
    browser,
    screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
    screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
  };
}

export const DOMAIN_LABELS: Record<string, string> = {
  perhatian: "Perhatian",
  inhibitory: "Pengendalian Respons",
  working_memory: "Ingatan Jangka Pendek",
  literasi: "Literasi Dasar",
  numerasi: "Numerasi Dasar",
};

// Deskriptor metrik untuk guru (measure, don't label — §23). Bukan diagnosis.
export function describeMetric(value: number, thresholds: [number, number], labels: [string, string, string]): string {
  if (value >= thresholds[1]) return labels[2];
  if (value >= thresholds[0]) return labels[1];
  return labels[0];
}
