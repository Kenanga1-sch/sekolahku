"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Trophy,
} from "lucide-react";

interface RankingItem {
  id: string;
  rank: number;
  name: string;
  birthDate: string;
  age: string;
  priorityGroup: number;
  priorityGroupLabel?: string;
  distance: number;
  isInZone: boolean;
  registeredAt: string;
  currentStatus?: string;
  recommendation?: string;
}

interface ProcessResult {
  success: boolean;
  dryRun?: boolean;
  periodName: string;
  academicYear: string;
  quota: number;
  totalRegistrants: number;
  totalProcessed: number;
  accepted: number;
  rejected: number;
  waitlist: number;
  referenceDate: string;
  rankings: RankingItem[];
}

interface ProcessAcceptanceDialogProps {
  periodId: string;
  periodName: string;
  quota: number;
  onProcessComplete?: () => void;
}

function getPriorityGroupBadge(group: number) {
  switch (group) {
    case 1:
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">7-12 thn</Badge>;
    case 2:
      return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">6 thn</Badge>;
    case 3:
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">&lt;6 thn</Badge>;
    default:
      return <Badge variant="secondary">-</Badge>;
  }
}

function getRecommendationBadge(recommendation: string) {
  switch (recommendation) {
    case "accepted":
      return (
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 gap-1">
          <CheckCircle className="h-3 w-3" /> Diterima
        </Badge>
      );
    case "rejected":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <XCircle className="h-3 w-3" /> Ditolak
        </Badge>
      );
    case "waitlist":
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
          <Clock className="h-3 w-3" /> Daftar Tunggu
        </Badge>
      );
    default:
      return <Badge variant="secondary">-</Badge>;
  }
}

export function ProcessAcceptanceDialog({
  periodId,
  periodName,
  quota,
  onProcessComplete,
}: ProcessAcceptanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState<ProcessResult | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview when dialog opens
  useEffect(() => {
    if (open && !preview && !isLoading) {
      fetchPreview();
    }
  }, [open]);

  const fetchPreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/spmb/process?periodId=${periodId}`);
      const data = await response.json();
      
      if (data.success) {
        setPreview(data);
      } else {
        setError(data.error || "Gagal memuat data");
      }
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const response = await fetch("/api/spmb/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId, dryRun: false }),
      });
      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        onProcessComplete?.();
      } else {
        setError(data.error || "Gagal memproses penerimaan");
      }
    } catch (err) {
      setError("Gagal menghubungi server");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setPreview(null);
      setResult(null);
      setError(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
          <Play className="h-4 w-4" />
          Proses Penerimaan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Proses Penerimaan Siswa
          </DialogTitle>
          <DialogDescription>
            {periodName} | Kuota: {quota} siswa
          </DialogDescription>
        </DialogHeader>

        {/* Prioritas Info */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Urutan Prioritas:</strong> Usia 7-12 tahun → Usia 6 tahun → Usia &lt;6 tahun.
            Jika usia sama (bulan & tahun), prioritas berdasarkan jarak terdekat.
            Jika jarak sama, prioritas berdasarkan waktu pendaftaran.
          </AlertDescription>
        </Alert>

        {/* Content */}
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {/* Preview/Result Table */}
          {(preview || result) && !isLoading && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{(result || preview)?.totalRegistrants}</div>
                  <div className="text-xs text-muted-foreground">Total Pendaftar</div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{result?.accepted ?? Math.min((preview?.totalRegistrants || 0), quota)}</div>
                  <div className="text-xs text-muted-foreground">Akan Diterima</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">{result?.waitlist ?? Math.max(0, (preview?.totalRegistrants || 0) - quota)}</div>
                  <div className="text-xs text-muted-foreground">Daftar Tunggu</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{result?.rejected ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Ditolak</div>
                </div>
              </div>

              {/* Rankings Table */}
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Usia</TableHead>
                      <TableHead>Prioritas</TableHead>
                      <TableHead>Jarak</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(result?.rankings || preview?.rankings || []).map((item) => (
                      <TableRow 
                        key={item.id}
                        className={
                          item.rank <= quota 
                            ? "bg-green-50/50 dark:bg-green-900/10" 
                            : "bg-red-50/50 dark:bg-red-900/10"
                        }
                      >
                        <TableCell>
                          <span className={`font-bold ${item.rank <= quota ? "text-green-600" : "text-muted-foreground"}`}>
                            #{item.rank}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-sm">{item.age}</TableCell>
                        <TableCell>{getPriorityGroupBadge(item.priorityGroup)}</TableCell>
                        <TableCell className="text-sm">
                          {item.distance?.toFixed(1)} km
                          {item.isInZone && (
                            <Badge variant="outline" className="ml-1 text-xs">Zona</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result 
                            ? getRecommendationBadge(item.recommendation || "")
                            : item.rank <= quota 
                              ? getRecommendationBadge("accepted")
                              : getRecommendationBadge("waitlist")
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {/* Garis kuota */}
              {!result && preview && preview.totalRegistrants > quota && (
                <p className="text-sm text-muted-foreground text-center">
                  ⬆️ Pendaftar di atas garis kuota ({quota}) akan diterima | 
                  ⬇️ Pendaftar di bawah masuk daftar tunggu
                </p>
              )}
            </div>
          )}

          {/* Success Message */}
          {result && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Berhasil!</strong> {result.accepted} siswa diterima, {result.waitlist} masuk daftar tunggu, {result.rejected} ditolak.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button 
                onClick={handleProcess} 
                disabled={isLoading || isProcessing || !preview}
                className="bg-gradient-to-r from-green-600 to-emerald-600"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Proses & Simpan
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Tutup</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
