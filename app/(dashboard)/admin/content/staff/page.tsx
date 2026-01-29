"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { 
  Loader2, 
  Plus, 
  Pencil, 
  Trash2, 
  MoreHorizontal, 
  Search,
  Upload,
  User
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropper } from "@/components/ui/image-cropper";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const staffSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  degree: z.string().optional(),
  position: z.string().min(1, "Jabatan wajib diisi"),
  category: z.enum(["kepsek", "guru", "staff", "support"]),
  nip: z.string().optional(),
  quote: z.string().optional(),
  displayOrder: z.coerce.number(),
  isActive: z.boolean(),
  photoUrl: z.string().optional().or(z.literal("")),
});

type StaffFormValues = z.infer<typeof staffSchema>;

export default function AdminStaffPage() {
  const { data, error, isLoading } = useSWR("/api/admin/staff", fetcher);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Cropper State
  const [cropperOpen, setCropperOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema) as any,
    defaultValues: {
      name: "",
      degree: "",
      position: "",
      category: "guru",
      displayOrder: 0,
      isActive: true,
      quote: "",
      nip: "",
      photoUrl: "",
    },
  });

  const staffList = data?.data || [];
  
  const filteredList = staffList.filter((staff: any) => 
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = async (values: z.infer<typeof staffSchema>) => {
    try {
      const url = selectedStaff 
        ? `/api/admin/staff/${selectedStaff.id}` 
        : "/api/admin/staff";
      
      const method = selectedStaff ? "PATCH" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Gagal menyimpan data");

      toast.success(selectedStaff ? "Data diperbarui" : "Staff ditambahkan");
      mutate("/api/admin/staff");
      setIsDialogOpen(false);
      form.reset();
      setSelectedStaff(null);
    } catch (error) {
      toast.error("Terjadi kesalahan");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus data ini?")) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      
      toast.success("Data dihapus");
      mutate("/api/admin/staff");
    } catch (error) {
      toast.error("Gagal menghapus data");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = (staff: any) => {
    setSelectedStaff(staff);
    form.reset({
      name: staff.name,
      degree: staff.degree || "",
      position: staff.position,
      category: staff.category,
      nip: staff.nip || "",
      quote: staff.quote || "",
      displayOrder: staff.displayOrder,
      isActive: staff.isActive,
      photoUrl: staff.photoUrl || "",
    });
    setIsDialogOpen(true);
  };

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
    const formData = new FormData();
    formData.append("file", croppedBlob, "profile.jpg");
    formData.append("folder", "staff");

    try {
        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if(data.success) {
            form.setValue("photoUrl", data.url);
            toast.success("Foto berhasil diupload");
        } else {
            toast.error("Gagal upload foto");
        }
    } catch (e) {
        toast.error("Error uploading");
    } finally {
        setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Guru & Staff</h1>
          <p className="text-muted-foreground">Kelola profil tenaga pendidik dan kependidikan.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if(!open) {
                setSelectedStaff(null);
                form.reset({
                  name: "",
                  degree: "",
                  position: "",
                  category: "guru",
                  displayOrder: 0,
                  isActive: true,
                  quote: "",
                  nip: "",
                  photoUrl: "",
                });
            }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Tambah Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedStaff ? "Edit Staff" : "Tambah Staff Baru"}</DialogTitle>
              <DialogDescription>
                Lengkapi data profil staff di bawah ini.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Lengkap (Tanpa Gelar)</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: Budi Santoso" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="degree"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gelar (Opsional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: S.Pd, M.Kom (Boleh kosong)" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jabatan</FormLabel>
                          <FormControl>
                            <Input placeholder="Contoh: Guru Kelas 1B" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Kategori</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih kategori" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
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
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nip"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NIP / NUPTK (Opsional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Nomor Induk..." {...field} />
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
                          <FormLabel>Urutan Tampil</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>

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

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting || uploading}>
                        {form.formState.isSubmitting ? "Menyimpan..." : "Simpan Data"}
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
         <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau jabatan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
         </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Foto</TableHead>
              <TableHead>Nama Lengkap</TableHead>
              <TableHead>Gelar</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Urutan</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                </TableRow>
            ) : filteredList.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Belum ada data staff.
                    </TableCell>
                </TableRow>
            ) : (
                filteredList.map((staff: any) => (
                    <TableRow key={staff.id}>
                        <TableCell>
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={staff.photoUrl || undefined} />
                                <AvatarFallback>{staff.name[0]}</AvatarFallback>
                            </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">
                            {staff.name}
                            {staff.nip && <div className="text-xs text-muted-foreground">NIP: {staff.nip}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {staff.degree || "-"}
                        </TableCell>
                        <TableCell>{staff.position}</TableCell>
                        <TableCell>
                            <Badge variant="outline" className="capitalize">
                                {staff.category === 'kepsek' ? 'Kepala Sekolah' : staff.category}
                            </Badge>
                        </TableCell>
                        <TableCell>{staff.displayOrder}</TableCell>
                        <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(staff)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(staff.id)}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
        
      <ImageCropper
        isOpen={cropperOpen}
        onClose={() => setCropperOpen(false)}
        imageSrc={selectedImage}
        onCropComplete={onCropComplete}
      />
    </div>
  );
}
