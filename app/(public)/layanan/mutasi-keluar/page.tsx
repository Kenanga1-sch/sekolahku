"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { Loader2, Download, CheckCircle, ArrowRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

// ==========================================
// Schemas
// ==========================================

const validationSchema = z.object({
  nisn: z.string().min(10, "NISN harus 10 digit").max(10, "NISN harus 10 digit"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal: YYYY-MM-DD"),
});

const requestSchema = z.object({
  destinationSchool: z.string().min(3, "Nama sekolah tujuan minimal 3 karakter"),
  reason: z.enum(["domisili", "tugas_orangtua", "lainnya"]),
  reasonDetail: z.string().optional(),
});

type StudentData = {
  id: string;
  fullName: string;
  nisn: string;
  className: string;
  parentName: string;
  schoolName: string;
};

export default function MutasiKeluarPage() {
  const [step, setStep] = useState<"validate" | "form" | "success">("validate");
  const [student, setStudent] = useState<StudentData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forms
  const validationForm = useForm<z.infer<typeof validationSchema>>({
    resolver: zodResolver(validationSchema),
    defaultValues: { nisn: "", birthDate: "" },
  });

  const requestForm = useForm<z.infer<typeof requestSchema>>({
    resolver: zodResolver(requestSchema),
    defaultValues: { destinationSchool: "", reason: "domisili", reasonDetail: "" },
  });

  // Handlers
  const onValidate = async (values: z.infer<typeof validationSchema>) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/mutasi-keluar/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Validasi gagal");
      }

      setStudent(data.data);
      setStep("form");
      toast.success("Data siswa ditemukan");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onRequestSubmit = async (values: z.infer<typeof requestSchema>) => {
    if (!student) return;
    setIsSubmitting(true);
    try {
      // 1. Submit Request to API
      const res = await fetch("/api/mutasi-keluar/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          destinationSchool: values.destinationSchool,
          reason: values.reason,
          reasonDetail: values.reasonDetail,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal membuat permohonan");

      // 2. Generate PDF
      generatePDF(values);

      setStep("success");
      toast.success("Surat permohonan berhasil dibuat!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generatePDF = (values: z.infer<typeof requestSchema>) => {
    if (!student) return;

    const doc = new jsPDF();
    const reasonText = 
      values.reason === "domisili" ? "Pindah Domisili" :
      values.reason === "tugas_orangtua" ? "Mengikuti Tugas Orang Tua" :
      values.reasonDetail || "Alasan Lainnya";

    doc.setFont("times", "normal");
    
    // Header (Surat Pribadi, no Kop)
    doc.setFontSize(12);
    doc.text(`Kendal, ${format(new Date(), "d MMMM yyyy", { locale: idLocale })}`, 140, 20);

    doc.text("Hal : Permohonan Pindah Sekolah", 20, 30);
    
    doc.text("Yth. Kepala Sekolah", 20, 40);
    doc.text(student.schoolName || "SD Negeri ...", 20, 46);
    doc.text("di Tempat", 20, 52);

    // Body
    doc.text("Dengan hormat,", 20, 65);
    doc.text("Saya yang bertanda tangan di bawah ini orang tua / wali murid dari:", 20, 72);

    const startY = 82;
    doc.text(`Nama`, 30, startY);
    doc.text(`: ${student.fullName}`, 80, startY);

    doc.text(`NISN`, 30, startY + 8);
    doc.text(`: ${student.nisn}`, 80, startY + 8);

    doc.text(`Kelas`, 30, startY + 16);
    doc.text(`: ${student.className || "-"}`, 80, startY + 16);

    doc.text("Dengan ini mengajukan permohonan pindah sekolah ke:", 20, startY + 30);
    
    doc.text(`Sekolah Tujuan`, 30, startY + 40);
    doc.text(`: ${values.destinationSchool}`, 80, startY + 40);
    
    doc.text(`Alasan Pindah`, 30, startY + 48);
    doc.text(`: ${reasonText}`, 80, startY + 48);

    doc.text(
      "Demikian surat permohonan ini saya buat dengan sebenar-benarnya untuk dapat dipergunakan sebagaimana mestinya.",
      20, startY + 65, { maxWidth: 170, align: "justify" }
    );

    // Footer
    doc.text("Hormat saya,", 140, startY + 90);
    doc.text("Orang Tua / Wali Murid", 140, startY + 96);
    
    // Meterai Box
    doc.setLineWidth(0.1);
    doc.rect(142, startY + 105, 25, 25);
    doc.setFontSize(8);
    doc.text("Meterai", 145, startY + 115);
    doc.text("10.000", 145, startY + 120);

    doc.setFontSize(12);
    doc.text(`( ${student.parentName || "......................"} )`, 140, startY + 145);

    doc.save(`Permohonan_Mutasi_${student.fullName}.pdf`);
  };

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Layanan Mutasi Keluar</h1>
        <p className="text-muted-foreground">
          Buat surat permohonan pindah sekolah secara mandiri.
        </p>
      </div>

      <Card className="border-t-4 border-t-blue-600 shadow-lg">
        {step === "validate" && (
          <>
            <CardHeader>
              <CardTitle>Verifikasi Data Siswa</CardTitle>
              <CardDescription>Masukkan NISN dan Tanggal Lahir untuk melanjutkan.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...validationForm}>
                <form onSubmit={validationForm.handleSubmit(onValidate)} className="space-y-6">
                  <FormField
                    control={validationForm.control}
                    name="nisn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NISN</FormLabel>
                        <FormControl>
                          <Input placeholder="Nomor Induk Siswa Nasional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={validationForm.control}
                    name="birthDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tanggal Lahir (YYYY-MM-DD)</FormLabel>
                        <FormControl>
                          <Input type="date" placeholder="YYYY-MM-DD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Cek Data"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}

        {step === "form" && student && (
          <>
            <CardHeader>
              <CardTitle>Formulir Permohonan</CardTitle>
              <CardDescription>
                Data siswa ditemukan. Silakan lengkapi tujuan kepindahan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
                <div className="grid grid-cols-[100px_1fr]">
                  <span className="text-muted-foreground">Nama:</span>
                  <span className="font-medium">{student.fullName}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                  <span className="text-muted-foreground">Kelas:</span>
                  <span className="font-medium">{student.className}</span>
                </div>
                <div className="grid grid-cols-[100px_1fr]">
                  <span className="text-muted-foreground">Wali:</span>
                  <span className="font-medium">{student.parentName}</span>
                </div>
              </div>

              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-6">
                  <FormField
                    control={requestForm.control}
                    name="destinationSchool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sekolah Tujuan</FormLabel>
                        <FormControl>
                          <Input placeholder="Nama Sekolah Baru" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={requestForm.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alasan Pindah</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih alasan" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="domisili">Pindah Domisili</SelectItem>
                            <SelectItem value="tugas_orangtua">Mengikuti Tugas Orang Tua</SelectItem>
                            <SelectItem value="lainnya">Lainnya</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {requestForm.watch("reason") === "lainnya" && (
                     <FormField
                     control={requestForm.control}
                     name="reasonDetail"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Detail Alasan</FormLabel>
                         <FormControl>
                           <Input placeholder="Jelaskan alasan lain..." {...field} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                  )}

                  <div className="pt-4 flex gap-3">
                     <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setStep("validate")}
                        className="flex-1"
                      >
                        Kembali
                      </Button>
                      <Button type="submit" className="flex-[2]" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...
                          </>
                        ) : (
                          <>
                            <FileText className="mr-2 h-4 w-4" /> Buat Surat Permohonan
                          </>
                        )}
                      </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </>
        )}

        {step === "success" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-green-700">Berhasil!</h3>
              <p className="text-muted-foreground">
                Surat permohonan telah terunduh otomatis. Data Anda juga sudah tercatat di sistem sekolah.
              </p>
            </div>
            
            <Card className="bg-yellow-50 border-yellow-200 text-left">
              <CardContent className="pt-6">
                <h4 className="font-semibold text-yellow-800 mb-2">Langkah Selanjutnya:</h4>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  <li>Cetak surat yang baru saja diunduh.</li>
                  <li>Tempelkan <strong>Meterai 10.000</strong> pada kolom yang tersedia.</li>
                  <li>Tanda tangani surat tersebut (Orang Tua/Wali).</li>
                  <li>Serahkan ke Tata Usaha sekolah untuk mengurus Surat Keterangan Pindah (Dapodik).</li>
                </ul>
              </CardContent>
            </Card>

            <Button onClick={() => window.location.reload()} variant="outline">
              Selesai & Kembali
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
