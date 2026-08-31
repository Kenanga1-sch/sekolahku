"use client";

import useSWR, { mutate } from "swr";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Loader2,
  Building,
  CheckCircle,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goGet, goPatch } from "@/lib/api-client";
import type { MutasiRequest, LiabilityData } from "./types-mutasi";
import { DialogMutasiKeluar } from "./DialogMutasiKeluar";

const fetcher = (url: string) => goGet(url);

export default function TabMutasiKeluar() {
  // Filter States
  const [searchOut, setSearchOut] = useState("");
  const [monthOut, setMonthOut] = useState("all");
  const [gradeOut, setGradeOut] = useState("all");
  const [statusOut, setStatusOut] = useState("all");

  const mutasiOutKey = `/api/admin/mutasi-keluar?month=${monthOut === "all" ? "" : monthOut}`;

  const { data: dataRequestsOut, error: errorRequestsOut, isLoading: loadingRequestsOut } = useSWR(
    mutasiOutKey,
    fetcher
  );

  const requestsOut: MutasiRequest[] = dataRequestsOut?.data || [];

  const [selectedRequestOut, setSelectedRequestOut] = useState<MutasiRequest | null>(null);
  const [openRequestIdOut, setOpenRequestIdOut] = useState<string | null>(null);
  const [liabilityData, setLiabilityData] = useState<LiabilityData | null>(null);
  const [checkingLiability, setCheckingLiability] = useState(false);
  const [updatingOut, setUpdatingOut] = useState(false);

  const filteredRequestsOut = useMemo(() => {
    return requestsOut.filter((req) => {
      if (searchOut.trim() !== "") {
        const q = searchOut.toLowerCase();
        const matchesName = (req.studentName || "").toLowerCase().includes(q);
        const matchesNisn = (req.nisn || "").toLowerCase().includes(q);
        const matchesLetter = (req.letterNo || "").toLowerCase().includes(q);
        const matchesSchool = (req.destinationSchool || "").toLowerCase().includes(q);
        if (!matchesName && !matchesNisn && !matchesLetter && !matchesSchool) return false;
      }
      if (gradeOut !== "all") {
        const className = (req.className || "").toLowerCase();
        if (!className.includes(`kelas ${gradeOut}`) && !className.includes(`${gradeOut}`)) return false;
      }
      if (statusOut !== "all") {
        if (req.status !== statusOut) return false;
      }
      return true;
    });
  }, [requestsOut, searchOut, gradeOut, statusOut]);

  const handleOpenDetailOut = async (req: MutasiRequest) => {
    setSelectedRequestOut(req);
    setCheckingLiability(true);
    setLiabilityData(null);

    try {
      const result = await goGet<{ success: boolean; data?: LiabilityData }>(`/api/admin/mutasi-keluar/${req.id}/check`);
      if (result.success) {
        setLiabilityData(result.data ?? null);
      }
    } catch (e) {
      console.error(e);
      toast.error("Gagal mengecek tanggungan siswa");
    } finally {
      setCheckingLiability(false);
    }
  };

  const updateStatusOut = async (id: string, newStatus: string) => {
    setUpdatingOut(true);
    try {
      await goPatch(`/api/admin/mutasi-keluar/${id}`, { status: newStatus });

      toast.success("Status berhasil diperbarui");
      mutate(mutasiOutKey);
      setOpenRequestIdOut(null);
      setSelectedRequestOut(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui status");
    } finally {
      setUpdatingOut(false);
    }
  };

  return (
    <Card>
      {/* Filter Bar */}
      <div className="p-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 dark:bg-zinc-900/50">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, NISN, no surat..."
              value={searchOut}
              onChange={(e) => setSearchOut(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>

          <Input
            type="month"
            value={monthOut === "all" ? "" : monthOut}
            onChange={(e) => setMonthOut(e.target.value || "all")}
            className="w-full sm:w-[150px] h-9 text-xs"
            title="Filter Bulan & Tahun"
          />

          <Select value={gradeOut} onValueChange={setGradeOut}>
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

          <Select value={statusOut} onValueChange={setStatusOut}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 text-xs">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
              <SelectItem value="processed">Diproses</SelectItem>
              <SelectItem value="draft">Draft / Baru</SelectItem>
            </SelectContent>
          </Select>

          {(searchOut || monthOut !== "all" || gradeOut !== "all" || statusOut !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchOut("");
                setMonthOut("all");
                setGradeOut("all");
                setStatusOut("all");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset Filter
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0">
          <span className="text-xs text-muted-foreground">
            Total: <strong>{filteredRequestsOut.length}</strong> mutasi
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => mutate(mutasiOutKey)}
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DialogMutasiKeluar />
          </div>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden sm:table-cell">Tanggal</TableHead>
            <TableHead className="hidden sm:table-cell">NISN</TableHead>
            <TableHead>Nama Siswa</TableHead>
            <TableHead>Sekolah Tujuan</TableHead>
            <TableHead className="hidden md:table-cell">Alasan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loadingRequestsOut ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </TableCell>
            </TableRow>
          ) : errorRequestsOut ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-destructive">
                Gagal memuat mutasi keluar.
              </TableCell>
            </TableRow>
          ) : filteredRequestsOut.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Tidak ada data mutasi keluar yang sesuai filter.
              </TableCell>
            </TableRow>
          ) : (
            filteredRequestsOut.map((req) => (
              <TableRow key={req.id}>
                <TableCell className="hidden sm:table-cell">
                  {req.createdAt ? format(new Date(req.createdAt), "dd/MM/yyyy") : "-"}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{req.nisn || "-"}</TableCell>
                <TableCell>
                  <div className="font-semibold text-slate-800 dark:text-zinc-200">{req.studentName}</div>
                  <div className="text-xs text-muted-foreground">{req.className}</div>
                </TableCell>
                <TableCell>{req.destinationSchool}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {req.reason === "domisili" ? "Pindah Domisili" :
                   req.reason === "tugas_orangtua" ? "Tugas Ortu" : (req.reason || "Lainnya")}
                </TableCell>
                <TableCell>
                  <Badge variant={
                    req.status === "completed" ? "default" :
                    req.status === "processed" ? "secondary" : "outline"
                  }>
                    {req.status === "draft" ? "Draft/Baru" :
                     req.status === "processed" ? "Diproses" : "Selesai"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Dialog open={openRequestIdOut === req.id} onOpenChange={(open) => {
                    if (open) {
                      setOpenRequestIdOut(req.id);
                      handleOpenDetailOut(req);
                    } else {
                      setOpenRequestIdOut(null);
                      setSelectedRequestOut(null);
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">Tindak Lanjut</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Detail Mutasi Keluar</DialogTitle>
                        <DialogDescription>
                          Tinjau status tanggungan siswa sebelum memproses mutasi.
                        </DialogDescription>
                      </DialogHeader>

                      {selectedRequestOut && (
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-4 rounded-lg">
                            <div>
                              <span className="text-muted-foreground block">Nama Siswa:</span>
                              <span className="font-semibold">{selectedRequestOut.studentName}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">NISN:</span>
                              <span className="font-semibold">{selectedRequestOut.nisn}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Sekolah Tujuan:</span>
                              <span className="font-semibold">{selectedRequestOut.destinationSchool}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block">Alasan:</span>
                              <span className="font-semibold">{selectedRequestOut.reasonDetail || selectedRequestOut.reason}</span>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <h3 className="font-semibold border-b pb-2">Cek Tanggungan</h3>
                            {checkingLiability ? (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa data...
                              </div>
                            ) : liabilityData ? (
                              <div className="grid grid-cols-2 gap-4">
                                <Card className="p-4 border-l-4 border-l-blue-500">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Building className="h-4 w-4 text-blue-500" />
                                    <span className="font-medium">Perpustakaan</span>
                                  </div>
                                  <div className="text-2xl font-bold">
                                    {liabilityData.library?.activeLoans ?? 0}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Buku belum kembali</div>
                                  <Badge className="mt-2" variant={liabilityData.library?.status === "Clear" ? "default" : "destructive"}>
                                    {liabilityData.library?.status}
                                  </Badge>
                                </Card>
                                <Card className="p-4 border-l-4 border-l-green-500">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Building className="h-4 w-4 text-green-500" />
                                    <span className="font-medium">Tabungan</span>
                                  </div>
                                  <div className="text-2xl font-bold">
                                    Rp {(liabilityData.financial?.balance ?? 0).toLocaleString("id-ID")}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Saldo tersisa</div>
                                  <Badge className="mt-2" variant={liabilityData.financial?.status === "Clear" ? "default" : "secondary"}>
                                    {liabilityData.financial?.status}
                                  </Badge>
                                </Card>
                              </div>
                            ) : (
                              <p className="text-red-500">Gagal mengambil data.</p>
                            )}
                          </div>

                          <div className="flex justify-end gap-3 pt-4 border-t">
                            <Button variant="outline" onClick={() => {
                              setOpenRequestIdOut(null);
                              setSelectedRequestOut(null);
                            }}>Tutup</Button>

                            {selectedRequestOut.status !== "completed" && (
                              <>
                                {selectedRequestOut.status === "draft" && (
                                  <Button
                                    onClick={() => updateStatusOut(selectedRequestOut.id, "processed")}
                                    disabled={updatingOut}
                                  >
                                    Tandai Diproses
                                  </Button>
                                )}
                                {selectedRequestOut.status === "processed" && (
                                  <Button
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => updateStatusOut(selectedRequestOut.id, "completed")}
                                    disabled={updatingOut}
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" /> Selesai (Mutasi Keluar)
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
