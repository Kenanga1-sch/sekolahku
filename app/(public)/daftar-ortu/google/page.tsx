"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Reveal } from "@/components/public/motion";
import { useAuthStore } from "@/lib/stores/auth-store";
import {
  completeGoogleSignupAction,
  getGooglePendingAction,
  type GooglePendingInfo,
} from "@/actions/auth";

const fieldClass = "h-11 rounded-xl";

const benefits = [
  { icon: ShieldCheck, title: "Kehadiran Harian", desc: "Pantau presensi anak setiap hari secara langsung." },
  { icon: KeyRound, title: "Tabungan Siswa", desc: "Lihat mutasi saldo tabungan anak secara transparan." },
  { icon: UserPlus, title: "Satu Akun, Semua Anak", desc: "Beberapa anak dapat ditautkan ke akun yang sama." },
];

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function DaftarOrtuGooglePage() {
  const { refreshSession } = useAuthStore();

  const [pending, setPending] = useState<GooglePendingInfo | null>(null);
  const [checking, setChecking] = useState(true);

  const [nisn, setNisn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [relation, setRelation] = useState("orangtua");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ nisn?: string; birthDate?: string }>({});

  const today = todayISO();

  useEffect(() => {
    let alive = true;
    (async () => {
      const info = await getGooglePendingAction();
      if (!alive) return;
      setPending(info);
      setChecking(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (busy) return;

    const next: { nisn?: string; birthDate?: string } = {};
    if (!/^\d{10}$/.test(nisn)) next.nisn = "NISN harus tepat 10 digit angka.";
    if (!birthDate) next.birthDate = "Tanggal lahir wajib diisi.";
    else if (birthDate > today) next.birthDate = "Tanggal lahir tidak boleh di masa depan.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const res = await completeGoogleSignupAction({ nisn, birthDate, relation });
      if (res.success) {
        await refreshSession();
        window.location.href = res.redirect || "/parent";
        return;
      }
      setError(res.error || "Gagal menyelesaikan pendaftaran.");
    } catch (err: any) {
      setError(err?.message || "Gagal menyelesaikan pendaftaran. Coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-[80dvh] flex items-start justify-center px-4 py-12 md:py-20 bg-public-bg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/30 via-public-bg to-public-bg dark:from-primary/20 dark:via-transparent dark:to-transparent" />
      <div className="absolute -top-24 -right-24 w-[40vw] h-[40vw] max-w-[440px] max-h-[440px] rounded-full bg-secondary/20 dark:bg-primary/20 blur-[80px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6 lg:pt-2">
          <Reveal>
            <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider dark:bg-secondary/10 dark:text-secondary dark:border-secondary/20">
              Portal Orang Tua
            </Badge>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-[1.15]">
              Satu Langkah Lagi
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="text-base text-muted-foreground leading-relaxed max-w-[55ch]">
              Akun Google Anda sudah terverifikasi. Untuk menjaga keamanan data siswa,
              verifikasi dulu NISN dan tanggal lahir anak sebelum akun ditautkan.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <ul className="space-y-3">
              {benefits.map((b) => (
                <li
                  key={b.title}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-public-border shadow-sm dark:bg-white/5 dark:border-white/10"
                >
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-secondary text-primary flex items-center justify-center dark:bg-primary/40 dark:text-secondary">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{b.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{b.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.32}>
            <p className="text-xs text-muted-foreground">
              Bukan orang tua siswa?{" "}
              <Link href="/login" className="font-semibold text-primary underline underline-offset-4 hover:no-underline">
                Kembali ke halaman masuk
              </Link>
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12} className="lg:col-span-3">
          <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white/60 shadow-xl shadow-primary/5 dark:bg-white/5 dark:border-white/10 dark:shadow-black/20 overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-public-border/60 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white flex items-center justify-center shadow-lg shadow-primary/25">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Verifikasi Data Anak
                  </p>
                  <h2 className="font-semibold text-foreground">
                    {pending ? pending.email : "Menyiapkan…"}
                  </h2>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              {checking ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Memeriksa sesi Google…
                </div>
              ) : !pending ? (
                <div className="space-y-4 py-4 text-center" role="alert">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">Sesi Google tidak ditemukan</p>
                    <p className="text-sm text-muted-foreground">
                      Sesi pendaftaran sudah kedaluwarsa atau dibuka di perangkat lain.
                      Silakan ulangi dari halaman masuk.
                    </p>
                  </div>
                  <Button asChild className="h-11 w-full rounded-xl">
                    <Link href="/login">Kembali ke halaman masuk</Link>
                  </Button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit();
                    }}
                    noValidate
                    className="space-y-4"
                  >
                    {error && (
                      <div
                        role="alert"
                        className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <p>{error}</p>
                        </div>
                      </div>
                    )}

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
                          setFieldErrors((prev) => ({ ...prev, nisn: undefined }));
                        }}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        autoFocus
                        aria-invalid={Boolean(fieldErrors.nisn)}
                        className={fieldClass}
                      />
                      {fieldErrors.nisn ? (
                        <p role="alert" className="text-xs text-destructive">
                          {fieldErrors.nisn}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
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
                          setFieldErrors((prev) => ({ ...prev, birthDate: undefined }));
                        }}
                        max={today}
                        aria-invalid={Boolean(fieldErrors.birthDate)}
                        className={fieldClass}
                      />
                      {fieldErrors.birthDate && (
                        <p role="alert" className="text-xs text-destructive">
                          {fieldErrors.birthDate}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="relation">Hubungan dengan Anak</Label>
                      <Select value={relation} onValueChange={setRelation}>
                        <SelectTrigger id="relation" className="h-11 w-full rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="orangtua">Orang Tua</SelectItem>
                          <SelectItem value="ayah">Ayah</SelectItem>
                          <SelectItem value="ibu">Ibu</SelectItem>
                          <SelectItem value="wali">Wali</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      type="submit"
                      disabled={busy}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-primary-hover text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 active:scale-[0.98] transition-all"
                    >
                      {busy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Memverifikasi…
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
                          Verifikasi &amp; Masuk
                        </>
                      )}
                    </Button>

                    <p className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden="true" />
                      Akun yang sudah ada untuk siswa ini akan ditautkan otomatis — tidak ada akun ganda.
                      Akun Google-only tidak memakai password; Anda bisa membuat password kapan saja
                      lewat menu Lupa Password.
                    </p>
                  </form>
                </motion.div>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
