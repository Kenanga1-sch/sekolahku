
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Loader2, User, Plus, Trash2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { compressImage } from "@/lib/utils";
import { ekskulTeachersApi, attendancePointsApi, type EkskulTeacher, type AttendancePoint } from "@/lib/presensi-gtk";

const employeeSchema = z.object({
  fullName: z.string().min(3, "Nama minimal 3 karakter"),
  email: z.string().email("Email tidak valid"),
  role: z.enum(["admin", "guru", "staff"]),

  // Details
  nip: z.string().optional(),
  nuptk: z.string().optional(),
  nik: z.string().optional(),
  employmentStatus: z.string().optional(),
  jobType: z.string().optional(),
  joinDate: z.string().optional(),
  phone: z.string().optional(),

  // Public profile
  photoUrl: z.string().optional().or(z.literal("")),
  category: z.string().optional(),
  degree: z.string().optional(),
  quote: z.string().optional(),
  displayOrder: z.coerce.number(),
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
  const [uploading, setUploading] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Ekskul yang diampu (khusus edit; pakai employeeId).
  const [ekskulList, setEkskulList] = useState<EkskulTeacher[]>([]);
  const [points, setPoints] = useState<AttendancePoint[]>([]);
  const [newEkskulName, setNewEkskulName] = useState("");
  const [newEkskulSchedule, setNewEkskulSchedule] = useState("");
  const [newEkskulPoint, setNewEkskulPoint] = useState("");
  const [ekskulBusy, setEkskulBusy] = useState(false);

  const loadEkskul = async (empId: string) => {
    try {
      const [all, pts] = await Promise.all([ekskulTeachersApi.list(), attendancePointsApi.list()]);
      const list = ((all as any)?.data || []).filter((e: EkskulTeacher) => e.employeeId === empId);
      setEkskulList(list);
      setPoints((pts as any)?.data || []);
    } catch {
      // diamkan — tab ekskul opsional
    }
  };

  const addEkskul = async () => {
    if (!employeeId || !newEkskulName.trim()) {
      showError("Nama ekskul wajib diisi");
      return;
    }
    setEkskulBusy(true);
    try {
      await ekskulTeachersApi.assign({
        employeeId,
        extracurricularName: newEkskulName.trim(),
        schedule: newEkskulSchedule.trim() || undefined,
        pointId: newEkskulPoint || undefined,
        isActive: true,
      });
      showSuccess("Ekskul ditambahkan");
      setNewEkskulName("");
      setNewEkskulSchedule("");
      setNewEkskulPoint("");
      await loadEkskul(employeeId);
    } catch (e: any) {
      showError(e?.message || "Gagal menambah ekskul");
    } finally {
      setEkskulBusy(false);
    }
  };

  const removeEkskul = async (id: string) => {
    if (!employeeId) return;
    try {
      await ekskulTeachersApi.remove(id);
      showSuccess("Ekskul dihapus");
      await loadEkskul(employeeId);
    } catch (e: any) {
      showError(e?.message || "Gagal menghapus ekskul");
    }
  };

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema) as any,
    defaultValues: {
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
      photoUrl: "",
      category: "none",
      degree: "",
      quote: "",
      displayOrder: 0,
    },
  });

  useEffect(() => {
    if (employeeId && open) {
        setIsLoading(true);
        goGet(`/api/master/employees/${employeeId}`)
            .then((data: any) => {
                let formattedDate = "";
                if (data.joinDate) {
                    const dateObj = new Date(data.joinDate);
                    if (!isNaN(dateObj.getTime())) {
                        formattedDate = dateObj.toISOString().split("T")[0];
                    } else {
                        formattedDate = data.joinDate;
                    }
                }

                form.reset({
                    // name SELALU tanpa gelar (gelar di field degree terpisah).
                    // Jangan pakai data.fullName — kini berisi "Nama, Gelar"
                    // (sinkron 2026-10) → prefill itu akan menaruh gelar ke
                    // field Nama dan menyimpannya balik (gelar ganda).
                    fullName: data.name || "",
                    email: data.email || "",
                    role: data.role || "guru",
                    employmentStatus: data.employmentStatus || "",
                    jobType: data.jobType || "",
                    nip: data.nip || "",
                    nuptk: data.nuptk || "",
                    nik: data.nik || "",
                    joinDate: formattedDate,
                    phone: data.phone || "",
                    photoUrl: data.photoUrl || "",
                    category: data.category || "none",
                    degree: data.degree || "",
                    quote: data.quote || "",
                    displayOrder: data.displayOrder ?? 0,
                });
                loadEkskul(employeeId);
            })
            .catch((e) => showError(e.message))
            .finally(() => setIsLoading(false));
    } else if (open) {
        setEkskulList([]);
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
            photoUrl: "",
            category: "none",
            degree: "",
            quote: "",
            displayOrder: 0,
        });
    }
  }, [employeeId, open, form]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
        setCropperOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    setUploading(true);
    let uploadFile: File | Blob = croppedBlob;
    try {
      const originalFile = new File([croppedBlob], "profile.jpg", { type: croppedBlob.type || "image/jpeg" });
      uploadFile = await compressImage(originalFile, 512, 0.85);
    } catch (e) {
      console.error("Failed to compress cropped image", e);
    }

    const formData = new FormData();
    formData.append("file", uploadFile, uploadFile instanceof File ? uploadFile.name : "profile.jpg");
    formData.append("folder", "staff");

    try {
        const data: any = await goPost("/api/upload", formData);
        if(data.success) {
            form.setValue("photoUrl", data.url);
            showSuccess("Foto berhasil diupload");
        } else {
            showError("Gagal upload foto");
        }
    } catch {
        showError("Error uploading");
    } finally {
        setUploading(false);
    }
  };

  const onSubmit = async (data: EmployeeFormValues) => {
    setIsLoading(true);
    try {
        const payload = {
            ...data,
            category: data.category === "none" ? "" : data.category,
            displayOrder: data.displayOrder ?? 0,
        };

        if (employeeId) {
            await goPut(`/api/master/employees/${employeeId}`, payload);
        } else {
            await goPost("/api/master/employees", payload);
        }

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
            Data biodata Guru & Tenaga Kependidikan. Akun login dibuat terpisah di Manajemen Pengguna.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="account">
                <TabsList className={`grid w-full grid-cols-1 ${employeeId ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
                    <TabsTrigger value="account">Akun Login</TabsTrigger>
                    <TabsTrigger value="employment">Kepegawaian</TabsTrigger>
                    <TabsTrigger value="public">Profil Publik</TabsTrigger>
                    {employeeId && <TabsTrigger value="ekskul">Ekskul</TabsTrigger>}
                </TabsList>

                <TabsContent value="account" className="space-y-4">
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nama Lengkap (Tanpa Gelar)</FormLabel>
                                <FormControl><Input {...field} placeholder="Siti Aminah" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            <SelectItem value="P3K">P3K / PPPK</SelectItem>
                                            <SelectItem value="GTY">GTY (Tetap Yayasan)</SelectItem>
                                            <SelectItem value="GTT">GTT (Tidak Tetap)</SelectItem>
                                            <SelectItem value="PTT">PTT (Pegawai Tidak Tetap)</SelectItem>
                                            <SelectItem value="Honorer">Honorer</SelectItem>
                                            <SelectItem value="Pembina Ekskul">Pembina Ekskul</SelectItem>
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
                                <FormControl><DateInput type="date" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>

                <TabsContent value="public" className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <FormField
                            control={form.control}
                            name="photoUrl"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>Foto Profil</FormLabel>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16 border">
                                            <AvatarImage src={field.value || undefined} />
                                            <AvatarFallback><User /></AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileSelect}
                                                disabled={uploading}
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {uploading ? "Mengupload..." : "Format: JPG/PNG. Max 2MB."}
                                            </p>
                                        </div>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Kategori Publik</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih kategori" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Tidak ditampilkan</SelectItem>
                                            <SelectItem value="kepsek">Kepala Sekolah</SelectItem>
                                            <SelectItem value="guru">Tenaga Pendidik (Guru)</SelectItem>
                                            <SelectItem value="staff">Tenaga Kependidikan (TU/Operator)</SelectItem>
                                            <SelectItem value="support">Support (Penjaga/Kebersihan)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="degree"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gelar</FormLabel>
                                    <FormControl>
                                        <Input placeholder="S.Pd, M.Kom" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="quote"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Motto / Pesan Singkat</FormLabel>
                                <FormControl>
                                    <Input placeholder="Pesan inspiratif..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="displayOrder"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Urutan Tampil di Halaman Publik</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>

                {employeeId && (
                    <TabsContent value="ekskul" className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-3 text-xs text-muted-foreground">
                            Daftar ekskul yang diampu GTK ini (mis. Pramuka, Drumband). Pengajar ekskul wajib
                            presensi & dapat discan di menu <b>Presensi → Scan GTK</b>.
                        </div>

                        {ekskulList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-3">Belum ada ekskul diampu.</p>
                        ) : (
                            <div className="space-y-2">
                                {ekskulList.map((e) => (
                                    <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">{e.extracurricularName}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {e.schedule || "Jadwal belum diatur"}
                                                {e.pointName ? ` · ${e.pointName}` : ""}
                                            </p>
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" className="text-rose-600 hover:text-rose-700" onClick={() => removeEkskul(e.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                            <p className="text-xs font-semibold text-slate-600">Tambah Ekskul</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Input placeholder="Nama ekskul (mis. Pramuka)" value={newEkskulName} onChange={(e) => setNewEkskulName(e.target.value)} />
                                <Input placeholder="Jadwal (mis. Jumat, 14:00)" value={newEkskulSchedule} onChange={(e) => setNewEkskulSchedule(e.target.value)} />
                            </div>
                            <Select value={newEkskulPoint || "none"} onValueChange={(v) => setNewEkskulPoint(v === "none" ? "" : v)}>
                                <SelectTrigger><SelectValue placeholder="Titik presensi (opsional)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Pakai titik sekolah (default)</SelectItem>
                                    {points.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>{p.name} · {p.radiusM} m</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button type="button" size="sm" onClick={addEkskul} disabled={ekskulBusy || !newEkskulName.trim()}>
                                {ekskulBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                                Tambah Ekskul
                            </Button>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
                <Button type="submit" disabled={isLoading || uploading}>
                    {(isLoading || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan Data
                </Button>
            </DialogFooter>
          </form>
        </Form>

        <ImageCropper
            isOpen={cropperOpen}
            onClose={() => setCropperOpen(false)}
            imageSrc={selectedImage}
            onCropComplete={onCropComplete}
        />
      </DialogContent>
    </Dialog>
  );
}
