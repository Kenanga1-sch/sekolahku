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
  nisn: z.string().optional(),
  nik: nikSchema,
  kk_number: nikSchema.describe("Nomor Kartu Keluarga"),
  birth_certificate_no: z.string().optional(),
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
  religion: z.string().min(1, "Pilih agama"),
  special_needs: z.string().default("Tidak"),
  living_arrangement: z.string().min(1, "Pilih tempat tinggal"),
  transport_mode: z.string().min(1, "Pilih moda transportasi"),
  child_order: z.coerce.number().min(1, "Anak ke- harus diisi"),
  has_kps_pkh: z.boolean().default(false),
  has_kip: z.boolean().default(false),
  previous_school: z
    .string()
    .max(100, "Nama sekolah asal maksimal 100 karakter")
    .optional(),
});

export type StudentFormValues = z.infer<typeof studentFormSchema>;

/**
 * Step 2: Parent/Guardian Data
 */
export const parentFormSchema = z.object({
  // Contact Person
  parent_phone: phoneSchema,
  parent_email: z.union([emailSchema, z.literal("")]).optional(),

  // Detailed Address
  address_street: z.string().min(3, "Nama jalan/dusun wajib diisi"),
  address_rt: z.string().min(1, "RT wajib diisi"),
  address_rw: z.string().min(1, "RW wajib diisi"),
  address_village: z.string().min(2, "Desa/Kelurahan wajib diisi"),
  postal_code: z.string().optional(),
  // For backward compatibility / display
  home_address: z.string().optional(),

  // Father
  father_name: z.string().min(1, "Nama ayah wajib diisi"),
  father_nik: nikSchema,
  father_birth_year: z.string().length(4, "Tahun lahir 4 digit"),
  father_education: z.string().min(1, "Pendidikan ayah wajib dipilih"),
  father_job: z.string().min(1, "Pekerjaan ayah wajib dipilih"),
  father_income: z.string().min(1, "Penghasilan ayah wajib dipilih"),

  // Mother
  mother_name: z.string().min(1, "Nama ibu wajib diisi"),
  mother_nik: nikSchema,
  mother_birth_year: z.string().length(4, "Tahun lahir 4 digit"),
  mother_education: z.string().min(1, "Pendidikan ibu wajib dipilih"),
  mother_job: z.string().min(1, "Pekerjaan ibu wajib dipilih"),
  mother_income: z.string().min(1, "Penghasilan ibu wajib dipilih"),

  // Guardian (Optional)
  guardian_name: z.string().optional(),
  guardian_nik: z.string().optional(),
  guardian_birth_year: z.string().optional(),
  guardian_education: z.string().optional(),
  guardian_job: z.string().optional(),
  guardian_income: z.string().optional(),
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
  kk: z
    .instanceof(File, { message: "Kartu Keluarga wajib diupload" })
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    ),
  akte: z
    .instanceof(File, { message: "Akta Kelahiran wajib diupload" })
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    ),
  ktp_ayah: z
    .instanceof(File, { message: "KTP Ayah wajib diupload" })
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    ),
  ktp_ibu: z
    .instanceof(File, { message: "KTP Ibu wajib diupload" })
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    ),
  pas_foto: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png"].includes(f.type),
      "Format JPG/PNG"
    )
    .optional(),
  ijazah: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    )
    .optional(),
  kip: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    )
    .optional(),
  kps: z
    .instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "Maksimal 2MB")
    .refine(
      (f) => ["image/jpeg", "image/png", "application/pdf"].includes(f.type),
      "Format JPG/PNG/PDF"
    )
    .optional(),
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
// API Types & Schemas
// ==========================================

export const registerApiSchema = z.object({
  // Spread student fields
  full_name: z.string(),
  nisn: z.string().optional(),
  student_nik: z.string(),
  kk_number: z.string(),
  birth_certificate_no: z.string().optional(),
  birth_place: z.string(),
  birth_date: z.string(), 
  gender: z.enum(["L", "P"]),
  religion: z.string(),
  special_needs: z.string(),
  living_arrangement: z.string(),
  transport_mode: z.string(),
  child_order: z.number(),
  has_kps_pkh: z.boolean(),
  has_kip: z.boolean(),
  previous_school: z.string().optional(),

  // Address
  address_street: z.string(),
  address_rt: z.string(),
  address_rw: z.string(),
  address_village: z.string(),
  postal_code: z.string().optional(),
  address: z.string().optional(), // Full address string (derived if missing)

  // Parents
  parent_phone: z.string(),
  parent_email: z.string().optional(),

  father_name: z.string(),
  father_nik: z.string(),
  father_birth_year: z.string(),
  father_education: z.string(),
  father_job: z.string(),
  father_income: z.string(),

  mother_name: z.string(),
  mother_nik: z.string(),
  mother_birth_year: z.string(),
  mother_education: z.string(),
  mother_job: z.string(),
  mother_income: z.string(),

  guardian_name: z.string().optional(),
  guardian_nik: z.string().optional(),
  guardian_birth_year: z.string().optional(),
  guardian_education: z.string().optional(),
  guardian_job: z.string().optional(),
  guardian_income: z.string().optional(),
  
  // Location
  home_lat: z.number(),
  home_lng: z.number(),
  distance_to_school: z.number(),
  is_within_zone: z.boolean(),
  
  // Backwards compat for old components if they send this field
  student_name: z.string().optional(),
  parent_name: z.string().optional(),
});


export type RegisterApiPayload = z.infer<typeof registerApiSchema>;

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
