"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2, FileText, CheckCircle, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { generateMutasiKeluarPDF } from "@/lib/mutasi-pdf";
import {
  createMutasiKeluarAction,
  getChildrenAction,
  listMutasiKeluarAction,
} from "@/actions/parent";
import { cn } from "@/lib/utils";

interface Child {
  studentId: string;
  fullName: string;
  className?: string;
  nisn?: string;
}

interface MutasiOut {
  id: string;
  studentId: string;
  studentName?: string;
  className?: string;
  destinationSchool: string;
  destinationClass?: string | null;
  letterNo?: string | null;
  reason: string;
  reasonDetail?: string | null;
  status: string; // draft | processed | completed
  createdAt?: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Menunggu Diproses",
  processed: "Sedang Diproses",
  completed: "Selesai",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  processed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const REASON_LABEL: Record<string, string> = {
  domisili: "Pindah Domisili",
  tugas_orangtua: "Mengikuti Tugas Orang Tua",
  lainnya: "Lainnya",
};

const schema = z.object({
  destinationSchool: z.string().min(3, "Nama sekolah tujuan minimal 3 karakter"),
  destinationClass: z.string().optional(),
  reason: z.enum(["domisili", "tugas_orangtua", "lainnya"]),
  reasonDetail: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function ParentMutasiClientPage() {
  const { user } = useAuthStore();
  const { settings } = useSchoolSettings();
  const [children, setChildren] = useState<Child[]>([]);
  const [requests, setRequests] = useState<MutasiOut[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { destinationSchool: "", destinationClass: "", reason: "domisili", reasonDetail: "" },
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [childRes, mutasiRes] = await Promise.all([
        getChildrenAction(),
        listMutasiKeluarAction(),
      ]);
      if (childRes.success) {
        const d = childRes.data as { data?: Child[] };
        const list = d.data || (childRes.data as Child[]) || [];
        setChildren(list);
        if (list.length > 0) setSelectedId(list[0].studentId);
      } else {
        toast.error(childRes.error || "Gagal memuat data anak");
      }
      if (mutasiRes.success) {
        const d = mutasiRes.data as { data?: MutasiOut[] };
        setRequests(d.data || (mutasiRes.data as MutasiOut[]) || []);
      }
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedChild = children.find((c) => c.studentId === selectedId);
  const childRequests = requests.filter((r) => r.studentId === selectedId);
  const activeRequest = childRequests.find((r) => r.status === "draft" || r.status === "processed");

  const schoolCity = (() => {
    const addr = String(settings?.school_address || "");
    const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const cleaned = p.replace(/^(kabupaten|kab\.|kota)\s+/i, "");
      if (cleaned && !/^jl\b|^jalan\b/i.test(cleaned)) return cleaned;
    }
    return "";
  })();

  const onSubmit = async (values: FormValues) => {
    if (!selectedChild) return;
    setSubmitting(true);
    try {
      const res = await createMutasiKeluarAction({
        studentId: selectedChild.studentId,
        destinationSchool: values.destinationSchool,
        destinationClass: values.destinationClass,
        reason: values.reason,
        reasonDetail: values.reason === "lainnya" ? values.reasonDetail : undefined,
      });
      if (!res.success) {
        toast.error(res.error || "Gagal membuat permohonan");
        return;
      }
      // Unduh surat permohonan (PDF dibuat di klien).
      await generateMutasiKeluarPDF({
        student: {
          fullName: selectedChild.fullName,
          nisn: selectedChild.nisn || "",
          className: selectedChild.className,
          parentName: user?.name,
        },
        destinationSchool: values.destinationSchool,
        destinationClass: values.destinationClass,
        reason: values.reason,
        reasonDetail: values.reasonDetail,
        schoolName: settings?.school_name || "Sekolah",
        schoolCity,
      });
      setDone(true);
      await loadData();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold">Mutasi Keluar</h1>
          <p className="text-sm text-muted-foreground">Pengajuan pindah sekolah untuk anak Anda.</p>
        </div>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini. Hubungi sekolah untuk menautkan akun Anda.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Mutasi Keluar</h1>
        <p className="text-sm text-muted-foreground">Buat surat permohonan pindah sekolah untuk anak Anda.</p>
      </div>

      {/* Child selector */}
      <div className="flex flex-wrap gap-2">
        {children.map((c) => (
          <button
            key={c.studentId}
            onClick={() => {
              setSelectedId(c.studentId);
              setDone(false);
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              selectedId === c.studentId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {c.fullName}
          </button>
        ))}
      </div>

      {/* Status permohonan yang sudah ada */}
      {childRequests.length > 0 && (
        <div className="space-y-2">
          {childRequests.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-sm">{r.destinationSchool}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      STATUS_STYLE[r.status] || "bg-muted text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alasan: {REASON_LABEL[r.reason] || r.reason}
                  {r.letterNo ? ` · No. Surat: ${r.letterNo}` : ""}
                </p>
                {r.status !== "completed" && (
                  <p className="text-xs text-muted-foreground">
                    Sekolah sedang memproses surat keterangan pindah. Anda akan dinotifikasi saat selesai.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {done ? (
        <Card className="border-t-4 border-t-green-500">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <h3 className="font-bold text-green-700 dark:text-green-400">Berhasil!</h3>
              <p className="text-sm text-muted-foreground">
                Surat permohonan telah terunduh dan tercatat di sistem sekolah.
              </p>
            </div>
            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
              <CardContent className="pt-4 space-y-1.5">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-400 text-sm">Langkah Selanjutnya:</h4>
                <ul className="list-disc list-inside text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>Cetak surat yang baru saja diunduh.</li>
                  <li>Tempelkan <strong>Meterai 10.000</strong> pada kolom yang tersedia.</li>
                  <li>Tanda tangani surat tersebut (Orang Tua/Wali).</li>
                  <li>Serahkan ke Tata Usaha sekolah untuk mengurus Surat Keterangan Pindah (Dapodik).</li>
                </ul>
              </CardContent>
            </Card>
            <Button variant="outline" className="w-full" onClick={() => setDone(false)}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      ) : activeRequest ? (
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Pengajuan sedang berjalan</p>
            <p className="text-xs text-muted-foreground">
              Anak ini masih punya permohonan mutasi keluar yang belum selesai. Tunggu hingga selesai untuk membuat
              permohonan baru.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ArrowRightLeft className="h-5 w-5 text-primary" /> Formulir Permohonan
            </CardTitle>
            <CardDescription>
              {selectedChild?.fullName} — {selectedChild?.className || "Kelas belum diisi"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="destinationSchool">Sekolah Tujuan</Label>
                <Input
                  id="destinationSchool"
                  placeholder="Nama Sekolah Baru"
                  {...form.register("destinationSchool")}
                />
                {form.formState.errors.destinationSchool && (
                  <p className="text-xs text-destructive">{form.formState.errors.destinationSchool.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="destinationClass">Kelas Tujuan (opsional)</Label>
                <Input id="destinationClass" placeholder="Mis. Kelas 5A" {...form.register("destinationClass")} />
              </div>

              <div className="space-y-1.5">
                <Label>Alasan Pindah</Label>
                <Select
                  value={form.watch("reason")}
                  onValueChange={(v) => form.setValue("reason", v as FormValues["reason"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih alasan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="domisili">Pindah Domisili</SelectItem>
                    <SelectItem value="tugas_orangtua">Mengikuti Tugas Orang Tua</SelectItem>
                    <SelectItem value="lainnya">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.watch("reason") === "lainnya" && (
                <div className="space-y-1.5">
                  <Label htmlFor="reasonDetail">Detail Alasan</Label>
                  <Input
                    id="reasonDetail"
                    placeholder="Jelaskan alasan lain..."
                    {...form.register("reasonDetail", {
                      validate: (v) => (v && v.trim().length > 0) || "Detail alasan wajib diisi",
                    })}
                  />
                  {form.formState.errors.reasonDetail && (
                    <p className="text-xs text-destructive">{form.formState.errors.reasonDetail.message}</p>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" /> Buat Surat Permohonan
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
