
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

const studentSchema = z.object({
  fullName: z.string().min(3, "Nama minimal 3 karakter"),
  nis: z.string().optional(),
  nisn: z.string().optional(),
  nik: z.string().optional(),
  gender: z.enum(["L", "P"]),
  birthPlace: z.string().optional(),
  birthDate: z.string().optional(), // YYYY-MM-DD
  religion: z.string().optional(),
  address: z.string().optional(),
  classId: z.string().optional(),
  
  // Parents
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  parentPhone: z.string().optional(),
  guardianName: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentSchema>;

interface StudentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId?: string | null; // If present, edit mode
  onSuccess: () => void;
}

export function StudentFormDialog({ open, onOpenChange, studentId, onSuccess }: StudentFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<{id: string, name: string}[]>([]);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema) as any,
    defaultValues: {
      fullName: "",
      gender: "L",
    },
  });

  // Fetch Classes for Dropdown
  useEffect(() => {
      fetch("/api/academic/classes")
          .then(res => res.json())
          .then(data => setClasses(data as any[]))
          .catch(err => console.error("Failed to load classes", err));
  }, []);

  // Fetch Student Data if Edit Mode
  useEffect(() => {
    if (studentId && open) {
        setIsLoading(true);
        fetch(`/api/master/students/${studentId}`)
            .then(res => res.json())
            .then(data => {
                form.reset(data); // Auto-fill
            })
            .catch(err => showError("Gagal memuat data siswa"))
            .finally(() => setIsLoading(false));
    } else if (open) {
        form.reset({ fullName: "", gender: "L" }); // Reset for create
    }
  }, [studentId, open, form]);

  const onSubmit = async (data: StudentFormValues) => {
    setIsLoading(true);
    try {
        const url = studentId ? `/api/master/students/${studentId}` : "/api/master/students";
        const method = studentId ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        const json = await res.json();
        
        if (!res.ok) {
            throw new Error(json.error || "Gagal menyimpan");
        }

        showSuccess(studentId ? "Data siswa diperbarui" : "Siswa baru ditambahkan");
        onSuccess();
        onOpenChange(false);
    } catch (error: any) {
        showError(error.message);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{studentId ? "Edit Data Siswa" : "Tambah Siswa Baru"}</DialogTitle>
          <DialogDescription>
            Lengkapi data diri siswa. Pastikan NISN dan NIK unik.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="identity">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="identity">Identitas</TabsTrigger>
                    <TabsTrigger value="academic">Akademik</TabsTrigger>
                    <TabsTrigger value="parents">Orang Tua</TabsTrigger>
                </TabsList>
                
                {/* TAB 1: IDENTITY */}
                <TabsContent value="identity" className="space-y-4">
                    <FormField
                        control={form.control as any}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama Lengkap</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control as any}
                            name="nisn"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NISN</FormLabel>
                                    <FormControl><Input {...field} placeholder="National ID" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control as any}
                            name="nis"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NIS (Lokal)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <FormField
                            control={form.control as any}
                            name="nik"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NIK (Kependudukan)</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="gender"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jenis Kelamin</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih..." />
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
                    </div>
                     <FormField
                        control={form.control as any}
                        name="birthDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tanggal Lahir</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>

                {/* TAB 2: ACADEMIC */}
                <TabsContent value="academic" className="space-y-4">
                    <FormField
                        control={form.control as any}
                        name="classId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Kelas Saat Ini</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Kelas..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {classes.map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>

                {/* TAB 3: PARENTS */}
                <TabsContent value="parents" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control as any}
                            name="fatherName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Ayah</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control as any}
                            name="motherName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nama Ibu</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <FormField
                        control={form.control as any}
                        name="parentPhone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>No. HP Orang Tua / Wali</FormLabel>
                                <FormControl><Input {...field} placeholder="+62..." /></FormControl>
                                <FormDescription>Nomor ini akan digunakan untuk notifikasi.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>
            </Tabs>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan Data
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
