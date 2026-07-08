"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Loader2, 
  Check, 
  X, 
  RefreshCw, 
  MessageCircle, 
  Download,
  Building,
  CheckCircle,
  ArrowRightLeft,
  PlusCircle,
  ArrowRightCircle
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
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { goGet, goPatch, goPost } from "@/lib/api-client";

const fetcher = (url: string) => goGet(url);

export default function TabMutasi() {
  // Tab State: "masuk" (Incoming), "keluar" (Outgoing), or "buku" (Buku Mutasi)
  const [activeTab, setActiveTab] = useState<"masuk" | "keluar" | "buku">("masuk");

  // --- MUTASI MASUK (INCOMING) STATE & HOOKS ---
  const { data: dataRequestsIn, error: errorRequestsIn, isLoading: loadingRequestsIn } = useSWR(
    "/api/admin/mutasi",
    fetcher
  );
  const { data: dataStats } = useSWR("/api/classes/stats", fetcher);

  const requestsIn = dataRequestsIn?.data || [];
  const classStats = dataStats?.data || [];

  const [openRequestIdIn, setOpenRequestIdIn] = useState<string | null>(null);
  const [isUpdatingIn, setIsUpdatingIn] = useState(false);
  const [targetClass, setTargetClass] = useState<string>("");

  const handleUpdateStatusIn = async (
    id: string,
    newStatus: string,
    targetClassId?: string
  ) => {
    setIsUpdatingIn(true);
    try {
      const payload: any = { statusApproval: newStatus };
      if (targetClassId) payload.targetClassId = targetClassId;

      await goPatch(`/api/admin/mutasi/${id}`, payload);

      toast.success("Status berhasil diperbarui");
      mutate("/api/admin/mutasi");
      setOpenRequestIdIn(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memperbarui status");
    } finally {
      setIsUpdatingIn(false);
    }
  };

  const generatePDF = async (req: any) => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("SURAT KETERANGAN PENERIMAAN", 105, 20, { align: "center" });
    doc.setFontSize(12);
    doc.text("MUTASI MASUK PESERTA DIDIK", 105, 28, { align: "center" });
    
    // Body
    doc.setFontSize(11);
    doc.text(`Nomor Registrasi: ${req.registrationNumber}`, 20, 50);
    
    doc.text("Yang bertanda tangan di bawah ini Kepala Sekolah SD Negeri ... menerangkan bahwa:", 20, 70, { maxWidth: 170 });
    
    const startY = 80;
    doc.text(`Nama Siswa`, 20, startY);
    doc.text(`: ${req.studentName}`, 60, startY);
    
    doc.text(`NISN`, 20, startY + 10);
    doc.text(`: ${req.nisn}`, 60, startY + 10);
    
    doc.text(`Asal Sekolah`, 20, startY + 20);
    doc.text(`: ${req.originSchool}`, 60, startY + 20);
    
    doc.text(`Diterima di Kelas`, 20, startY + 30);
    const assignedClass = classStats.find((c: any) => c.id === req.targetClassId)?.name || "-";
    doc.text(`: ${assignedClass}`, 60, startY + 30);
    
    doc.text("Telah kami SETUJUI untuk diterima sebagai siswa pindahan di sekolah kami.", 20, startY + 50, { maxWidth: 170 });
    
    // Footer
    doc.text(`Kendal, ${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`, 140, startY + 70);
    doc.text("Kepala Sekolah", 140, startY + 80);
    
    doc.text("( ...................... )", 140, startY + 100);
    
    doc.save(`Surat_Penerimaan_${req.studentName}.pdf`);
  };

  const currentClassStats = targetClass 
    ? classStats.find((c: any) => c.id === targetClass) 
    : null;

  // --- MUTASI KELUAR (OUTGOING) STATE & HOOKS ---
  const { data: dataRequestsOut, error: errorRequestsOut, isLoading: loadingRequestsOut } = useSWR(
    "/api/admin/mutasi-keluar",
    fetcher
  );
  // Fetch active students for Mutasi Keluar Langsung dropdown
  const { data: dataStudents } = useSWR("/api/students?limit=500&status=active", fetcher);
  const activeStudents = dataStudents?.data?.data || [];

  // --- BUKU MUTASI (LOGS) STATE & HOOKS ---
  const { data: dataLogs, error: errorLogs, isLoading: loadingLogs } = useSWR(
    "/api/admin/mutasi/logs",
    fetcher
  );
  const mutasiLogs = dataLogs?.data || [];

  const requestsOut = dataRequestsOut?.data || [];

  const [selectedRequestOut, setSelectedRequestOut] = useState<any>(null);
  const [openRequestIdOut, setOpenRequestIdOut] = useState<string | null>(null);
  const [liabilityData, setLiabilityData] = useState<any>(null);
  const [checkingLiability, setCheckingLiability] = useState(false);
  const [updatingOut, setUpdatingOut] = useState(false);

  const handleOpenDetailOut = async (req: any) => {
    setSelectedRequestOut(req);
    setCheckingLiability(true);
    setLiabilityData(null);
    
    try {
        const result: any = await goGet(`/api/admin/mutasi-keluar/${req.id}/check`);
        if(result.success) {
            setLiabilityData(result.data);
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
        mutate("/api/admin/mutasi-keluar");
        setOpenRequestIdOut(null);
        setSelectedRequestOut(null);
    } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memperbarui status");
    } finally {
        setUpdatingOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Kelola Mutasi Siswa
          </h2>
          <p className="text-muted-foreground text-sm">
            Manajemen permohonan mutasi masuk dan mutasi keluar siswa.
          </p>
        </div>
        <Button 
          onClick={() => {
            mutate(activeTab === "masuk" ? "/api/admin/mutasi" : "/api/admin/mutasi-keluar");
            if (activeTab === "masuk") mutate("/api/classes/stats");
          }} 
          variant="outline" 
          size="sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("masuk")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "masuk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mutasi Masuk
        </button>
        <button
          onClick={() => setActiveTab("keluar")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "keluar"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Mutasi Keluar
        </button>
        <button
          onClick={() => setActiveTab("buku")}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors -mb-[2px] ${
            activeTab === "buku"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Buku Mutasi
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "masuk" ? (
        <Card>
          <div className="p-4 flex justify-end border-b">
             <DialogMutasiMasukLangsung classStats={classStats} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tgl Masuk</TableHead>
                <TableHead>No. Registrasi</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Kelas Tujuan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRequestsIn ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : errorRequestsIn ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-destructive">
                    Gagal memuat permohonan mutasi masuk.
                  </TableCell>
                </TableRow>
              ) : requestsIn.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Tidak ada data permohonan.
                  </TableCell>
                </TableRow>
              ) : (
                requestsIn.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      {format(new Date(req.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{req.registrationNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">{req.originSchool}</div>
                    </TableCell>
                    <TableCell>Kelas {req.targetGrade}</TableCell>
                    <TableCell>
                      <Badge variant={
                        req.statusApproval === "principal_approved" ? "default" : 
                        req.statusApproval === "rejected" ? "destructive" : 
                        req.statusApproval === "verified" ? "secondary" : "outline"
                      }>
                        {req.statusApproval === "principal_approved" ? "Disetujui" :
                         req.statusApproval === "rejected" ? "Ditolak" :
                         req.statusApproval === "verified" ? "Terverifikasi" : "Menunggu"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog open={openRequestIdIn === req.id} onOpenChange={(open) => {
                        if(open) {
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
                            <DialogTitle>Detail Permohonan</DialogTitle>
                            <DialogDescription>
                              {req.registrationNumber} - {req.studentName}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                              <h3 className="font-semibold border-b">Data Siswa</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">NISN:</span>
                                <span>{req.nisn}</span>
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
                              <h3 className="font-semibold border-b">Data Orang Tua</h3>
                              <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                                <span className="text-muted-foreground">Nama:</span>
                                <span>{req.parentName}</span>
                                <span className="text-muted-foreground">WhatsApp:</span>
                                <a 
                                  href={`https://wa.me/${req.whatsappNumber}`} 
                                  target="_blank"
                                  className="text-green-600 hover:underline flex items-center"
                                >
                                  {req.whatsappNumber} <MessageCircle className="h-3 w-3 ml-1" />
                                </a>
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
                                        .filter((c: any) => c.grade === req.targetGrade)
                                        .map((c: any) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.name} ({c.studentCount}/{c.capacity})
                                          </SelectItem>
                                        ))
                                      }
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
                                 <Check className="h-5 w-5" /> Permohonan telah disetujui. Silakan unduh surat dan kirim ke orang tua.
                               </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : activeTab === "keluar" ? (
        <Card>
          <div className="p-4 flex justify-end border-b">
             <DialogMutasiKeluarLangsung students={activeStudents} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>NISN</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Sekolah Tujuan</TableHead>
                <TableHead>Alasan</TableHead>
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
                    Gagal memuat permohonan mutasi keluar.
                  </TableCell>
                </TableRow>
              ) : requestsOut.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Tidak ada permohonan.
                  </TableCell>
                </TableRow>
              ) : (
                requestsOut.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell>
                      {format(new Date(req.createdAt), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{req.nisn}</TableCell>
                    <TableCell>
                      <div className="font-medium">{req.studentName}</div>
                      <div className="text-xs text-muted-foreground">{req.className}</div>
                    </TableCell>
                    <TableCell>{req.destinationSchool}</TableCell>
                    <TableCell>
                      {req.reason === "domisili" ? "Pindah Domisili" : 
                       req.reason === "tugas_orangtua" ? "Tugas Ortu" : "Lainnya"}
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
                          if(open) {
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
                            <DialogTitle>Detail Permohonan</DialogTitle>
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
                                                      {liabilityData.library.activeLoans}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Buku belum kembali</div>
                                                  <Badge className="mt-2" variant={liabilityData.library.status === "Clear" ? "default" : "destructive"}>
                                                      {liabilityData.library.status}
                                                  </Badge>
                                              </Card>
                                              <Card className="p-4 border-l-4 border-l-green-500">
                                                  <div className="flex items-center gap-2 mb-2">
                                                      <Building className="h-4 w-4 text-green-500" />
                                                      <span className="font-medium">Tabungan</span>
                                                  </div>
                                                  <div className="text-2xl font-bold">
                                                      Rp {liabilityData.financial.balance.toLocaleString("id-ID")}
                                                  </div>
                                                  <div className="text-xs text-muted-foreground">Saldo tersisa</div>
                                                  <Badge className="mt-2" variant={liabilityData.financial.status === "Clear" ? "default" : "secondary"}>
                                                      {liabilityData.financial.status}
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
      ) : activeTab === "buku" ? (
        <Card>
          <div className="p-4 flex justify-between items-center border-b">
            <h3 className="font-semibold">Buku Mutasi Bulanan</h3>
            <Button size="sm" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> Cetak Buku Mutasi
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>NISN</TableHead>
                <TableHead>Asal/Tujuan</TableHead>
                <TableHead>Keterangan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingLogs ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : errorLogs ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-destructive">
                    Gagal memuat buku mutasi.
                  </TableCell>
                </TableRow>
              ) : mutasiLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Tidak ada riwayat mutasi.
                  </TableCell>
                </TableRow>
              ) : (
                mutasiLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {format(new Date(log.mutationDate), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.mutasiType === "masuk" ? "default" : "secondary"}>
                        {log.mutasiType === "masuk" ? "Masuk" : "Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {log.studentName}
                    </TableCell>
                    <TableCell>{log.nisn}</TableCell>
                    <TableCell>{log.originOrDestination}</TableCell>
                    <TableCell>{log.reason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}

function DialogMutasiMasukLangsung({ classStats }: { classStats: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    nisn: "",
    gender: "L",
    metaData: "", // used for origin school
    classId: "",
    reason: ""
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.nisn || !form.classId) {
      toast.error("Nama, NISN, dan Kelas tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student: {
          fullName: form.fullName,
          nisn: form.nisn,
          gender: form.gender,
          metaData: form.metaData,
          classId: form.classId
        },
        reason: form.reason
      };

      await goPost("/api/admin/mutasi/masuk/langsung", payload);
      toast.success("Mutasi masuk berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      mutate("/api/classes/stats");
      // Reset
      setForm({ fullName: "", nisn: "", gender: "L", metaData: "", classId: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Proses Mutasi Masuk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mutasi Masuk Langsung</DialogTitle>
          <DialogDescription>
            Eksekusi mutasi masuk seketika dan daftarkan siswa ke kelas tanpa melalui permohonan publik.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nama Siswa *</Label>
              <Input 
                value={form.fullName} 
                onChange={(e) => setForm({...form, fullName: e.target.value})} 
                placeholder="Nama Lengkap" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>NISN *</Label>
              <Input 
                value={form.nisn} 
                onChange={(e) => setForm({...form, nisn: e.target.value})} 
                placeholder="NISN" 
                required 
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jenis Kelamin</Label>
              <Select value={form.gender} onValueChange={(v) => setForm({...form, gender: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kelas Tujuan *</Label>
              <Select value={form.classId} onValueChange={(v) => setForm({...form, classId: v})} required>
                <SelectTrigger><SelectValue placeholder="Pilih Kelas"/></SelectTrigger>
                <SelectContent>
                  {classStats.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Asal Sekolah</Label>
            <Input 
              value={form.metaData} 
              onChange={(e) => setForm({...form, metaData: e.target.value})} 
              placeholder="SDN Contoh..." 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Keterangan Tambahan (Alasan)</Label>
            <Input 
              value={form.reason} 
              onChange={(e) => setForm({...form, reason: e.target.value})} 
              placeholder="Pindah domisili..." 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proses Mutasi
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogMutasiKeluarLangsung({ students }: { students: any[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    studentId: "",
    destinationSchool: "",
    reason: ""
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.destinationSchool) {
      toast.error("Siswa dan Sekolah Tujuan wajib diisi");
      return;
    }

    setLoading(true);
    try {
      await goPost("/api/admin/mutasi-keluar/langsung", form);
      toast.success("Mutasi keluar berhasil diproses");
      setOpen(false);
      mutate("/api/admin/mutasi/logs");
      // Reset
      setForm({ studentId: "", destinationSchool: "", reason: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses mutasi keluar. Pastikan tidak ada sangkutan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
          <ArrowRightCircle className="mr-2 h-4 w-4" /> Proses Mutasi Keluar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mutasi Keluar Langsung</DialogTitle>
          <DialogDescription>
            Keluarkan siswa dari sekolah secara langsung tanpa pengajuan dari wali murid.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          
          <div className="space-y-2">
            <Label>Pilih Siswa (Aktif) *</Label>
            <Select value={form.studentId} onValueChange={(v) => setForm({...form, studentId: v})} required>
              <SelectTrigger><SelectValue placeholder="Pilih Siswa"/></SelectTrigger>
              <SelectContent>
                {students.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.fullName} ({s.className})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sekolah Tujuan *</Label>
            <Input 
              value={form.destinationSchool} 
              onChange={(e) => setForm({...form, destinationSchool: e.target.value})} 
              placeholder="SDN Tujuan..." 
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Alasan Pindah</Label>
            <Input 
              value={form.reason} 
              onChange={(e) => setForm({...form, reason: e.target.value})} 
              placeholder="Ikut Orang Tua..." 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={loading} variant="destructive">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Keluarkan Siswa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
