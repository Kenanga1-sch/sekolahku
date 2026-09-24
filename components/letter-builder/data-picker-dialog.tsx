"use client";

import { useEffect, useState } from "react";
import { Search, Loader2, User, GraduationCap, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { goGet } from "@/lib/api-client";
import { BULAN_INDO } from "@/lib/letter-render-shared";

/**
 * Dialog pemilih data siswa / guru.
 *
 * Mengambil data dari endpoint backend:
 *   - Siswa : GET /api/master/students/simple-search?q=...
 *   - Guru  : GET /api/master/employees?q=...
 *
 * Mengembalikan kamus variabel `{{siswa_*}}` / `{{guru_*}}` terisi yang siap
 * disuntikkan ke state `vars` editor modular.
 */

export interface StudentRow {
  id: string;
  fullName: string;
  nis?: string;
  nisn?: string;
  className?: string;
  gender?: string;
  birthPlace?: string;
  birthDate?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
}

export interface EmployeeRow {
  id: string;
  name: string;
  nip?: string;
  role?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback saat siswa dipilih. Mengembalikan variabel `siswa_*` terisi. */
  onSelectStudent: (vars: Record<string, string>, recipientName: string) => void;
  /** Callback saat guru dipilih. Mengembalikan variabel `guru_*` terisi. */
  onSelectTeacher: (vars: Record<string, string>, recipientName: string) => void;
}

export function DataPickerDialog({
  open,
  onOpenChange,
  onSelectStudent,
  onSelectTeacher,
}: Props) {
  const [tab, setTab] = useState<"siswa" | "guru">("siswa");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<EmployeeRow[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === "siswa") {
        const res: any = await goGet(
          `/api/master/students/simple-search?q=${encodeURIComponent(search)}`
        );
        setStudents(Array.isArray(res?.data) ? res.data : []);
      } else {
        const res: any = await goGet(
          `/api/master/employees?q=${encodeURIComponent(search)}&limit=30`
        );
        const items = Array.isArray(res?.data) ? res.data : Array.isArray(res?.items) ? res.items : [];
        setTeachers(items);
      }
    } catch {
      toast.error("Gagal memuat data pencarian");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(fetchData, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, search]);

  const handlePickStudent = (s: StudentRow) => {
    let bDateIndo = "";
    if (s.birthDate) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.birthDate);
      if (m) {
        bDateIndo = `${Number(m[3])} ${BULAN_INDO[Number(m[2]) - 1]} ${m[1]}`;
      }
    }
    const vars: Record<string, string> = {
      siswa_nama: s.fullName || "",
      siswa_nis: s.nis || "",
      siswa_nisn: s.nisn || "",
      siswa_kelas: s.className || "",
      siswa_jenis_kelamin: s.gender === "L" ? "Laki-laki" : s.gender === "P" ? "Perempuan" : s.gender || "",
      siswa_tempat_lahir: s.birthPlace || "",
      siswa_tanggal_lahir: s.birthDate || "",
      siswa_tanggal_lahir_indo: bDateIndo,
      siswa_alamat: s.address || "",
      siswa_nama_wali: s.parentName || "",
      siswa_no_hp_wali: s.parentPhone || "",
    };
    onSelectStudent(vars, s.fullName);
    onOpenChange(false);
    toast.success(`Data siswa "${s.fullName}" diterapkan`);
  };

  const handlePickTeacher = (t: EmployeeRow) => {
    const vars: Record<string, string> = {
      guru_nama: t.name || "",
      guru_nip: t.nip || "",
      guru_jabatan: t.role || "Guru",
    };
    onSelectTeacher(vars, t.name);
    onOpenChange(false);
    toast.success(`Data guru "${t.name}" diterapkan`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pilih Data Siswa / Guru</DialogTitle>
          <DialogDescription>
            Cari data untuk mengisi variabel <code className="font-mono text-xs">{"{{siswa_*}}"}</code> atau{" "}
            <code className="font-mono text-xs">{"{{guru_*}}"}</code> secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "siswa" | "guru")}>
            <TabsList className="w-full">
              <TabsTrigger value="siswa" className="flex-1 gap-1.5">
                <GraduationCap className="h-4 w-4" /> Siswa
              </TabsTrigger>
              <TabsTrigger value="guru" className="flex-1 gap-1.5">
                <User className="h-4 w-4" /> Guru / GTK
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === "siswa" ? "Cari nama/NISN/kelas…" : "Cari nama/NIP…"}
              className="pl-8"
              autoFocus
            />
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {loading ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Memuat data…
              </p>
            ) : tab === "siswa" ? (
              students.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Siswa tidak ditemukan. Ketik nama atau NISN.
                </p>
              ) : (
                students.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handlePickStudent(s)}
                    className="flex cursor-pointer items-center justify-between rounded-md border p-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        NISN: {s.nisn || "-"} • Kelas: {s.className || "-"}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="ghost" className="h-7 px-2">
                      <Check className="mr-1 h-3.5 w-3.5" /> Pilih
                    </Button>
                  </div>
                ))
              )
            ) : teachers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Guru/GTK tidak ditemukan. Ketik nama atau NIP.
              </p>
            ) : (
              teachers.map((t) => (
                <div
                  key={t.id}
                  onClick={() => handlePickTeacher(t)}
                  className="flex cursor-pointer items-center justify-between rounded-md border p-2 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      NIP: {t.nip || "-"} {t.role ? `• ${t.role}` : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2">
                    <Check className="mr-1 h-3.5 w-3.5" /> Pilih
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
