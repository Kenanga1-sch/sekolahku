import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export interface AlumniHealthRecord {
  id: string;
  alumniId: string;
  year: string;
  weight: number | null;
  height: number | null;
  illness: string | null;
  abnormality: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AlumniDetail {
  id: string;
  studentId: string | null;
  nisn: string | null;
  nis: string | null;
  nik: string | null;
  fullName: string;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  religion: string | null;
  address: string | null;
  enrolledYear: string | null;
  previousSchool: string | null;
  graduationYear: string;
  graduationDate: Date | null;
  finalClass: string | null;
  finalGradeAvg: number | null;
  photo: string | null;
  parentName: string | null;
  parentPhone: string | null;
  fatherName: string | null;
  fatherNik: string | null;
  fatherEducation: string | null;
  fatherJob: string | null;
  motherName: string | null;
  motherNik: string | null;
  motherEducation: string | null;
  motherJob: string | null;
  guardianName: string | null;
  guardianNik: string | null;
  guardianRelation: string | null;
  guardianJob: string | null;
  guardianPhone: string | null;
  siblingCount: number | null;
  childOrder: number | null;
  height: number | null;
  weight: number | null;
  bloodType: string | null;
  medicalNotes: string | null;
  specialNeeds: string | null;
  currentAddress: string | null;
  currentPhone: string | null;
  currentEmail: string | null;
  nextSchool: string | null;
  currentOccupation: string | null;
  currentInstitution: string | null;
  lastEducationLevel: string | null;
  notes: string | null;
  status: string;
  documents: AlumniDocument[];
  pickups: DocumentPickup[];
  transcripts: AlumniTranscript[];
  achievements: AlumniAchievement[];
  extracurriculars: AlumniExtracurricular[];
  attendanceSummaries: AlumniAttendanceSummary[];
  nickname: string | null;
  citizenship: string | null;
  siblingKandung: number;
  siblingTiri: number;
  siblingAngkat: number;
  dailyLanguage: string | null;
  livingWith: string | null;
  guardianEducation: string | null;
  previousSchoolAddress: string | null;
  previousSchoolCertNo: string | null;
  previousSchoolCertDate: string | null;
  mutasiMasukAsalSekolah: string | null;
  mutasiMasukDariKelas: string | null;
  mutasiMasukDiterimaTanggal: string | null;
  mutasiMasukDiKelas: string | null;
  scholarshipInfo: string | null;
  mutationOutClass: string | null;
  mutationOutToSchool: string | null;
  mutationOutToClass: string | null;
  mutationOutDate: string | null;
  droppedOutDate: string | null;
  droppedOutReason: string | null;
  healthRecords: AlumniHealthRecord[];
  // Index buku induk fisik lama
  bukuFisikNo: string | null;
  registerNo: number | null;
}

export interface AlumniTranscript {
  id: string;
  academicYear: string;
  semester: string;
  subjectName: string;
  subjectCode: string | null;
  score: number;
  scoreLetter: string | null;
  notes: string | null;
}

export interface AlumniAchievement {
  id: string;
  type: string;
  title: string;
  description: string | null;
  level: string;
  ranking: string | null;
  year: string;
  organizer: string | null;
  certificateUrl: string | null;
}

export interface AlumniExtracurricular {
  id: string;
  activityName: string;
  role: string | null;
  yearStart: string | null;
  yearEnd: string | null;
  description: string | null;
}

export interface AlumniAttendanceSummary {
  id: string;
  academicYear: string;
  semester: string;
  present: number;
  sick: number;
  permission: number;
  absent: number;
  totalDays: number;
}

export interface AlumniDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface DocumentPickup {
  id: string;
  recipientName: string;
  recipientRelation: string | null;
  pickupDate: Date;
  notes: string | null;
  documentType: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export const statusInfo: Record<string, { label: string; color: string }> = {
  active: {
    label: "Aktif",
    color: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20",
  },
  graduated: {
    label: "Alumni / Lulus",
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20",
  },
  transferred: {
    label: "Pindahan",
    color: "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20",
  },
  dropped: {
    label: "Keluar",
    color: "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border-rose-500/20",
  },
};

export function formatDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return format(date, "dd MMMM yyyy", { locale: localeId });
  } catch {
    return dateStr;
  }
}
