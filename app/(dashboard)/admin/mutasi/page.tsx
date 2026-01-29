"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { Loader2, FileText, Check, X, RefreshCw, MessageCircle, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  DialogFooter,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminMutasiPage() {
  const { data: dataRequests, error: errorRequests, isLoading: loadingRequests } = useSWR(
    "/api/admin/mutasi",
    fetcher
  );
  const { data: dataStats } = useSWR("/api/admin/classes/stats", fetcher);

  const requests = dataRequests?.data || [];
  const classStats = dataStats?.data || [];

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [targetClass, setTargetClass] = useState<string>("");

  const handleUpdateStatus = async (
    id: string,
    newStatus: string,
    targetClassId?: string
  ) => {
    setIsUpdating(true);
    try {
      const payload: any = { statusApproval: newStatus };
      if (targetClassId) payload.targetClassId = targetClassId;

      const res = await fetch(`/api/admin/mutasi/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update");

      toast.success("Status updated successfully");
      mutate("/api/admin/mutasi");
      setSelectedRequest(null); // Close dialog or refresh it
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const generatePDF = (req: any) => {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Permohonan Mutasi Masuk</h1>
        <Button onClick={() => mutate("/api/admin/mutasi")} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
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
            {loadingRequests ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Tidak ada data permohonan.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((req: any) => (
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
                    <Dialog onOpenChange={(open) => {
                      if(open) {
                        setSelectedRequest(req);
                        setTargetClass(req.targetClassId || "");
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
                                onClick={() => handleUpdateStatus(req.id, "verified")}
                                disabled={isUpdating}
                              >
                                <Check className="mr-2 h-4 w-4" /> Verifikasi Dokumen
                              </Button>
                              <Button 
                                variant="destructive"
                                onClick={() => handleUpdateStatus(req.id, "rejected")}
                                disabled={isUpdating}
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
                                  onClick={() => handleUpdateStatus(req.id, "principal_approved", targetClass)}
                                  disabled={isUpdating || !targetClass}
                                >
                                  <Check className="mr-2 h-4 w-4" /> Setujui (Kepsek)
                                </Button>
                                <Button 
                                  variant="destructive"
                                  onClick={() => handleUpdateStatus(req.id, "rejected")}
                                  disabled={isUpdating}
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
    </div>
  );
}
