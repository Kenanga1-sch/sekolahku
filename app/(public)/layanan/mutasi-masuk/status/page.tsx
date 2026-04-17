"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { goGet } from "@/lib/api-client";
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertCircle,
  Hash,
  User,
  School,
  Calendar,
  ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const trackSchema = z.object({
  registrationNumber: z.string().min(5, "Nomor registrasi tidak valid"),
  nisn: z.string().min(10, "NISN harus 10 digit"),
});

type MutasiData = {
  registrationNumber: string;
  studentName: string;
  nisn: string;
  originSchool: string;
  targetGrade: number;
  statusApproval: string;
  createdAt: string;
};

export default function MutasiTrackingPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MutasiData | null>(null);

  const form = useForm<z.infer<typeof trackSchema>>({
    resolver: zodResolver(trackSchema),
    defaultValues: { registrationNumber: "", nisn: "" },
  });

  const onTrack = async (values: z.infer<typeof trackSchema>) => {
    setLoading(true);
    setData(null);
    try {
      const response = await goGet<any>(`/api/mutasi/status/${values.registrationNumber}?nisn=${values.nisn}`);
      if (response.success) {
        setData(response.data);
      }
    } catch (error: any) {
      toast.error(error.message || "Data permohonan tidak ditemukan");
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: any; desc: string }> = {
    pending: {
      label: "Menunggu Verifikasi",
      color: "bg-amber-100 text-amber-700 border-amber-200",
      icon: Clock,
      desc: "Permohonan Anda sedang dalam antrean untuk diperiksa oleh tim administrasi."
    },
    verified: {
      label: "Terverifikasi",
      color: "bg-blue-100 text-blue-700 border-blue-200",
      icon: CheckCircle2,
      desc: "Data telah diverifikasi. Menunggu persetujuan Kepala Sekolah."
    },
    approved: {
      label: "Disetujui",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle2,
      desc: "Permohonan disetujui! Surat Keterangan Diterima sedang diproses."
    },
    principal_approved: {
      label: "Disetujui Kepala Sekolah",
      color: "bg-green-100 text-green-700 border-green-200",
      icon: CheckCircle2,
      desc: "Permohonan telah disetujui secara resmi oleh Kepala Sekolah."
    },
    rejected: {
      label: "Ditolak",
      color: "bg-red-100 text-red-700 border-red-200",
      icon: XCircle,
      desc: "Mohon maaf, permohonan Anda belum dapat kami setujui saat ini."
    }
  };

  const activeStatus = data ? (statusConfig[data.statusApproval] || statusConfig.pending) : null;

  return (
    <div className="container max-w-4xl py-12 px-4 min-h-[80vh]">
      <div className="flex flex-col items-center text-center space-y-4 mb-12">
        <div className="p-3 bg-primary/10 rounded-2xl text-primary">
          <Search className="h-8 w-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Lacak Permohonan Mutasi</h1>
        <p className="text-muted-foreground text-lg max-w-lg">
          Masukkan nomor registrasi dan NISN untuk memantau status permohonan pindah sekolah Anda.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr,1.5fr] gap-8 items-start">
        {/* Form Column */}
        <Card className="shadow-lg border-primary/10">
          <CardHeader>
            <CardTitle className="text-xl">Cari Permohonan</CardTitle>
            <CardDescription>Gunakan data yang Anda terima saat mendaftar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onTrack)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="registrationNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Registrasi</FormLabel>
                      <FormControl>
                        <Input placeholder="MUT-YYYYMMDD-XXX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nisn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NISN Siswa</FormLabel>
                      <FormControl>
                        <Input placeholder="10 Digit NISN" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-5 w-5" />
                  )}
                  Lacak Sekarang
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="bg-zinc-50 dark:bg-zinc-900/50 p-4 border-t">
            <div className="flex items-start gap-3 text-xs text-muted-foreground">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>Nomor registrasi dikirimkan setelah Anda menyelesaikan formulir pendaftaran.</p>
            </div>
          </CardFooter>
        </Card>

        {/* Result Column */}
        <div className="space-y-6">
          {data && activeStatus ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-2 border-primary/5 shadow-xl overflow-hidden">
                <div className={cn("h-2 w-full", activeStatus.color.split(" ")[0])} />
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        Status Terkini
                      </p>
                      <Badge variant="outline" className={cn("px-3 py-1 text-sm font-semibold border-2 capitalize", activeStatus.color)}>
                        <activeStatus.icon className="mr-2 h-4 w-4" />
                        {activeStatus.label}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                        Tgl Pengajuan
                      </p>
                      <p className="font-semibold">{new Date(data.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                    <p className="text-sm font-medium leading-relaxed">
                      {activeStatus.desc}
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5 mb-1">
                        <Hash className="h-3.5 w-3.5" />
                        NO. REGISTRASI
                      </div>
                      <p className="font-bold tracking-tight text-blue-600 dark:text-blue-400">{data.registrationNumber}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5 mb-1">
                        <User className="h-3.5 w-3.5" />
                        NAMA SISWA
                      </div>
                      <p className="font-bold truncate" title={data.studentName}>{data.studentName}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5 mb-1">
                        <School className="h-3.5 w-3.5" />
                        SEKOLAH ASAL
                      </div>
                      <p className="font-medium truncate" title={data.originSchool}>{data.originSchool}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-muted-foreground gap-1.5 mb-1">
                        <ChevronRight className="h-3.5 w-3.5" />
                        KELAS TUJUAN
                      </div>
                      <p className="font-medium">Kelas {data.targetGrade}</p>
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="bg-primary/5 p-6 block">
                    <div className="text-center space-y-4">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            Ada pertanyaan mengenai permohonan Anda?
                        </p>
                        <Button variant="secondary" className="rounded-full px-8">
                             Hubungi Tata Usaha
                        </Button>
                    </div>
                </CardFooter>
              </Card>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl opacity-50 space-y-4">
              <div className="bg-zinc-100 dark:bg-zinc-900 p-6 rounded-full">
                 <Search className="h-12 w-12 text-zinc-400" />
              </div>
              <div className="text-center">
                 <p className="font-semibold text-lg">Hasil pelacakan akan muncul di sini</p>
                 <p className="text-sm">Silakan masukkan data pada formulir di samping.</p>
              </div>
            </div>
          )}

          {/* FAQ or Info box */}
          <div className="p-6 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 space-y-3">
             <h4 className="font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Informasi Penting
             </h4>
             <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
                <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    Proses verifikasi biasanya memakan waktu 1-3 hari kerja.
                </li>
                <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    Jika disetujui, Anda wajib membawa berkas fisik ke sekolah untuk penyelesaian administrasi.
                </li>
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
