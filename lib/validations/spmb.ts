import { z } from "zod";

// ==========================================
// Common Validations
// ==========================================

/**
 * NIK (16 digit Indonesian ID number)
 */
export const nikSchema = z
  .string()
  .length(16, "NIK harus 16 digit")
  .regex(/^\d{16}$/, "NIK harus berupa angka");

/**
 * Indonesian phone number
 */
export const phoneSchema = z
  .string()
  .min(10, "Nomor HP minimal 10 digit")
  .max(15, "Nomor HP maksimal 15 digit")
  .regex(
    /^(\+62|62|0)8[1-9][0-9]{7,10}$/,
    "Format nomor HP tidak valid (contoh: 08123456789)"
  );

/**
 * Email
 */
export const emailSchema = z.string().email("Format email tidak valid");

// ==========================================
// SPMB Form Schemas
// ==========================================

/**
 * Step 1: Student Data
 */
export const studentFormSchema = z.object({
  full_name: z
    .string()
    .min(3, "Nama lengkap minimal 3 karakter")
    .max(100, "Nama lengkap maksimal 100 karakter"),
  nik: nikSchema,
  birth_place: z
    .string()
    .min(2, "Tempat lahir minimal 2 karakter")
    .max(50, "Tempat lahir maksimal 50 karakter"),
  birth_date: z.string().refine(
    (val) => {
      const date = new Date(val);
      const age = new Date().getFullYear() - date.getFullYear();
      return age >= 5 && age <= 15;
    },
    { message: "Usia calon siswa harus antara 5-15 tahun" }
  ),
  gender: z.enum(["L", "P"], { message: "Pilih jenis kelamin" }),
  previous_school: z
    .string()
    .min(3, "Nama sekolah asal minimal 3 karakter")
    .max(100, "Nama sekolah asal maksimal 100 karakter"),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

/**
 * Step 2: Parent/Guardian Data
 */
export const parentFormSchema = z.object({
  parent_name: z
    .string()
    .min(3, "Nama orang tua minimal 3 karakter")
    .max(100, "Nama orang tua maksimal 100 karakter"),
  parent_phone: phoneSchema,
  parent_email: emailSchema,
  home_address: z
    .string()
    .min(10, "Alamat rumah minimal 10 karakter")
    .max(500, "Alamat rumah maksimal 500 karakter"),
});

export type ParentFormValues = z.infer<typeof parentFormSchema>;

/**
 * Step 3: Location Data
 */
export const locationFormSchema = z.object({
  home_lat: z
    .number()
    .min(-90, "Latitude tidak valid")
    .max(90, "Latitude tidak valid"),
  home_lng: z
    .number()
    .min(-180, "Longitude tidak valid")
    .max(180, "Longitude tidak valid"),
  distance_to_school: z.number().nonnegative("Jarak tidak valid"),
  is_within_zone: z.boolean(),
});

export type LocationFormValues = z.infer<typeof locationFormSchema>;

/**
 * Step 4: Documents
 */
export const documentFormSchema = z.object({
  documents: z
    .array(z.instanceof(File))
    .min(1, "Upload minimal 1 dokumen")
    .max(5, "Maksimal 5 dokumen")
    .refine(
      (files) => files.every((file) => file.size <= 2 * 1024 * 1024),
      "Ukuran file maksimal 2MB per file"
    )
    .refine(
      (files) =>
        files.every((file) =>
          ["image/jpeg", "image/png", "application/pdf"].includes(file.type)
        ),
      "Format file harus JPG, PNG, atau PDF"
    ),
});

export type DocumentFormValues = z.infer<typeof documentFormSchema>;

/**
 * Complete Registration Schema (for final validation)
 */
export const registrationFormSchema = z.object({
  ...studentFormSchema.shape,
  ...parentFormSchema.shape,
  ...locationFormSchema.shape,
});

export type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

// ==========================================
// Tracking Schema
// ==========================================

export const trackingFormSchema = z.object({
  registration_number: z
    .string()
    .regex(
      /^SPMB-\d{4}-\d{4}$/,
      "Format nomor pendaftaran tidak valid (contoh: SPMB-2024-0001)"
    ),
});

export type TrackingFormValues = z.infer<typeof trackingFormSchema>;

// ==========================================
// Auth Schemas
// ==========================================

export const loginFormSchema = z.object({
  identity: z.string().min(3, "Username atau email minimal 3 karakter"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    name: z
      .string()
      .min(3, "Nama lengkap minimal 3 karakter")
      .max(100, "Nama lengkap maksimal 100 karakter"),
    email: emailSchema,
    phone: phoneSchema,
    password: z
      .string()
      .min(8, "Password minimal 8 karakter")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password harus mengandung huruf besar, huruf kecil, dan angka"
      ),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Konfirmasi password tidak sama",
    path: ["passwordConfirm"],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
