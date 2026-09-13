"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Search, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerParentAction, verifyStudentAction } from "@/actions/parent";

export default function DaftarOrtuPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [busy, setBusy] = useState(false);

  const [nisn, setNisn] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studentName, setStudentName] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const verify = async () => {
    if (nisn.trim().length < 10) {
      toast.error("NISN harus 10 digit");
      return;
    }
    if (!birthDate) {
      toast.error("Tanggal lahir wajib diisi");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyStudentAction(nisn.trim(), birthDate);
      if (res.success) {
        setStudentName((res.data as { studentName?: string })?.studentName || "Siswa");
        setStep(2);
      } else {
        toast.error(res.error || "Data siswa tidak ditemukan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memverifikasi data");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (name.trim().length < 3) {
      toast.error("Nama minimal 3 karakter");
      return;
    }
    if (!/^08\d{8,13}$/.test(phone.trim())) {
      toast.error("Nomor HP tidak valid (contoh: 081234567890)");
      return;
    }
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setBusy(true);
    try {
      const res = await registerParentAction({
        nisn: nisn.trim(),
        birthDate,
        name: name.trim(),
        phone: phone.trim(),
        password,
      });
      if (res.success) {
        setStep(3);
      } else {
        toast.error(res.error || "Gagal membuat akun");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal membuat akun");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70dvh] flex items-start justify-center px-4 py-10 bg-public-bg">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#065F46]" /> Daftar Akun Orang Tua
          </CardTitle>
          <CardDescription>
            Pantau kehadiran, tabungan, dan pengumuman anak dalam satu akun.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nisn">NISN Anak</Label>
                <Input id="nisn" inputMode="numeric" placeholder="10 digit NISN" value={nisn} onChange={(e) => setNisn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tgl">Tanggal Lahir Anak</Label>
                <Input id="tgl" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <Button className="w-full" onClick={verify} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Verifikasi Data
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Sudah punya akun? <Link href="/login" className="underline font-medium">Masuk di sini</Link>
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20 px-4 py-3 text-sm text-green-800 dark:text-green-300">
                Data ditemukan: <strong>{studentName}</strong>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama">Nama Anda</Label>
                <Input id="nama" placeholder="Nama orang tua/wali" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hp">Nomor HP</Label>
                <Input id="hp" inputMode="tel" placeholder="081234567890" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <p className="text-xs text-muted-foreground">Nomor ini menjadi nama pengguna saat masuk.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass">Password</Label>
                <Input id="pass" type="password" placeholder="Minimal 6 karakter" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} disabled={busy}>Kembali</Button>
                <Button className="flex-1" onClick={register} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Buat Akun
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-semibold">Akun berhasil dibuat</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Masuk memakai nomor HP <strong>{phone}</strong> dan password yang Anda buat.
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Masuk Sekarang</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
