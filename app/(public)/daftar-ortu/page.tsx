"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Phone,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Reveal } from "@/components/public/motion";
import { registerParentAction, verifyStudentAction } from "@/actions/parent";

const benefits = [
  { icon: ShieldCheck, title: "Kehadiran Harian", desc: "Pantau presensi anak setiap hari secara langsung." },
  { icon: KeyRound, title: "Tabungan Siswa", desc: "Lihat mutasi saldo tabungan anak secara transparan." },
  { icon: Users, title: "Pengumuman & Izin", desc: "Terima pengumuman sekolah dan ajukan izin/sakit anak." },
];

const stepTitles: Record<1 | 2 | 3, string> = {
  1: "Verifikasi Data Anak",
  2: "Data Akun Orang Tua",
  3: "Pendaftaran Selesai",
};

type FieldErrors = {
  nisn?: string;
  birthDate?: string;
  name?: string;
  phone?: string;
  password?: string;
  form?: string;
};

const fieldClass = "h-11 rounded-xl";

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  const showLogin = message.toLowerCase().includes("sudah terdaftar");
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="space-y-1">
          <p>{message}</p>
          {showLogin && (
            <Link href="/login" className="font-semibold underline underline-offset-4">
              Masuk ke akun yang sudah ada
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DaftarOrtuPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [nisn, setNisn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studentName, setStudentName] = useState("");

  const [name, setName] = useState("");
  const [relation, setRelation] = useState("orangtua");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const today = todayISO();

  const clearError = (field: keyof FieldErrors) => {
    setErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      return { ...prev, [field]: undefined, form: undefined };
    });
  };

  const validateStep1 = () => {
    const next: FieldErrors = {};
    if (!/^\d{10}$/.test(nisn)) {
      next.nisn = "NISN harus tepat 10 digit angka.";
    }
    if (!birthDate) {
      next.birthDate = "Tanggal lahir wajib diisi.";
    } else if (birthDate > today) {
      next.birthDate = "Tanggal lahir tidak boleh di masa depan.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    const next: FieldErrors = {};
    if (name.trim().length < 3) {
      next.name = "Nama minimal 3 karakter.";
    }
    if (!/^08\d{8,13}$/.test(phone)) {
      next.phone = "Nomor HP tidak valid (contoh: 081234567890).";
    }
    if (password.length < 6) {
      next.password = "Password minimal 6 karakter.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const verify = async () => {
    if (busy || !validateStep1()) return;
    setBusy(true);
    try {
      const res = await verifyStudentAction(nisn, birthDate);
      if (res.success) {
        setStudentName((res.data as { studentName?: string })?.studentName || "Siswa");
        setErrors({});
        setStep(2);
      } else {
        setErrors({ form: res.error || "Data siswa tidak ditemukan." });
      }
    } catch (err: any) {
      setErrors({ form: err?.message || "Gagal memverifikasi data. Coba lagi." });
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (busy || !validateStep2()) return;
    setBusy(true);
    try {
      const res = await registerParentAction({
        nisn,
        birthDate,
        name: name.trim(),
        phone,
        password,
        relation,
      });
      if (res.success) {
        setErrors({});
        setStep(3);
      } else {
        setErrors({ form: res.error || "Gagal membuat akun." });
      }
    } catch (err: any) {
      setErrors({ form: err?.message || "Gagal membuat akun. Coba lagi." });
    } finally {
      setBusy(false);
    }
  };

  const backToStep1 = () => {
    setErrors({});
    setStep(1);
  };

  return (
    <div className="relative min-h-[80dvh] flex items-start justify-center px-4 py-12 md:py-20 bg-public-bg overflow-hidden">
      {/* Latar dekoratif ala halaman publik */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 via-public-bg to-public-bg dark:from-primary/20 dark:via-transparent dark:to-transparent" />
      <div className="absolute -top-24 -right-24 w-[40vw] h-[40vw] max-w-[440px] max-h-[440px] rounded-full bg-secondary/20 dark:bg-primary/20 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Info pendaftaran — tetap informatif */}
        <div className="lg:col-span-2 space-y-6 lg:pt-2">
          <Reveal>
            <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider dark:bg-secondary/10 dark:text-secondary dark:border-secondary/20">
              Portal Orang Tua
            </Badge>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground dark:text-foreground leading-[1.15]">
              Daftar Akun Orang Tua
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="text-base text-muted-foreground dark:text-muted-foreground leading-relaxed max-w-[55ch]">
              Hubungkan akun Anda dengan data anak di sekolah untuk memantau kehadiran, tabungan,
              dan pengumuman dalam satu tempat. Proses hanya butuh NISN dan tanggal lahir anak.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li key={b.title} className="flex items-start gap-3 p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-public-border shadow-sm dark:bg-white/5 dark:border-white/10">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary text-primary flex items-center justify-center dark:bg-primary/40 dark:text-secondary">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm dark:text-foreground">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed dark:text-muted-foreground">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.32}>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">
              Sudah punya akun?{" "}
              <Link
                href="/login"
                aria-label="Masuk ke portal orang tua"
                className="font-semibold text-primary underline underline-offset-4 hover:no-underline dark:text-secondary"
              >
                Masuk di sini
              </Link>
            </p>
          </Reveal>
        </div>

        {/* Kartu glass berisi langkah pendaftaran */}
        <Reveal delay={0.12} className="lg:col-span-3">
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-primary/5 dark:bg-white/5 dark:border-white/10 dark:shadow-black/20 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-public-border/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/25">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-muted-foreground">
                    Langkah {step} dari 3
                  </p>
                  <h2 className="font-semibold text-foreground dark:text-foreground">{stepTitles[step]}</h2>
                </div>
              </div>

              {/* Indikator progres */}
              <div className="mt-4 flex items-center gap-2" aria-hidden="true">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      s <= step ? "bg-primary dark:bg-secondary" : "bg-public-border dark:bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="px-6 py-6">
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void verify();
                    }}
                    noValidate
                    className="space-y-4"
                  >
                    <FormError message={errors.form} />

                    <div className="space-y-2">
                      <Label htmlFor="nisn">NISN Anak</Label>
                      <Input
                        id="nisn"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Masukkan 10 digit NISN"
                        value={nisn}
                        onChange={(e) => {
                          setNisn(e.target.value.replace(/\D/g, "").slice(0, 10));
                          clearError("nisn");
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        autoFocus
                        aria-label="NISN anak"
                        aria-invalid={Boolean(errors.nisn)}
                        aria-describedby={errors.nisn ? "nisn-error" : "nisn-help"}
                        className={fieldClass}
                      />
                      {errors.nisn ? (
                        <p id="nisn-error" role="alert" className="text-xs text-destructive">
                          {errors.nisn}
                        </p>
                      ) : (
                        <p id="nisn-help" className="text-xs text-muted-foreground dark:text-muted-foreground">
                          NISN tertera pada kartu pelajar atau rapor anak.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tgl">Tanggal Lahir Anak</Label>
                      <DateInput
                        id="tgl"
                        autoComplete="bday"
                        value={birthDate}
                        onChange={(e) => {
                          setBirthDate(e.target.value);
                          clearError("birthDate");
                        }}
                        max={today}
                        aria-label="Tanggal lahir anak"
                        aria-invalid={Boolean(errors.birthDate)}
                        aria-describedby={errors.birthDate ? "tgl-error" : undefined}
                        className={fieldClass}
                      />
                      {errors.birthDate && (
                        <p id="tgl-error" role="alert" className="text-xs text-destructive">
                          {errors.birthDate}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={busy}
                      aria-label="Verifikasi data anak"
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Memverifikasi...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                          Verifikasi Data
                        </>
                      )}
                    </Button>
                  </form>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void register();
                    }}
                    noValidate
                    className="space-y-4"
                  >
                    <div
                      className="rounded-2xl border border-green-200 bg-green-50/80 backdrop-blur-sm dark:border-green-900/40 dark:bg-green-950/20 px-4 py-3 text-sm text-green-800 dark:text-green-300 flex items-center gap-2"
                      role="status"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Data ditemukan: <strong>{studentName}</strong></span>
                    </div>

                    <FormError message={errors.form} />

                    <div className="space-y-2">
                      <Label htmlFor="nama">Nama Anda</Label>
                      <Input
                        id="nama"
                        autoComplete="name"
                        placeholder="Nama orang tua/wali"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          clearError("name");
                        }}
                        autoFocus
                        aria-label="Nama orang tua atau wali"
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? "nama-error" : undefined}
                        className={fieldClass}
                      />
                      {errors.name && (
                        <p id="nama-error" role="alert" className="text-xs text-destructive">
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relation">Hubungan dengan Anak</Label>
                      <select
                        id="relation"
                        value={relation}
                        onChange={(e) => setRelation(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] [color-scheme:light] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 dark:[color-scheme:dark]"
                      >
                        <option value="orangtua">Orang Tua</option>
                        <option value="ayah">Ayah</option>
                        <option value="ibu">Ibu</option>
                        <option value="wali">Wali</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="hp">Nomor HP</Label>
                      <Input
                        id="hp"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="081234567890"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, "").slice(0, 15));
                          clearError("phone");
                        }}
                        maxLength={15}
                        aria-label="Nomor HP orang tua"
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? "hp-error" : "hp-help"}
                        className={fieldClass}
                      />
                      {errors.phone ? (
                        <p id="hp-error" role="alert" className="text-xs text-destructive">
                          {errors.phone}
                        </p>
                      ) : (
                        <p id="hp-help" className="text-xs text-muted-foreground dark:text-muted-foreground">
                          Nomor ini menjadi nama pengguna saat masuk.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pass">Password</Label>
                      <div className="relative">
                        <Input
                          id="pass"
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          placeholder="Minimal 6 karakter"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            clearError("password");
                          }}
                          aria-label="Password akun"
                          aria-invalid={Boolean(errors.password)}
                          aria-describedby={errors.password ? "pass-error" : undefined}
                          className={`${fieldClass} pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                          aria-pressed={showPassword}
                          className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {errors.password && (
                        <p id="pass-error" role="alert" className="text-xs text-destructive">
                          {errors.password}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={backToStep1}
                        disabled={busy}
                        aria-label="Kembali ke langkah verifikasi data anak"
                        className="h-11 rounded-xl active:scale-[0.98] transition-all"
                      >
                        Kembali
                      </Button>
                      <Button
                        type="submit"
                        disabled={busy}
                        aria-label="Buat akun orang tua"
                        className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all"
                      >
                        {busy ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                            Membuat Akun...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                            Buat Akun
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-4 text-center py-4"
                  role="status"
                >
                  <div className="mx-auto bg-gradient-to-br from-secondary to-green-200 dark:from-primary/40 dark:to-green-900/30 p-4 rounded-full w-16 h-16 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-primary dark:text-secondary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground dark:text-foreground">Akun berhasil dibuat</p>
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
                      Masuk memakai nomor HP <strong>{phone}</strong> dan password yang Anda buat.
                    </p>
                  </div>
                  <Button
                    asChild
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all"
                  >
                    <Link href="/login" aria-label="Masuk ke portal orang tua sekarang">
                      <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
                      Masuk Sekarang
                    </Link>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
