// ==========================================
// Base Types
// ==========================================

// Base record with common fields
export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  [key: string]: any; // Allow loose typing for now
}

// ==========================================
// User & Profile Types
// ==========================================

export type UserRole =
  | "superadmin"
  | "admin"
  | "staff"
  | "user"
  | "guru"
  | "siswa"
  | "calon_siswa"
  | "orangtua";

export interface User extends BaseRecord {
  username?: string;
  name?: string;
  email: string;
  phone?: string;
  role: UserRole;
  image?: string;
  verified?: boolean;
  isActive?: boolean;
  mustChangePassword?: boolean;
}

export interface Profile extends BaseRecord {
  user: string; // relation to users
  full_name: string;
  nip_nisn?: string;
  phone?: string;
  address?: string;
}

// ==========================================
// School Settings Type (Single Record)
// ==========================================

export interface SchoolSettings extends BaseRecord {
  school_name: string;
  school_npsn?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
  school_logo?: string;
  school_lat: number;
  school_lng: number;
  max_distance_km: number;
  spmb_is_open: boolean;
  current_academic_year?: string;
  school_website?: string;
  principal_name?: string;
  principal_nip?: string;
  last_letter_number?: number;
  letter_number_format?: string;
  school_vision?: string;
  school_mission?: string;
  school_indicators?: string;
  school_history_timeline?: string;
  school_history_achievements?: string;
  school_curriculum?: string;
  school_extracurriculars?: string;
  governance_name?: string;
  department_name?: string;
  landing_tagline?: string;
  landing_description?: string;
  landing_texts?: string;
  landing_sections?: string;
}

// ==========================================
// SPMB Types
// ==========================================

export interface SPMBPeriod extends BaseRecord {
  academic_year: string;
  name: string;
  start_date: string;
  end_date: string;
  quota: number;
  is_active: boolean;
}

export type SPMBStatus =
  | "draft"
  | "pending"
  | "verified"
  | "accepted"
  | "rejected";
export type Gender = "L" | "P";

export interface SPMBRegistrant extends BaseRecord {
  registration_number: string;
  period?: string; // relation to spmb_periods
  period_id?: string;
  
  // === PRIMARY FIELDS (use these in all new code) ===
  full_name?: string;
  nik?: string;
  home_address?: string;
  is_within_zone?: boolean;
  
  // === DEPRECATED ALIASES ===
  // These fields exist for backward compatibility with existing database records.
  // DO NOT use in new code - use the primary fields above instead.
  // Will be removed in a future major version.
  /** @deprecated Use `full_name` instead. Will be removed in v2.0 */
  student_name?: string;
  /** @deprecated Use `nik` instead. Will be removed in v2.0 */
  student_nik?: string;
  /** @deprecated Use `home_address` instead. Will be removed in v2.0 */
  address?: string;
  /** @deprecated Use `is_within_zone` instead. Will be removed in v2.0 */
  is_in_zone?: boolean;
  
  // === OTHER FIELDS ===
  birth_place?: string;
  birth_date?: string;
  gender?: Gender;
  home_lat?: number;
  home_lng?: number;
  distance_to_school?: number;
  previous_school?: string;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  documents?: string[];
  status: SPMBStatus;
  notes?: string;
  verified_by?: string; // relation to users
  verified_at?: string;
  
  // Priority fields (calculated during acceptance processing)
  priority_rank?: number;
  priority_group?: 1 | 2 | 3; // 1=7-12yo, 2=6yo, 3=<6yo
}

// ==========================================
// Announcements Type
// ==========================================

export type AnnouncementCategory = "berita" | "pengumuman" | "spmb" | "prestasi" | "kegiatan";

export interface Announcement extends BaseRecord {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  thumbnail?: string;
  category?: string;
  is_published: boolean;
  is_featured?: boolean;
  published_at?: string;
  author?: string; // relation to users
}

// ==========================================
// Form Types (for registration wizard)
// ==========================================

export interface StudentFormData {
  full_name: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  gender: Gender;
  previous_school: string;
}

export interface ParentFormData {
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  home_address: string;
}

export interface LocationFormData {
  home_lat: number;
  home_lng: number;
  distance_to_school: number;
  is_within_zone: boolean;
}

export interface DocumentFormData {
  documents: File[];
}

export interface RegistrationFormData
  extends StudentFormData,
  ParentFormData,
  LocationFormData {
  documents: File[];
}

// ==========================================
// Map Types
// ==========================================

export interface MapPickerProps {
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
  initialHomeLat?: number;
  initialHomeLng?: number;
  onLocationChange: (
    lat: number,
    lng: number,
    distance: number,
    isWithinZone: boolean
  ) => void;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

// ==========================================
// System Monitor Types
// ==========================================

export interface SystemHealth {
  status: "ok" | "error";
  timestamp: string;
  database: {
    status: "Online" | "Offline" | "Unknown";
    size_bytes: number;
    formatted_size: string;
  };
  system: {
    uptime_seconds: number;
    memory_usage_mb: string;
  };
  backup: {
    count: number;
    last_backup: Date | string | null;
  };
}

// ==========================================
// Bank Soal Types
// ==========================================

export type QuestionType =
  | "pg_single"
  | "pg_multi"
  | "true_false"
  | "fill_blank"
  | "matching"
  | "pair_match"
  | "essay";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
  mediaUrl?: string;
}

export interface Bab {
  id: string;
  subjectId: string;
  classId?: string;
  kurikulumId?: string;
  semester?: string;
  title: string;
  description?: string;
  orderNumber: number;
  createdAt?: number;
  updatedAt?: number;
  subjectName?: string;
  className?: string;
  kurikulumName?: string;
}

export interface QuestionBank {
  id: string;
  subjectId: string;
  classId?: string;
  babId?: string;
  kurikulumId?: string;
  semester?: string;
  title: string;
  description?: string;
  createdBy: string;
  createdAt?: number;
  updatedAt?: number;
  subjectName?: string;
  className?: string;
  babTitle?: string;
  creatorName?: string;
  kurikulumName?: string;
  questionCount?: number;
}

export interface Kurikulum {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface Question {
  id: string;
  bankId: string;
  type: QuestionType;
  content: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  options?: string; // JSON string of QuestionOption[]
  correctAnswer?: string;
  explanation?: string;
  points: number;
  orderNumber: number;
  difficulty: QuestionDifficulty;
  createdBy: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface QuestionSet {
  id: string;
  name: string;
  bankId: string;
  academicYear?: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timerMinutes?: number;
  createdBy: string;
  createdAt?: number;
  updatedAt?: number;
  bankTitle?: string;
  itemCount?: number;
}

export interface QuestionSetItem {
  id: string;
  setId: string;
  questionId: string;
  orderNumber: number;
  pointsOverride?: number;
  question?: Question;
}

export interface StudentPractice {
  id: string;
  studentId: string;
  setId: string;
  startedAt?: number;
  finishedAt?: number;
  totalScore: number;
  maxScore: number;
  isCompleted: boolean;
  attemptNumber: number;
  createdAt?: number;
  setName?: string;
  studentName?: string;
}

export interface StudentPracticeAnswer {
  id: string;
  practiceId: string;
  questionId: string;
  answer?: string;
  isCorrect?: boolean;
  pointsEarned: number;
  answeredAt?: number;
}
