"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { 
  Loader2, 
  CheckCircle, 
  Building,
  RefreshCw 
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
import { Card } from "@/components/ui/card";
import { goGet, goPatch } from "@/lib/api-client";

const fetcher = (url: string) => goGet(url);

export default function AdminMutasiKeluarPage() {
  const { data: dataRequests, error: errorRequests, isLoading } = useSWR(
    "/api/admin/mutasi-keluar",
    fetcher
  );

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [openRequestId, setOpenRequestId] = useState<string | null>(null);
  const [liabilityData, setLiabilityData] = useState<any>(null);
  const [checkingLiability, setCheckingLiability] = useState(false);
  const [updating, setUpdating] = useState(false);

  const requests = dataRequests?.data || [];

  const handleOpenDetail = async (req: any) => {
    setSelectedRequest(req);
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

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdating(true);
    try {
        await goPatch(`/api/admin/mutasi-keluar/${id}`, { status: newStatus });
        
        toast.success("Status berhasil diperbarui");
        mutate("/api/admin/mutasi-keluar");
        setOpenRequestId(null);
        setSelectedRequest(null);
    } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memperbarui status");
    } finally {
        setUpdating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold">Permohonan Mutasi Keluar</h1>
            <p className="text-muted-foreground">Monitoring siswa yang mengajukan pindah sekolah.</p>
        </div>
        <Button onClick={() => mutate("/api/admin/mutasi-keluar")} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : errorRequests ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-destructive">
                  Gagal memuat permohonan mutasi keluar.
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Tidak ada permohonan.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req: any) => (
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
                    <Dialog open={openRequestId === req.id} onOpenChange={(open) => {
                        if(open) {
                            setOpenRequestId(req.id);
                            handleOpenDetail(req);
                        } else {
                            setOpenRequestId(null);
                            setSelectedRequest(null);
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
                        
                        {selectedRequest && (
                           <div className="space-y-6 py-4">
                                <div className="grid grid-cols-2 gap-4 text-sm bg-muted p-4 rounded-lg">
                                    <div>
                                        <span className="text-muted-foreground block">Nama Siswa:</span>
                                        <span className="font-semibold">{selectedRequest.studentName}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">NISN:</span>
                                        <span className="font-semibold">{selectedRequest.nisn}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Sekolah Tujuan:</span>
                                        <span className="font-semibold">{selectedRequest.destinationSchool}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block">Alasan:</span>
                                        <span className="font-semibold">{selectedRequest.reasonDetail || selectedRequest.reason}</span>
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
                                        setOpenRequestId(null);
                                        setSelectedRequest(null);
                                    }}>Tutup</Button>
                                    
                                    {selectedRequest.status !== "completed" && (
                                        <>
                                            {selectedRequest.status === "draft" && (
                                                <Button 
                                                    onClick={() => updateStatus(selectedRequest.id, "processed")}
                                                    disabled={updating}
                                                >
                                                    Tandai Diproses
                                                </Button>
                                            )}
                                            {selectedRequest.status === "processed" && (
                                                 <Button 
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => updateStatus(selectedRequest.id, "completed")}
                                                    disabled={updating}
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
    </div>
  );
}

