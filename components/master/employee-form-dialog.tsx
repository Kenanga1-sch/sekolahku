
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

const employeeSchema = z.object({
  fullName: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["admin", "guru", "staff"]),
  
  // Details
  nip: z.string().optional(),
  nuptk: z.string().optional(),
  nik: z.string().optional(),
  employmentStatus: z.string().optional(), // PNS, GTY, Non-PNS
  jobType: z.string().optional(), // Guru Kelas, Staff TU
  joinDate: z.string().optional(),
  phone: z.string().optional(),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string | null;
  onSuccess: () => void;
}

export function EmployeeFormDialog({ open, onOpenChange, employeeId, onSuccess }: EmployeeFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "guru",
      employmentStatus: "GTY", 
      jobType: "Guru Mapel",
      // Initialize optional strings to empty string to avoid "uncontrolled" error
      nip: "",
      nuptk: "",
      nik: "",
      joinDate: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (employeeId && open) {
        setIsLoading(true);
        fetch(`/api/master/employees/${employeeId}`)
            .then(async res => {
                if (!res.ok) throw new Error("Gagal memuat data");
                return res.json();
            })
            .then(data => {
                // Format Date to YYYY-MM-DD for Input type="date"
                let formattedDate = "";
                if (data.joinDate) {
                    const dateObj = new Date(data.joinDate);
                    if (!isNaN(dateObj.getTime())) {
                        formattedDate = dateObj.toISOString().split("T")[0];
                    } else {
                        formattedDate = data.joinDate; // Fallback if already string or unknown
                    }
                }

                form.reset({
                    fullName: data.fullName || "",
                    email: data.email || "",
                    role: data.role || "guru",
                    employmentStatus: data.employmentStatus || "",
                    jobType: data.jobType || "",
                    nip: data.nip || "",
                    nuptk: data.nuptk || "",
                    nik: data.nik || "",
                    joinDate: formattedDate,
                    phone: data.phone || "",
                });
            })
            .catch((e) => showError(e.message))
            .finally(() => setIsLoading(false));
    } else if (open) {
        form.reset({ 
            fullName: "", 
            email: "", 
            role: "guru", 
            employmentStatus: "GTY", 
            jobType: "Guru Mapel",
            nip: "",
            nuptk: "",
            nik: "",
            joinDate: "",
            phone: "",
        });
    }
  }, [employeeId, open, form]);

  const onSubmit = async (data: EmployeeFormValues) => {
    setIsLoading(true);
    try {
        const url = employeeId ? `/api/master/employees/${employeeId}` : "/api/master/employees";
        const method = employeeId ? "PUT" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || "Gagal menyimpan");

        showSuccess(employeeId ? "Data pegawai diperbarui" : "Pegawai baru ditambahkan");
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
          <DialogTitle>{employeeId ? "Edit Data GTK" : "Tambah GTK Baru"}</DialogTitle>
          <DialogDescription>
            Detail Guru & Tenaga Kependidikan. { !employeeId && "Password default: 123456" }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="account">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="account">Akun Login</TabsTrigger>
                    <TabsTrigger value="employment">Kepegawaian</TabsTrigger>
                </TabsList>

                <TabsContent value="account" className="space-y-4">
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama Lengkap (dengan Gelar)</FormLabel>
                                <FormControl><Input {...field} placeholder="Siti Aminah, S.Pd" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl><Input {...field} type="email" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>No. HP / WA</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role Sistem</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Role" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="guru">Guru</SelectItem>
                                        <SelectItem value="staff">Staff TU / Tendik</SelectItem>
                                        <SelectItem value="admin">Administrator</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>

                <TabsContent value="employment" className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="nip"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NIP</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="nuptk"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>NUPTK</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="employmentStatus"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status Kepegawaian</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="PNS">PNS</SelectItem>
                                            <SelectItem value="P3K">P3K</SelectItem>
                                            <SelectItem value="GTY">GTY (Tetap Yayasan)</SelectItem>
                                            <SelectItem value="GTT">GTT (Tidak Tetap)</SelectItem>
                                            <SelectItem value="Honorer">Honorer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="jobType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Jenis PTK</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Guru Kelas">Guru Kelas</SelectItem>
                                            <SelectItem value="Guru Mapel">Guru Mapel</SelectItem>
                                            <SelectItem value="Kepala Sekolah">Kepala Sekolah</SelectItem>
                                            <SelectItem value="Tenaga Administrasi">Tenaga Administrasi</SelectItem>
                                            <SelectItem value="Penjaga Sekolah">Penjaga Sekolah</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="joinDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tanggal Mulai Tugas</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
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
