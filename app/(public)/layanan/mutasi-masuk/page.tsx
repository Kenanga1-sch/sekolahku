"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

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
  const [isSuccess, setIsSuccess] = useState(false);

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
      const response = await fetch("/api/mutasi/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Terjadi kesalahan");
      }

      setIsSuccess(true);
      toast.success("Permohonan berhasil dikirim!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="container max-w-lg py-12">
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">Permohonan Terkirim</CardTitle>
            <CardDescription className="text-green-600 dark:text-green-500">
              Terima kasih telah mengajukan permohonan mutasi masuk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Data Anda telah kami terima. Tim kami akan memeriksa ketersediaan kuota dan kelengkapan data.
              Jika disetujui, <strong>Surat Keterangan Diterima</strong> akan kami kirimkan melalui WhatsApp ke nomor yang Anda daftarkan.
            </p>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsSuccess(false);
                form.reset();
              }}
            >
              Kembali ke Form
            </Button>
          </CardContent>
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
