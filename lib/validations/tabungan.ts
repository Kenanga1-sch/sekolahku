import { z } from "zod";

// ==========================================
// Tabungan Schemas
// ==========================================

export const tabunganSiswaSchema = z.object({
  nisn: z.string().min(1, "NISN wajib diisi"),
  nama: z.string().min(3, "Nama minimal 3 karakter"),
  kelasId: z.string().min(1, "ID Kelas tidak valid"),
});

export const tabunganKelasSchema = z.object({
  nama: z.string().min(1, "Nama kelas wajib diisi"),
  waliKelas: z.string().optional(),
});

export const tabunganTransaksiSchema = z.object({
  siswaId: z.string().min(1, "Siswa wajib dipilih"),
  type: z.enum(["setor", "tarik"]),
  nominal: z.number().min(1000, "Nominal minimal Rp 1.000"),
  catatan: z.string().max(255).optional(),
  userId: z.string().optional(), // For internal use/override
});

// For API Payload
export const createTransaksiSchema = tabunganTransaksiSchema;
export const createSiswaSchema = tabunganSiswaSchema;
export const createKelasSchema = tabunganKelasSchema;
