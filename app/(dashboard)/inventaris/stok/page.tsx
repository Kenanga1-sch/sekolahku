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
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { goGet, goPost, goDelete } from "@/lib/api-client";
import { uploadPhoto } from "@/lib/inventory";

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
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "ATK",
    unit: "Pcs",
    minStock: 5,
    price: 0,
    location: "",
    funding_source: "",
    fiscal_year: new Date().getFullYear(),
    photo_url: "",
  });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter && categoryFilter !== "ALL") params.set("category", categoryFilter);
      
      const res: any = await goGet(`/api/inventory/items?${params.toString()}`);
      if (res.error) throw new Error(res.error);
      setItems(res.items || res.data || []);
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
      const payload = {
        ...formData,
        fundingSource: formData.funding_source || undefined,
        fiscalYear: formData.fiscal_year || undefined,
        photoUrl: formData.photo_url || undefined,
      };
      const res: any = await goPost("/api/inventory/items", payload);

      if (res.error) throw new Error(res.error || "Failed to create");
      
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
        funding_source: "",
        fiscal_year: new Date().getFullYear(),
        photo_url: "",
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
      const res: any = await goDelete(`/api/inventory/items/${id}`);
      if (res.error) {
        throw new Error(res.error);
      }
      toast.success("Barang dihapus");
      fetchItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kode-barang">Kode Barang</Label>
                  <Input id="kode-barang" 
                    placeholder="Contoh: ATK-001" 
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kategori">Kategori</Label>
                  <Select value={formData.category} 
          onValueChange={(val) => setFormData({...formData, category: val})}
                  >
                    <SelectTrigger id="kategori">
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
                <Label htmlFor="nama-barang">Nama Barang <span className="text-red-500">*</span></Label>
                <Input id="nama-barang" 
                  required 
                  placeholder="Contoh: Spidol Boardmarker Hitam"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="satuan">Satuan</Label>
                  <Input id="satuan" 
                    placeholder="Pcs, Box, Pack" 
                    value={formData.unit}
                    onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-stok-alert">Min. Stok (Alert)</Label>
                  <Input id="min-stok-alert" 
                    type="number" 
                    min="0"
                    value={formData.minStock}
                    onChange={(e) => setFormData({...formData, minStock: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2">
                  <Label htmlFor="estimasi-harga">Estimasi Harga</Label>
                  <Input id="estimasi-harga" 
                    type="number" 
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lokasi-penyimpanan">Lokasi Penyimpanan</Label>
                  <Input id="lokasi-penyimpanan" 
                    placeholder="Lemari A, Gudang B" 
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                  />
                </div>
              </div>

              <div className="border rounded-md p-4 bg-muted/50 space-y-4">
                <Label className="block font-semibold">Label & Sumber Dana</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="funding_source">Sumber Dana</Label>
                    <Select value={formData.funding_source}
                      onValueChange={(val) => setFormData({...formData, funding_source: val})}
                    >
                      <SelectTrigger id="funding_source">
                        <SelectValue placeholder="Pilih sumber dana" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BOSP Reguler">BOSP Reguler</SelectItem>
                        <SelectItem value="BOSP Kinerja">BOSP Kinerja</SelectItem>
                        <SelectItem value="APBD">APBD</SelectItem>
                        <SelectItem value="BOSDA">BOSDA</SelectItem>
                        <SelectItem value="Komite Sekolah">Komite Sekolah</SelectItem>
                        <SelectItem value="Hibah">Hibah</SelectItem>
                        <SelectItem value="Swadaya">Swadaya</SelectItem>
                        <SelectItem value="Lainnya">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fiscal_year">Tahun Anggaran</Label>
                    <Input id="fiscal_year"
                      type="number"
                      min="2020"
                      max="2035"
                      value={formData.fiscal_year}
                      onChange={(e) => setFormData({...formData, fiscal_year: parseInt(e.target.value) || new Date().getFullYear()})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Foto Barang (opsional)</Label>
                  {formData.photo_url ? (
                    <div className="flex items-start gap-3">
                      <div className="w-20 h-20 rounded-md border overflow-hidden bg-muted flex-shrink-0">
                        <img src={formData.photo_url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => setFormData({...formData, photo_url: ""})}>
                        <Trash2 className="h-4 w-4 mr-1" /> Hapus Foto
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Button type="button" variant="outline" size="sm">
                        Pilih Foto
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = await uploadPhoto(file);
                            setFormData({...formData, photo_url: url});
                            toast.success("Foto berhasil diunggah");
                          } catch {
                            toast.error("Gagal mengunggah foto");
                          }
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Opsional. Ditampilkan di halaman publik saat QR discan.
                  </p>
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

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
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
          <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-zinc-800">
             <Filter className="mr-2 h-4 w-4" />
             <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Kategori</SelectItem>
            <SelectItem value="ATK">ATK</SelectItem>
            <SelectItem value="ART">Rumah Tangga</SelectItem>
            <SelectItem value="KEBERSIHAN">Kebersihan</SelectItem>
             <SelectItem value="ELEKTRONIK">Elektronik</SelectItem>
              <SelectItem value="LAINNYA">Lainnya</SelectItem>
           </SelectContent>
         </Select>
       </div>

       <div className="flex justify-end">
         <Button size="sm" disabled={selectedIds.length === 0}
           onClick={() => {
             const ids = selectedIds.join(",");
             window.open(`/inventaris/label?items=${ids}`, '_blank');
           }}>
           <Printer className="h-4 w-4 mr-2" />
           Cetak Label ({selectedIds.length})
         </Button>
       </div>

       <DataTable
         data={loading ? [] : items}
         getRowId={(item) => item.id}
         loading={loading}
         selectable
         selectedIds={selectedIds}
         onToggleSelect={(id) => {
           setSelectedIds((prev) =>
             prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
           );
         }}
         onToggleSelectAll={() => {
           if (selectedIds.length === items.length) {
             setSelectedIds([]);
           } else {
             setSelectedIds(items.map((i: any) => i.id));
           }
         }}
        emptyTitle="Tidak ada barang ditemukan."
        emptyDescription="Coba ubah kata kunci pencarian atau filter kategori."
        columns={[
            {
              key: "name",
              header: "Info Barang",
              card: "title",
              render: (item) => (
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.code || "-"}</span>
                </div>
              ),
            },
            {
              key: "category",
              header: "Kategori",
              card: "field",
              render: (item) => (
                <Badge variant="secondary" className="text-xs">
                  {item.category}
                </Badge>
              ),
            },
            {
              key: "location",
              header: "Lokasi",
              card: "field",
              render: (item) => (
                <span className="text-sm text-muted-foreground">
                  {item.location || "-"}
                </span>
              ),
            },
            {
              key: "currentStock",
              header: "Stok Saat Ini",
              card: "field",
              render: (item) => (
                 <div className="flex items-center justify-end gap-2">
                   {item.currentStock <= item.minStock && (
                      <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                   )}
                   <span className={`font-bold ${item.currentStock <= item.minStock ? 'text-amber-600' : ''}`}>
                     {item.currentStock}
                   </span>
                   <span className="text-xs text-muted-foreground">{item.unit}</span>
                </div>
              ),
            },
        ]}
        actions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-muted-foreground hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
             <DropdownMenuContent align="end">
               <DropdownMenuItem onClick={() => router.push(`/inventaris/stok/detail?id=${item.id}`)}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Detail
               </DropdownMenuItem>
               <DropdownMenuItem onClick={() => window.open(`/inventaris/label?items=${item.id}`, '_blank')}>
                  <Printer className="mr-2 h-4 w-4" /> Cetak Label
               </DropdownMenuItem>
               <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(item.id)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Hapus
               </DropdownMenuItem>
             </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}

