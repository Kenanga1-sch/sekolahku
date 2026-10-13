// Tipe bersama modul Bank Soal — dipakai oleh tab-paket dan dialog-dialognya.
export interface QuestionBank {
  id: string;
  title: string;
}

export interface ExamAssignment {
  id: string;
  classId: string;
  className?: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  bankId: string;
  academicYear?: string;
  mode: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timerMinutes?: number;
  maxAttempts?: number;
  availableFrom?: string;
  availableUntil?: string;
  resultVisible: boolean;
  bankTitle?: string;
  itemCount?: number;
  createdAt?: number;
  assignedClasses?: ExamAssignment[];
}

export interface ClassItem {
  id: string;
  name: string;
}

export interface SetItem {
  id: string;
  setId: string;
  questionId: string;
  orderNumber: number;
  question?: {
    id: string;
    type: string;
    content: string;
    points: number;
    mediaUrl?: string;
  };
}

export interface BankQuestion {
  id: string;
  type: string;
  content: string;
  points: number;
}

export const TYPE_LABELS: Record<string, string> = {
  pg_single: "PG Tunggal",
  pg_multi: "PG Multi",
  true_false: "Benar/Salah",
  fill_blank: "Isian",
  matching: "Menjodohkan",
  pair_match: "Mencocokkan",
  essay: "Esai",
};
