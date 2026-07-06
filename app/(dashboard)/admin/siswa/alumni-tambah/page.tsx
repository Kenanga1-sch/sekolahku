"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, GraduationCap, ArrowRight, Keyboard } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { goPost } from "@/lib/api-client";

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

const alumniFormSchema = alumniFormBaseSchema.refine((data) => {
  if (data.status === "graduated" && !data.graduationYear) {
    return false;
  }
  return true;
}, {
  message: "Tahun lulus wajib diisi jika status Lulus / Alumni",
  path: ["graduationYear"],
});

type AlumniFormData = z.infer<typeof alumniFormBaseSchema>;

export default function TambahAlumniPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [entryType, setEntryType] = useState<"tk" | "mutasi">("tk");
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<any>({
    resolver: zodResolver(alumniFormSchema),
    defaultValues: {
      status: "active",
      enrolledYear: new Date().getFullYear().toString(),
      citizenship: "WNI",
      dailyLanguage: "Bahasa Indonesia",
      livingWith: "Orangtua",
      siblingKandung: 0,
      siblingTiri: 0,
      siblingAngkat: 0,
    },
  });

  const studentStatus = watch("status");

  // Autofocus first input on step change
  useEffect(() => {
    const focusable = formRef.current?.querySelectorAll("input, select, textarea");
    if (focusable && focusable.length > 0) {
      // Find first visible input and focus it
      const first = Array.from(focusable).find(
        (el) => el.getAttribute("type") !== "hidden" && !(el as HTMLInputElement).disabled
      ) as HTMLElement;
      first?.focus();
    }
  }, [currentStep]);

  // Keyboard Navigation: Ctrl+Enter (Next), Ctrl+Backspace (Prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (currentStep < 3) {
          handleNext();
        } else {
          formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
      if (e.ctrlKey && e.key === "Backspace") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, studentStatus]);

  // Focus shifts linearly on Enter press
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "submit" && e.target.type !== "textarea") {
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(form.elements).filter(
        (el) => el.getAttribute("type") !== "hidden" && !(el as HTMLInputElement).disabled
      ) as HTMLElement[];
      const index = elements.indexOf(e.target as HTMLElement);
      if (index > -1 && index + 1 < elements.length) {
        elements[index + 1].focus();
      }
    }
  };

  const onSubmit = async (data: AlumniFormData) => {
    setLoading(true);
    setError(null);

    try {
      const newAlumni: any = await goPost("/api/alumni", data);

      if (newAlumni.error) {
        throw new Error(newAlumni.error || "Gagal menyimpan data");
      }

      router.push(`/admin/siswa/alumni-detail?id=${newAlumni.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    if (currentStep === 1) {
      fieldsToValidate = ["fullName", "nisn", "nis", "nik", "birthPlace", "birthDate"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["status", "enrolledYear", "finalClass"];
      if (studentStatus === "graduated") {
        fieldsToValidate.push("graduationYear");
      }
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      if (currentStep < 3) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // Sanitize numeric fields (non-digits remover)
  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AlumniFormData) => {
    const val = e.target.value.replace(/\D/g, "");
    setValue(fieldName, val);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/siswa">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Tambah Data Buku Induk
            </h1>
            <p className="text-muted-foreground text-sm">
              Tambahkan data lengkap siswa ke dalam Buku Induk Sekolah
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
          <Keyboard className="h-4 w-4" />
          <span>Navigasi: <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Enter</kbd> (Lanjut) / <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Backsp</kbd> (Kembali)</span>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-3 gap-2 border-y py-4 my-2 bg-slate-50/50 dark:bg-zinc-900/30 rounded-lg text-center">
        <div className="flex flex-col md:flex-row items-center justify-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            1
          </div>
          <span className={`text-xs font-semibold ${currentStep === 1 ? "text-primary text-foreground" : "text-muted-foreground"}`}>Identitas Siswa</span>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 border-x">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            2
          </div>
          <span className={`text-xs font-semibold ${currentStep === 2 ? "text-primary text-foreground" : "text-muted-foreground"}`}>Status & Akademik</span>
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-2">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold ${currentStep === 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            3
          </div>
          <span className={`text-xs font-semibold ${currentStep === 3 ? "text-primary text-foreground" : "text-muted-foreground"}`}>Orang Tua & Wali</span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form ref={formRef} onKeyDown={handleFormKeyDown} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <AnimatePresence mode="wait">
          {/* STEP 1: IDENTITAS SISWA */}
          {currentStep === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Langkah 1: Identitas Diri Siswa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="fullName">Nama Lengkap *</Label>
                      <Input
                        id="fullName"
                        {...register("fullName")}
                        placeholder="Masukkan nama lengkap sesuai akta"
                        className={errors.fullName ? "border-red-500" : ""}
                      />
                      {errors.fullName?.message && <p className="text-sm text-red-500 mt-1">{String(errors.fullName.message)}</p>}
                    </div>
                    <div>
                      <Label htmlFor="nickname">Nama Panggilan</Label>
                      <Input id="nickname" {...register("nickname")} placeholder="Panggilan akrab" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="gender">Jenis Kelamin</Label>
                      <Select value={watch("gender")} onValueChange={(value) => setValue("gender", value as "L" | "P")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih jenis kelamin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L">Laki-laki</SelectItem>
                          <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="nisn">NISN (10 Digit)</Label>
                      <Input
                        id="nisn"
                        value={watch("nisn") || ""}
                        onChange={(e) => handleNumericInput(e, "nisn")}
                        placeholder="0123456789"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <Label htmlFor="nis">NIS (Nomor Induk)</Label>
                      <Input
                        id="nis"
                        value={watch("nis") || ""}
                        onChange={(e) => handleNumericInput(e, "nis")}
                        placeholder="12345"
                      />
                    </div>
                    <div>
                      <Label htmlFor="nik">NIK (16 Digit)</Label>
                      <Input
                        id="nik"
                        value={watch("nik") || ""}
                        onChange={(e) => handleNumericInput(e, "nik")}
                        placeholder="3212000000000000"
                        maxLength={16}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="birthPlace">Tempat Lahir</Label>
                      <Input id="birthPlace" {...register("birthPlace")} placeholder="Contoh: Indramayu" />
                    </div>
                    <div>
                      <Label htmlFor="birthDate">Tanggal Lahir</Label>
                      <Input id="birthDate" type="date" {...register("birthDate")} />
                    </div>
                    <div>
                      <Label htmlFor="religion">Agama</Label>
                      <Select value={watch("religion")} onValueChange={(val) => setValue("religion", val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih agama" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Islam">Islam</SelectItem>
                          <SelectItem value="Kristen">Kristen</SelectItem>
                          <SelectItem value="Katolik">Katolik</SelectItem>
                          <SelectItem value="Hindu">Hindu</SelectItem>
                          <SelectItem value="Budha">Budha</SelectItem>
                          <SelectItem value="Khonghucu">Khonghucu</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="citizenship">Kewarganegaraan</Label>
                      <Input id="citizenship" {...register("citizenship")} placeholder="Contoh: WNI" />
                    </div>
                    <div>
                      <Label htmlFor="dailyLanguage">Bahasa Sehari-hari</Label>
                      <Input id="dailyLanguage" {...register("dailyLanguage")} placeholder="Bahasa dalam keluarga" />
                    </div>
                    <div>
                      <Label htmlFor="livingWith">Bertempat Tinggal Pada</Label>
                      <Select value={watch("livingWith")} onValueChange={(val) => setValue("livingWith", val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tinggal dengan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Orangtua">Orangtua Kandung</SelectItem>
                          <SelectItem value="Menumpang">Menumpang / Saudara</SelectItem>
                          <SelectItem value="Asrama">Asrama / Pondok</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                    <div>
                      <Label htmlFor="siblingKandung">Jumlah Sdr Kandung</Label>
                      <Input id="siblingKandung" type="number" {...register("siblingKandung")} min={0} />
                    </div>
                    <div>
                      <Label htmlFor="siblingTiri">Jumlah Sdr Tiri</Label>
                      <Input id="siblingTiri" type="number" {...register("siblingTiri")} min={0} />
                    </div>
                    <div>
                      <Label htmlFor="siblingAngkat">Jumlah Sdr Angkat</Label>
                      <Input id="siblingAngkat" type="number" {...register("siblingAngkat")} min={0} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 2: STATUS & RIWAYAT AKADEMIK */}
          {currentStep === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Langkah 2: Riwayat Akademik & Status Siswa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Status & General Academic */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="status">Status Buku Induk *</Label>
                      <Select value={watch("status")} onValueChange={(val) => setValue("status", val)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Aktif</SelectItem>
                          <SelectItem value="graduated">Lulus / Alumni</SelectItem>
                          <SelectItem value="transferred">Pindahan (Keluar)</SelectItem>
                          <SelectItem value="dropped">Keluar / DO</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="enrolledYear">Tahun Masuk *</Label>
                      <Input id="enrolledYear" {...register("enrolledYear")} placeholder="Contoh: 2020" />
                    </div>
                    <div>
                      <Label htmlFor="finalClass">Kelas Saat Ini / Terakhir *</Label>
                      <Input id="finalClass" {...register("finalClass")} placeholder="Contoh: 6A" />
                    </div>
                  </div>

                  {/* Asal Masuk */}
                  <div className="space-y-4 border-t pt-4">
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">Metode Masuk / Penerimaan</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input type="radio" checked={entryType === "tk"} onChange={() => setEntryType("tk")} className="h-4 w-4 text-primary" />
                          Siswa Baru Kelas I (TK / Rumah Tangga)
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input type="radio" checked={entryType === "mutasi"} onChange={() => setEntryType("mutasi")} className="h-4 w-4 text-primary" />
                          Pindahan (Mutasi Masuk)
                        </label>
                      </div>
                    </div>

                    {entryType === "tk" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
                        <div>
                          <Label htmlFor="previousSchool">TK Asal / Sumber</Label>
                          <Input id="previousSchool" {...register("previousSchool")} placeholder="Nama TK asal" />
                        </div>
                        <div>
                          <Label htmlFor="previousSchoolAddress">Alamat TK asal</Label>
                          <Input id="previousSchoolAddress" {...register("previousSchoolAddress")} placeholder="Alamat asal TK" />
                        </div>
                        <div>
                          <Label htmlFor="previousSchoolCertNo">No. Surat Keterangan / STTB TK</Label>
                          <Input id="previousSchoolCertNo" {...register("previousSchoolCertNo")} placeholder="Nomor STTB TK" />
                        </div>
                        <div>
                          <Label htmlFor="previousSchoolCertDate">Tanggal STTB TK</Label>
                          <Input id="previousSchoolCertDate" type="date" {...register("previousSchoolCertDate")} />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in duration-200">
                        <div className="md:col-span-2">
                          <Label htmlFor="mutasiMasukAsalSekolah">Nama Sekolah Asal</Label>
                          <Input id="mutasiMasukAsalSekolah" {...register("mutasiMasukAsalSekolah")} placeholder="Sekolah asal mutasi" />
                        </div>
                        <div>
                          <Label htmlFor="mutasiMasukDariKelas">Dari Kelas</Label>
                          <Input id="mutasiMasukDariKelas" {...register("mutasiMasukDariKelas")} placeholder="Kelas asal" />
                        </div>
                        <div>
                          <Label htmlFor="mutasiMasukDiKelas">Diterima di Kelas</Label>
                          <Input id="mutasiMasukDiKelas" {...register("mutasiMasukDiKelas")} placeholder="Kelas saat diterima" />
                        </div>
                        <div className="md:col-span-4">
                          <Label htmlFor="mutasiMasukDiterimaTanggal">Diterima Tanggal</Label>
                          <Input id="mutasiMasukDiterimaTanggal" type="date" {...register("mutasiMasukDiterimaTanggal")} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Keluar Details based on Status */}
                  {studentStatus === "graduated" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <Label htmlFor="graduationYear">Tahun Lulus *</Label>
                        <Input id="graduationYear" {...register("graduationYear")} placeholder="Contoh: 2026" />
                        {errors.graduationYear?.message && <p className="text-sm text-red-500 mt-1">{String(errors.graduationYear.message)}</p>}
                      </div>
                      <div>
                        <Label htmlFor="graduationDate">Tanggal Kelulusan</Label>
                        <Input id="graduationDate" type="date" {...register("graduationDate")} />
                      </div>
                      <div>
                        <Label htmlFor="nextSchool">Melanjutkan Ke Sekolah (SMP/MTs)</Label>
                        <Input id="nextSchool" {...register("nextSchool")} placeholder="Contoh: SMPN 1 Indramayu" />
                      </div>
                    </div>
                  )}

                  {studentStatus === "transferred" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <Label htmlFor="mutationOutClass">Dari Kelas</Label>
                        <Input id="mutationOutClass" {...register("mutationOutClass")} placeholder="Kelas terakhir" />
                      </div>
                      <div>
                        <Label htmlFor="mutationOutToSchool">Ke Sekolah Tujuan</Label>
                        <Input id="mutationOutToSchool" {...register("mutationOutToSchool")} placeholder="Sekolah baru" />
                      </div>
                      <div>
                        <Label htmlFor="mutationOutToClass">Ke Kelas</Label>
                        <Input id="mutationOutToClass" {...register("mutationOutToClass")} placeholder="Kelas baru" />
                      </div>
                      <div>
                        <Label htmlFor="mutationOutDate">Tanggal Pindah</Label>
                        <Input id="mutationOutDate" type="date" {...register("mutationOutDate")} />
                      </div>
                    </div>
                  )}

                  {studentStatus === "dropped" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div>
                        <Label htmlFor="droppedOutDate">Tanggal Keluar</Label>
                        <Input id="droppedOutDate" type="date" {...register("droppedOutDate")} />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="droppedOutReason">Alasan Keluar / Putus Sekolah</Label>
                        <Input id="droppedOutReason" {...register("droppedOutReason")} placeholder="Sebutkan alasannya secara lengkap" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* STEP 3: KELUARGA & KONTAK */}
          {currentStep === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
              {/* Orang Tua Kandung */}
              <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Orang Tua Kandung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Ayah */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Ayah</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="fatherName">Nama Lengkap Ayah</Label>
                        <Input id="fatherName" {...register("fatherName")} placeholder="Nama Ayah" />
                      </div>
                      <div>
                        <Label htmlFor="fatherNik">NIK Ayah</Label>
                        <Input
                          id="fatherNik"
                          value={watch("fatherNik") || ""}
                          onChange={(e) => handleNumericInput(e, "fatherNik")}
                          placeholder="3212..."
                          maxLength={16}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fatherEducation">Pendidikan Terakhir</Label>
                        <Input id="fatherEducation" {...register("fatherEducation")} placeholder="Contoh: SMA / S1" />
                      </div>
                      <div className="md:col-span-4">
                        <Label htmlFor="fatherJob">Pekerjaan</Label>
                        <Input id="fatherJob" {...register("fatherJob")} placeholder="Pekerjaan Ayah" />
                      </div>
                    </div>
                  </div>

                  {/* Ibu */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Ibu</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor="motherName">Nama Lengkap Ibu</Label>
                        <Input id="motherName" {...register("motherName")} placeholder="Nama Ibu" />
                      </div>
                      <div>
                        <Label htmlFor="motherNik">NIK Ibu</Label>
                        <Input
                          id="motherNik"
                          value={watch("motherNik") || ""}
                          onChange={(e) => handleNumericInput(e, "motherNik")}
                          placeholder="3212..."
                          maxLength={16}
                        />
                      </div>
                      <div>
                        <Label htmlFor="motherEducation">Pendidikan Terakhir</Label>
                        <Input id="motherEducation" {...register("motherEducation")} placeholder="Contoh: D3 / S1" />
                      </div>
                      <div className="md:col-span-4">
                        <Label htmlFor="motherJob">Pekerjaan</Label>
                        <Input id="motherJob" {...register("motherJob")} placeholder="Pekerjaan Ibu" />
                      </div>
                    </div>
                  </div>

                  {/* Wali */}
                  <div className="space-y-3 border-t pt-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200 border-l-2 border-l-primary pl-2">Data Wali (Jika Ada)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="guardianName">Nama Wali</Label>
                        <Input id="guardianName" {...register("guardianName")} placeholder="Nama Wali" />
                      </div>
                      <div>
                        <Label htmlFor="guardianRelation">Hubungan Keluarga</Label>
                        <Input id="guardianRelation" {...register("guardianRelation")} placeholder="Contoh: Paman / Kakek" />
                      </div>
                      <div>
                        <Label htmlFor="guardianPhone">Telepon Wali</Label>
                        <Input id="guardianPhone" {...register("guardianPhone")} placeholder="Nomor HP Wali" />
                      </div>
                      <div>
                        <Label htmlFor="guardianNik">NIK Wali</Label>
                        <Input
                          id="guardianNik"
                          value={watch("guardianNik") || ""}
                          onChange={(e) => handleNumericInput(e, "guardianNik")}
                          placeholder="3212..."
                          maxLength={16}
                        />
                      </div>
                      <div>
                        <Label htmlFor="guardianEducation">Pendidikan Terakhir</Label>
                        <Input id="guardianEducation" {...register("guardianEducation")} placeholder="Pendidikan Wali" />
                      </div>
                      <div>
                        <Label htmlFor="guardianJob">Pekerjaan</Label>
                        <Input id="guardianJob" {...register("guardianJob")} placeholder="Pekerjaan Wali" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Kontak Utama & Telepon */}
              <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Alamat Rumah & Telepon Kontak Utama</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="parentName">Nama Kontak Utama (Orang Tua / Wali) *</Label>
                    <Input id="parentName" {...register("parentName")} placeholder="Nama penanggung jawab siswa" />
                  </div>
                  <div>
                    <Label htmlFor="parentPhone">No Telepon Kontak Utama *</Label>
                    <Input id="parentPhone" {...register("parentPhone")} placeholder="Nomor Telepon aktif" />
                  </div>
                  <div>
                    <Label htmlFor="currentPhone">No Telepon Siswa (Jika Ada)</Label>
                    <Input id="currentPhone" {...register("currentPhone")} placeholder="Nomor Telepon siswa" />
                  </div>
                  <div>
                    <Label htmlFor="currentEmail">Email Siswa (Jika Ada)</Label>
                    <Input id="currentEmail" type="email" {...register("currentEmail")} placeholder="email@domain.com" />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="currentAddress">Alamat Lengkap Rumah *</Label>
                    <Textarea id="currentAddress" {...register("currentAddress")} placeholder="Alamat lengkap (RT/RW, Desa/Kelurahan, Kecamatan, Kabupaten/Kota)" rows={2} />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="notes">Catatan Penting Lain-lain</Label>
                    <Textarea id="notes" {...register("notes")} placeholder="Catatan penting sejarah siswa (beasiswa, prestasi, catatan khusus)" rows={2} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-zinc-800">
          <div>
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={handlePrev} className="h-9">
                Sebelumnya
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/admin/siswa">
              <Button type="button" variant="ghost" className="h-9">
                Batal
              </Button>
            </Link>
            {currentStep < 3 ? (
              <Button type="button" onClick={handleNext} className="h-9 flex items-center gap-1">
                Selanjutnya
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={loading} className="h-9 flex items-center gap-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Simpan ke Buku Induk
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
