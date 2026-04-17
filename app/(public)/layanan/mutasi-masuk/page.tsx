"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle, ClipboardCheck, Search } from "lucide-react";
import { goPost } from "@/lib/api-client";
import Link from "next/link";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const formSchema = z.object({
  studentName: z.string().min(3, "Nama siswa minimal 3 karakter"),
  nisn: z.string().min(10, "NISN harus 10 digit"),
  gender: z.enum(["L", "P"]),
  originSchool: z.string().min(3, "Nama sekolah asal minimal 3 karakter"),
  originSchoolAddress: z.string().min(10, "Alamat lengkap sekolah asal wajib diisi"),
  targetGrade: z.coerce.number().min(1).max(6),
  parentName: z.string().min(3, "Nama orang tua minimal 3 karakter"),
  whatsappNumber: z.string().min(10, "Nomor WhatsApp tidak valid"),
});

export default function MutasiMasukPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [regNum, setRegNum] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      studentName: "",
      nisn: "",
      originSchool: "",
      originSchoolAddress: "",
      targetGrade: 1,
      parentName: "",
      whatsappNumber: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const response = await goPost<any>("/api/mutasi/request", values);
      if (response.success) {
        setRegNum(response.registrationNumber);
        setStep("success");
        toast.success("Permohonan berhasil dikirim!");
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan saat mengirim permohonan");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <div className="container max-w-lg py-12">
        <Card>
          <div className="p-8 text-center space-y-6">
            <div className="bg-green-50 dark:bg-green-950/20 py-8 rounded-3xl">
              <div className="flex justify-center mb-4">
                <div className="bg-green-500 text-white p-3 rounded-full shadow-lg shadow-green-500/30">
                   <CheckCircle className="h-10 w-10" />
                </div>
              </div>
              <div className="space-y-2 px-4">
                <h3 className="text-2xl font-bold text-green-700 dark:text-green-500">Permohonan Berhasil!</h3>
                <p className="text-muted-foreground">
                  Data Anda telah kami terima dan akan segera diproses oleh tim administrasi.
                </p>
              </div>
            </div>

            {regNum && (
               <div className="bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nomor Registrasi Anda</p>
                  <div className="flex items-center justify-center gap-3">
                     <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{regNum}</span>
                     <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() => {
                           navigator.clipboard.writeText(regNum);
                           toast.success("Nomor registrasi disalin!");
                        }}
                     >
                        <ClipboardCheck className="h-4 w-4" />
                     </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Simpan nomor ini untuk melakukan pengecekan status permohonan.</p>
               </div>
            )}
            
            <div className="flex flex-col gap-3">
               <Link href="/layanan/mutasi-masuk/status">
                  <Button className="w-full h-12 rounded-full text-base font-semibold">
                    <Search className="mr-2 h-4 w-4" /> Lacak Status Sekarang
                  </Button>
               </Link>
               <Button onClick={() => window.location.reload()} variant="outline" className="h-12 rounded-full border-zinc-200">
                  Kembali ke Halaman Utama
               </Button>
            </div>

            <Separator />
            
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 text-left">
              <h4 className="font-semibold text-amber-800 dark:text-amber-400 mb-2 text-sm">Informasi Penting:</h4>
              <ul className="text-xs text-amber-800/80 dark:text-amber-300/80 space-y-1">
                <li>• Hasil koordinasi akan diinfokan dalam 1-3 hari kerja.</li>
                <li>• Jika disetujui, kami akan mengirimkan <strong>Surat Keterangan Diterima</strong> melalui WhatsApp.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Layanan Mutasi Masuk</h1>
        <p className="text-muted-foreground">
          Isi formulir berikut untuk mengajukan perpindahan siswa ke sekolah kami.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Formulir Pengajuan</CardTitle>
          <CardDescription>
            Pastikan data yang diisi valid dan sesuai dokumen asli.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-6">
              
              <FormField
                control={form.control as any}
                name="studentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap Siswa <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="nisn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NISN <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Kelamin <span className="text-red-500">*</span></FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="targetGrade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Masuk ke Kelas <span className="text-red-500">*</span></FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(Number(val))} 
                      defaultValue={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((grade) => (
                          <SelectItem key={grade} value={String(grade)}>
                            Kelas {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="originSchool"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asal Sekolah <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="originSchoolAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alamat Lengkap Sekolah Asal <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="parentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Orang Tua / Wali <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control as any}
                name="whatsappNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor WhatsApp <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="" {...field} />
                    </FormControl>
                    <FormDescription>
                      Pastikan nomor aktif WA untuk pengiriman surat.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  "Kirim Permohonan"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

