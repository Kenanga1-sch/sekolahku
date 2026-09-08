"use client";

import useSWR, { mutate } from "swr";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import {
  Check,
  X,
  RefreshCw,
  MessageCircle,
  Download,
  Search,
} from "lucide-react";

import { DataTable } from "@/components/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goGet, goPatch } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import type { ClassStatsItem, MutasiRequest } from "./types-mutasi";
import { DialogMutasiMasuk } from "./DialogMutasiMasuk";

const fetcher = (url: string) => goGet(url);

export default function TabMutasiMasuk() {
  const { settings: schoolSettings } = useSchoolSettings();

  // Filter States
  const [searchIn, setSearchIn] = useState("");
  const [monthIn, setMonthIn] = useState("all");
  const [gradeIn, setGradeIn] = useState("all");
  const [statusIn, setStatusIn] = useState("all");

  const mutasiInKey = `/api/admin/mutasi?month=${monthIn === "all" ? "" : monthIn}`;

  const { data: dataRequestsIn, error: errorRequestsIn, isLoading: loadingRequestsIn } = useSWR(
    mutasiInKey,
    fetcher
  );
  const { data: dataStats } = useSWR("/api/classes/stats", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000, // cache 1 menit — jarang berubah
  });

  const requestsIn: MutasiRequest[] = dataRequestsIn?.data || [];
  const classStats: ClassStatsItem[] = dataStats?.data || [];

  const [openRequestIdIn, setOpenRequestIdIn] = useState<string | null>(null);
  const [isUpdatingIn, setIsUpdatingIn] = useState(false);
  const [targetClass, setTargetClass] = useState<string>("");

  const filteredRequestsIn = useMemo(() => {
    return requestsIn.filter((req) => {
      if (searchIn.trim() !== "") {
        const q = searchIn.toLowerCase();
        const matchesName = (req.studentName || "").toLowerCase().includes(q);
        const matchesNisn = (req.nisn || "").toLowerCase().includes(q);
        const matchesReg = (req.registrationNumber || "").toLowerCase().includes(q);
        const matchesSchool = (req.originSchool || "").toLowerCase().includes(q);
        if (!matchesName && !matchesNisn && !matchesReg && !matchesSchool) return false;
      }
      if (gradeIn !== "all") {
        if (String(req.targetGrade) !== gradeIn) return false;
      }
      if (statusIn !== "all") {
        if (req.statusApproval !== statusIn) return false;
      }
      return true;
    });
  }, [requestsIn, searchIn, gradeIn, statusIn]);

  const handleUpdateStatusIn = async (
    id: string,
    newStatus: string,
    targetClassId?: string
  ) => {
    setIsUpdatingIn(true);
    try {
      const payload: Record<string, string> = { statusApproval: newStatus };
      if (targetClassId) payload.targetClassId = targetClassId;

      await goPatch(`/api/admin/mutasi/${id}`, payload);

      toast.success("Status berhasil diperbarui");
      mutate(mutasiInKey);
      setOpenRequestIdIn(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui status");
    } finally {
      setIsUpdatingIn(false);
    }
  };

  const schoolCity = useMemo(() => {
    const addr = String(schoolSettings?.school_address || "");
    const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      const cleaned = p.replace(/^(kabupaten|kab\.|kota)\s+/i, "");
      if (cleaned && !/^jl\b|^jalan\b/i.test(cleaned)) return cleaned;
    }
    return "";
  }, [schoolSettings]);

  const generatePDF = async (req: MutasiRequest) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("SURAT KETERANGAN PENERIMAAN", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("MUTASI MASUK PESERTA DIDIK", 105, 28, { align: "center" });

    doc.setFontSize(11);
    doc.text(`Nomor Registrasi: ${req.registrationNumber}`, 20, 50);
    doc.text(`Yang bertanda tangan di bawah ini Kepala Sekolah ${schoolSettings?.school_name || "..."} menerangkan bahwa:`, 20, 70, { maxWidth: 170 });

    const startY = 80;
    doc.text(`Nama Siswa`, 20, startY);
    doc.text(`: ${req.studentName}`, 60, startY);

    doc.text(`NISN`, 20, startY + 10);
    doc.text(`: ${req.nisn}`, 60, startY + 10);

    doc.text(`Asal Sekolah`, 20, startY + 20);
    doc.text(`: ${req.originSchool}`, 60, startY + 20);

    doc.text(`Diterima di Kelas`, 20, startY + 30);
    const assignedClass = classStats.find((c) => c.id === req.targetClassId)?.name || "-";
    doc.text(`: ${assignedClass}`, 60, startY + 30);

    doc.text("Telah kami SETUJUI untuk diterima sebagai siswa pindahan di sekolah kami.", 20, startY + 50, { maxWidth: 170 });

    doc.text(`${schoolCity ? schoolCity + ", " : ""}${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`, 140, startY + 70);
    doc.text("Kepala Sekolah", 140, startY + 80);

    doc.text("( ...................... )", 140, startY + 100);

    doc.save(`Surat_Penerimaan_${req.studentName}.pdf`);
  };

  const currentClassStats = targetClass
    ? classStats.find((c) => c.id === targetClass)
    : null;

  return (
    <Card>
      {/* Filter Bar */}
      <div className="p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NISN, no reg..."
              value={searchIn}
              onChange={(e) => setSearchIn(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <Input
            type="month"
            value={monthIn === "all" ? "" : monthIn}
            onChange={(e) => setMonthIn(e.target.value || "all")}
            className="w-full sm:w-[150px] h-9 text-xs"
            title="Filter Bulan & Tahun"
          />

          <Select value={gradeIn} onValueChange={setGradeIn}>
            <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
              <SelectValue placeholder="Semua Kelas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kelas</SelectItem>
              {[1, 2, 3, 4, 5, 6].map((g) => (
                <SelectItem key={g} value={String(g)}>Kelas {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusIn} onValueChange={setStatusIn}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="principal_approved">Disetujui / Selesai</SelectItem>
              <SelectItem value="verified">Terverifikasi</SelectItem>
              <SelectItem value="pending">Menunggu (Pending)</SelectItem>
              <SelectItem value="rejected">Ditolak</SelectItem>
            </SelectContent>
          </Select>

          {(searchIn || monthIn !== "all" || gradeIn !== "all" || statusIn !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchIn("");
                setMonthIn("all");
                setGradeIn("all");
                setStatusIn("all");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
          <span className="text-xs text-muted-foreground">
            Total: <strong>{filteredRequestsIn.length}</strong> mutasi
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                mutate(mutasiInKey);
                mutate("/api/classes/stats");
              }}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DialogMutasiMasuk classStats={classStats} />
          </div>
        </div>
      </div>

      <DataTable
        data={loadingRequestsIn ? [] : filteredRequestsIn}
        getRowId={(req) => req.id}
        loading={loadingRequestsIn}
        emptyTitle={errorRequestsIn ? "Gagal memuat riwayat mutasi masuk." : "Tidak ada data mutasi masuk yang sesuai filter."}
        emptyDescription={errorRequestsIn ? "Terjadi kesalahan saat memuat data. Coba refresh." : "Data pendaftaran mutasi masuk akan muncul di sini."}
        columns={[
          {
            key: "createdAt",
            header: "Tgl Masuk",
            hideBelowSm: true,
            card: "field",
            render: (req) =>
              req.createdAt ? format(new Date(req.createdAt), "dd/MM/yyyy") : "-",
          },
          {
            key: "registrationNumber",
            header: "No. Registrasi",
            hideBelowSm: true,
            card: "hidden",
            render: (req) => <span className="font-mono text-xs">{req.registrationNumber}</span>,
          },
          {
            key: "studentName",
            header: "Nama Siswa",
            card: "title",
            render: (req) => (
              <div>
                <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                <div className="text-xs text-muted-foreground">Asal: {req.originSchool}</div>
              </div>
            ),
          },
          {
            key: "targetGrade",
            header: "Kelas Tujuan",
            card: "field",
            render: (req) => `Kelas ${req.targetGrade}`,
          },
          {
            key: "statusApproval",
            header: "Status",
            card: "field",
            render: (req) => (
              <div className="flex flex-col gap-1 items-start">
                <Badge variant={
                  req.statusApproval === "principal_approved" ? "default" :
                  req.statusApproval === "rejected" ? "destructive" :
                  req.statusApproval === "verified" ? "secondary" : "outline"
                }>
                  {req.statusApproval === "principal_approved" ? "Disetujui" :
                   req.statusApproval === "rejected" ? "Ditolak" :
                   req.statusApproval === "verified" ? "Terverifikasi" : "Menunggu"}
                </Badge>
                {req.statusDelivery === "direct" && (
                  <span className="text-[10px] text-muted-foreground font-mono">Input Langsung</span>
                )}
              </div>
            ),
          },
        ]}
        actions={(req) => (
                  <Dialog open={openRequestIdIn === req.id} onOpenChange={(open) => {
                    if (open) {
                      setOpenRequestIdIn(req.id);
                      setTargetClass(req.targetClassId || "");
                    } else {
                      setOpenRequestIdIn(null);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">Detail</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl">
                      <DialogHeader>
                        <DialogTitle>Detail Mutasi Masuk</DialogTitle>
                        <DialogDescription>
                          {req.registrationNumber} - {req.studentName}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                          <h3 className="font-semibold border-b">Data Siswa</h3>
                          <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">NISN:</span>
                            <span>{req.nisn || "-"}</span>
                            <span className="text-muted-foreground">JK:</span>
                            <span>{req.gender === "L" ? "Laki-laki" : "Perempuan"}</span>
                            <span className="text-muted-foreground">Sekolah Asal:</span>
                            <div>
                              <div>{req.originSchool}</div>
                              {req.originSchoolAddress && (
                                <div className="text-xs text-muted-foreground">{req.originSchoolAddress}</div>
                              )}
                            </div>
                            <span className="text-muted-foreground">Kelas Tujuan:</span>
                            <span>Kelas {req.targetGrade}</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h3 className="font-semibold border-b">Data Orang Tua / Kontak</h3>
                          <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">Nama:</span>
                            <span>{req.parentName || "-"}</span>
                            <span className="text-muted-foreground">WhatsApp:</span>
                            {req.whatsappNumber && req.whatsappNumber !== "-" ? (
                              <a
                                href={`https://wa.me/${req.whatsappNumber}`}
                                target="_blank"
                                className="text-green-600 hover:underline flex items-center"
                              >
                                {req.whatsappNumber} <MessageCircle className="h-3 w-3 ml-1" />
                              </a>
                            ) : (
                              <span>-</span>
                            )}
                          </div>

                          {req.statusApproval === "principal_approved" && (
                            <div className="mt-4 p-4 bg-muted rounded-md">
                              <h4 className="font-semibold mb-2">Dokumen</h4>
                              <Button size="sm" onClick={() => generatePDF(req)}>
                                <Download className="mr-2 h-4 w-4" /> Download Surat
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Admin Action Area */}
                      <div className="border-t pt-4 space-y-4">
                        <h3 className="font-semibold">Tindak Lanjut</h3>

                        {req.statusApproval === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleUpdateStatusIn(req.id, "verified")}
                              disabled={isUpdatingIn}
                            >
                              <Check className="mr-2 h-4 w-4" /> Verifikasi Dokumen
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleUpdateStatusIn(req.id, "rejected")}
                              disabled={isUpdatingIn}
                            >
                              <X className="mr-2 h-4 w-4" /> Tolak
                            </Button>
                          </div>
                        )}

                        {req.statusApproval === "verified" && (
                          <div className="flex flex-col gap-4">
                            <div className="space-y-2">
                              <Label>Pilih Kelas Penempatan</Label>
                              <Select value={targetClass} onValueChange={setTargetClass}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih Kelas" />
                                </SelectTrigger>
                                <SelectContent>
                                  {classStats
                                    .filter((c) => c.grade === req.targetGrade)
                                    .map((c) => (
                                      <SelectItem key={c.id} value={c.id}>
                                        {c.name} ({c.studentCount}/{c.capacity})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              {currentClassStats && (
                                <p className={`text-xs ${currentClassStats.studentCount >= currentClassStats.capacity ? "text-red-500" : "text-green-600"}`}>
                                  Sisa Kuota: {currentClassStats.capacity - currentClassStats.studentCount}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleUpdateStatusIn(req.id, "principal_approved", targetClass)}
                                disabled={isUpdatingIn || !targetClass}
                              >
                                <Check className="mr-2 h-4 w-4" /> Setujui (Kepsek)
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => handleUpdateStatusIn(req.id, "rejected")}
                                disabled={isUpdatingIn}
                              >
                                <X className="mr-2 h-4 w-4" /> Tolak
                              </Button>
                            </div>
                          </div>
                        )}

                        {req.statusApproval === "principal_approved" && (
                          <div className="flex items-center gap-2 text-green-600">
                            <Check className="h-5 w-5" /> Mutasi telah disetujui/dicatat. Silakan unduh surat keterangan jika diperlukan.
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
        )}
      />
    </Card>
  );
}
