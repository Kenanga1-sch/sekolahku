"use client";

import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2,
  AlertTriangle,
  Package
} from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Manual debounce if hook helps avoid lookup
function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function StokPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "ATK",
    unit: "Pcs",
    minStock: 5,
    price: 0,
    location: "",
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter);
      
      const res = await fetch(`/api/inventory/items?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.data);
    } catch (error) {
      toast.error("Gagal memuat data barang");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [debouncedSearch, categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error("Failed to create");
      
      toast.success("Barang berhasil ditambahkan");
      setIsAddOpen(false);
      setFormData({
        name: "",
        code: "",
        category: "ATK",
        unit: "Pcs",
        minStock: 5,
        price: 0,
        location: "",
      });
      fetchItems();
    } catch (error) {
      toast.error("Gagal menyimpan barang");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/inventory/items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt);
      }
      toast.success("Barang dihapus");
      fetchItems();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Data Barang (Stok)</h1>
          <p className="text-muted-foreground">
            Daftar barang habis pakai, ATK, dan perlengkapan.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Tambah Barang
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Tambah Barang Baru</DialogTitle>
              <DialogDescription>
                Masukkan detail barang baru untuk inventaris stok.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Barang</Label>
                  <Input 
                    placeholder="Contoh: ATK-001" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(val) => setFormData({...formData, category: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATK">Alat Tulis Kantor</SelectItem>
                      <SelectItem value="ART">Rumah Tangga</SelectItem>
                      <SelectItem value="KEBERSIHAN">Alat Kebersihan</SelectItem>
                      <SelectItem value="ELEKTRONIK">Elektronik (Habis Pakai)</SelectItem>
                      <SelectItem value="LAINNYA">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nama Barang <span className="text-red-500">*</span></Label>
                <Input 
                  required 
                  placeholder="Contoh: Spidol Boardmarker Hitam"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Satuan</Label>
                  <Input 
                    placeholder="Pcs, Box, Pack" 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min. Stok (Alert)</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <Label>Estimasi Harga</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lokasi Penyimpanan</Label>
                  <Input 
                    placeholder="Lemari A, Gudang B" 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Menyimpan..." : "Simpan Barang"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama barang atau kode..."
            className="pl-9 bg-white dark:bg-zinc-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-zinc-800">
             <Filter className="mr-2 h-4 w-4" />
             <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kategori</SelectItem>
            <SelectItem value="ATK">ATK</SelectItem>
            <SelectItem value="ART">Rumah Tangga</SelectItem>
            <SelectItem value="KEBERSIHAN">Kebersihan</SelectItem>
             <SelectItem value="LAINNYA">Lainnya</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border bg-white dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Info Barang</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead className="text-right">Stok Saat Ini</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               [1,2,3,4,5].map(i => (
                 <TableRow key={i}>
                   <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                   <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                   <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                   <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                   <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                 </TableRow>
               ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Tidak ada barang ditemukan.
                </TableCell>
              </TableRow>
            ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.code || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.location || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                          {item.currentStock <= item.minStock && (
                             <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                          )}
                          <span className={`font-bold ${item.currentStock <= item.minStock ? 'text-amber-600' : ''}`}>
                            {item.currentStock}
                          </span>
                          <span className="text-xs text-muted-foreground">{item.unit}</span>
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/inventaris/stok/${item.id}`)}>
                             <Edit className="mr-2 h-4 w-4" /> Edit Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
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
    </div>
  );
}
