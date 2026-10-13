import { z } from "zod";

const alumniFormBaseSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter"),
  nickname: z.string().optional(),
  nisn: z.string().optional(),
  nis: z.string().optional(),
  nik: z.string().optional(),
  gender: z.enum(["L", "P"]).optional(),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(),
  religion: z.string().optional(),
  citizenship: z.string().optional().default("WNI"),
  siblingKandung: z.preprocess((val) => val === "" || val === undefined ? 0 : Number(val), z.number().int().nonnegative().default(0)),
  siblingTiri: z.preprocess((val) => val === "" || val === undefined ? 0 : Number(val), z.number().int().nonnegative().default(0)),
  siblingAngkat: z.preprocess((val) => val === "" || val === undefined ? 0 : Number(val), z.number().int().nonnegative().default(0)),
  siblingCount: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().int().nonnegative().nullable()),
  childOrder: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().int().positive().nullable()),
  dailyLanguage: z.string().optional().default("Bahasa Indonesia"),
  livingWith: z.string().optional().default("Orangtua"),

  // Perkembangan jasmani & kesehatan (kolom DB sudah ada, sebelumnya tanpa input)
  address: z.string().optional(),
  weight: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().int().nonnegative().nullable()),
  height: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().int().nonnegative().nullable()),
  bloodType: z.string().optional(),
  medicalNotes: z.string().optional(),
  specialNeeds: z.string().optional(),
  
  status: z.string(),
  enrolledYear: z.string().optional(),
  finalClass: z.string().optional(),
  bukuFisikNo: z.string().optional(),
  registerNo: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().int().nonnegative().nullable()),
  
  // Asal Masuk
  previousSchool: z.string().optional(),
  previousSchoolAddress: z.string().optional(),
  previousSchoolCertNo: z.string().optional(),
  previousSchoolCertDate: z.string().optional(),
  
  mutasiMasukAsalSekolah: z.string().optional(),
  mutasiMasukDariKelas: z.string().optional(),
  mutasiMasukDiterimaTanggal: z.string().optional(),
  mutasiMasukDiKelas: z.string().optional(),
  
  // Keluar / Lulus
  graduationYear: z.string().optional(),
  graduationDate: z.string().optional(),
  nextSchool: z.string().optional(),
  
  // Mutasi Keluar
  mutationOutClass: z.string().optional(),
  mutationOutToSchool: z.string().optional(),
  mutationOutToClass: z.string().optional(),
  mutationOutDate: z.string().optional(),
  
  // Drop Out
  droppedOutDate: z.string().optional(),
  droppedOutReason: z.string().optional(),
  
  // Parents
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  currentAddress: z.string().optional(),
  currentPhone: z.string().optional(),
  currentEmail: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  notes: z.string().optional(),
  
  fatherName: z.string().optional(),
  fatherNik: z.string().optional(),
  fatherEducation: z.string().optional(),
  fatherJob: z.string().optional(),
  
  motherName: z.string().optional(),
  motherNik: z.string().optional(),
  motherEducation: z.string().optional(),
  motherJob: z.string().optional(),
  
  guardianName: z.string().optional(),
  guardianNik: z.string().optional(),
  guardianRelation: z.string().optional(),
  guardianEducation: z.string().optional(),
  guardianJob: z.string().optional(),
  guardianPhone: z.string().optional(),
  
  // Tahap 2: Dokumen resmi & penghasilan
  ijazahNo: z.string().optional(),
  ijazahDate: z.string().optional(),
  skhunNo: z.string().optional(),
  skhunDate: z.string().optional(),
  fatherIncome: z.string().optional(),
  motherIncome: z.string().optional(),
  guardianIncome: z.string().optional(),
  parentAddress: z.string().optional(),
  scholarshipInfo: z.string().optional(),

  // Tahap 3: Penelusuran alumni & rata-rata akhir (kolom DB sudah ada, sebelumnya tanpa input)
  finalGradeAvg: z.preprocess((val) => val === "" || val === undefined ? null : Number(val), z.number().min(0).max(100).nullable()),
  currentOccupation: z.string().optional(),
  currentInstitution: z.string().optional(),
  lastEducationLevel: z.string().optional(),
});

export const alumniFormSchema = alumniFormBaseSchema.refine((data) => {
  if (data.status === "graduated" && !data.graduationYear) {
    return false;
  }
  return true;
}, {
  message: "Tahun lulus wajib diisi jika status Lulus / Alumni",
  path: ["graduationYear"],
});

export type AlumniFormData = z.infer<typeof alumniFormBaseSchema>;
