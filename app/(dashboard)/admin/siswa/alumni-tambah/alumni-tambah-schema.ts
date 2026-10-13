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
  dailyLanguage: z.string().optional().default("Bahasa Indonesia"),
  livingWith: z.string().optional().default("Orangtua"),
  
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
