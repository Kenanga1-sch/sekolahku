"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  History,
  ArrowDownRight,
  ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";

interface ItemDetail {
  id: string;
  name: string;
  code: string;
  category: string;
  unit: string;
  minStock: number;
  currentStock: number;
  price: number;
  location: string;
  transactions: any[];
}

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/inventory/items/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setItem(data);
        setLoading(false);
      })
      .catch((err) => {
        toast.error("Gagal memuat detail barang");
        router.push("/inventaris/stok");
      });
  }, [params.id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           name: item.name,
           code: item.code,
           category: item.category,
           unit: item.unit,
           minStock: item.minStock,
           price: item.price,
           location: item.location
        }),
      });

      if (!res.ok) throw new Error("Failed to update");
      
      toast.success("Perubahan disimpan");
    } catch (error) {
      toast.error("Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat data...</div>;
  if (!item) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
           <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
           <p className="text-muted-foreground">Detail barang dan riwayat mutasi stok (Kartu Stok).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Column: Edit Form */}
         <div className="lg:col-span-1 space-y-6">
            <Card>
               <CardHeader>
                  <CardTitle>Informasi Barang</CardTitle>
               </CardHeader>
               <CardContent>
                  <form onSubmit={handleUpdate} className="space-y-4">
                      <div className="space-y-2">
                          <Label>Nama Barang</Label>
                          <Input 
                            value={item.name} 
                            onChange={(e) => setItem({...item, name: e.target.value})}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>Kode Barang</Label>
                          <Input 
                            value={item.code || ""} 
                            onChange={(e) => setItem({...item, code: e.target.value})}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>Kategori</Label>
                          <Select 
                            value={item.category} 
                            onValueChange={(val) => setItem({...item, category: val})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ATK">Alat Tulis Kantor</SelectItem>
                              <SelectItem value="ART">Rumah Tangga</SelectItem>
                              <SelectItem value="KEBERSIHAN">Alat Kebersihan</SelectItem>
                              <SelectItem value="ELEKTRONIK">Elektronik</SelectItem>
                              <SelectItem value="LAINNYA">Lainnya</SelectItem>
                            </SelectContent>
                          </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label>Satuan</Label>
                              <Input 
                                value={item.unit} 
                                onChange={(e) => setItem({...item, unit: e.target.value})}
                              />
                          </div>
                          <div className="space-y-2">
                              <Label>Min. Stok</Label>
                              <Input 
                                type="number"
                                value={item.minStock} 
                                onChange={(e) => setItem({...item, minStock: parseInt(e.target.value) || 0})}
                              />
                          </div>
                      </div>
                      <div className="space-y-2">
                          <Label>Harga Estimasi</Label>
                          <Input 
                            type="number"
                            value={item.price} 
                            onChange={(e) => setItem({...item, price: parseInt(e.target.value) || 0})}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label>Lokasi</Label>
                          <Input 
                            value={item.location || ""} 
                            onChange={(e) => setItem({...item, location: e.target.value})}
                          />
                      </div>

                      <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
                         <Save className="mr-2 h-4 w-4" /> Simpan Perubahan
                      </Button>
                  </form>
               </CardContent>
            </Card>

            <Card className="bg-zinc-50 dark:bg-zinc-900 border-dashed">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <span className="text-sm text-muted-foreground mb-2">Total Stok Saat Ini</span>
                    <span className="text-4xl font-bold text-foreground">{item.currentStock}</span>
                    <span className="text-sm text-muted-foreground mt-1">{item.unit}</span>
                </CardContent>
            </Card>
         </div>

         {/* Right Column: Transaction History */}
         <div className="lg:col-span-2">
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                       <History className="h-5 w-5" /> Kartu Stok
                    </CardTitle>
                    <CardDescription>Riwayat keluar masuk barang</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Jumlah</TableHead>
                                <TableHead>Ket / Penerima</TableHead>
                                <TableHead>Petugas</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {item.transactions && item.transactions.length > 0 ? (
                                item.transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((trx) => (
                                    <TableRow key={trx.id}>
                                        <TableCell className="whitespace-nowrap">
                                            {format(new Date(trx.date), "dd/MM/yyyy", { locale: id })}
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                trx.type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 
                                                trx.type === 'OUT' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {trx.type === 'IN' ? 'Masuk' : trx.type === 'OUT' ? 'Keluar' : trx.type}
                                            </span>
                                        </TableCell>
                                        <TableCell className={`font-bold ${trx.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {trx.type === 'IN' ? '+' : '-'}{trx.quantity}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate">
                                            {trx.description}
                                            {trx.recipient && <div className="text-xs text-muted-foreground">Oleh: {trx.recipient}</div>}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {/* User ID currently, ideally join with user name in API */}
                                            Admin
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada history transaksi.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
         </div>
      </div>
    </div>
  );
}
