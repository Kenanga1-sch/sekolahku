"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  AlertTriangle,
  Loader2,
  Package,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showError, showSuccess } from "@/lib/toast";
import { goDelete, goGet } from "@/lib/api-client";

interface InventoryItem {
  id: string;
  name: string;
  code?: string | null;
  category: string;
  unit: string;
  minStock: number;
  currentStock: number;
  location?: string | null;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

export default function StockItemDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams.get("id");

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!itemId) {
      router.push("/inventaris/stok");
      return;
    }
    void fetchItemData(itemId);
  }, [itemId, router]);

  const fetchItemData = async (id: string) => {
    setIsLoading(true);
    try {
      const data: any = await goGet(`/api/inventory/items/${id}`);
      if (data.error) throw new Error(data.error);
      setItem(data.item || data);
      setHistory(data.history || []);
    } catch (error) {
      showError("Gagal memuat data barang stok");
      router.push("/inventaris/stok");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!itemId || !confirm("Hapus barang stok ini beserta riwayat transaksinya?")) return;
    try {
      await goDelete(`/api/inventory/items/${itemId}`);
      showSuccess("Barang stok berhasil dihapus");
      router.push("/inventaris/stok");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Gagal menghapus barang stok");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!item) return null;

  const isLowStock = item.currentStock <= item.minStock;
  const stockValue = item.currentStock * item.price;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{item.name}</h1>
            <p className="font-mono text-sm text-muted-foreground">{item.code || "-"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/inventaris/transaksi/masuk")}>
            <ArrowDownRight className="mr-2 h-4 w-4" /> Barang Masuk
          </Button>
          <Button variant="outline" onClick={() => router.push("/inventaris/transaksi/keluar")}>
            <ArrowUpRight className="mr-2 h-4 w-4" /> Barang Keluar
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" /> Hapus
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Stok Saat Ini</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-3xl font-bold ${isLowStock ? "text-amber-600" : ""}`}>
                {item.currentStock}
              </span>
              <span className="text-sm text-muted-foreground">{item.unit}</span>
            </div>
            {isLowStock && (
              <Badge variant="outline" className="mt-3 border-amber-300 text-amber-700">
                <AlertTriangle className="mr-1 h-3 w-3" /> Stok menipis
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Minimal Stok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{item.minStock}</div>
            <p className="text-sm text-muted-foreground">{item.unit}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Harga Satuan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(item.price)}</div>
            <p className="text-sm text-muted-foreground">per {item.unit}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Nilai Stok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(stockValue)}</div>
            <p className="text-sm text-muted-foreground">{item.currentStock} x harga satuan</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" /> Informasi Barang
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <InfoRow label="Kategori" value={item.category} />
            <InfoRow label="Lokasi" value={item.location || "-"} />
            <InfoRow label="Diperbarui" value={item.updatedAt ? new Date(item.updatedAt).toLocaleString("id-ID") : "-"} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Riwayat Transaksi Stok</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Keterangan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Belum ada transaksi untuk barang ini
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((trx) => (
                    <TableRow key={trx.id}>
                      <TableCell className="text-sm">
                        {trx.date ? new Date(trx.date).toLocaleDateString("id-ID") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trx.type === "IN" ? "default" : "destructive"}>
                          {trx.type === "IN" ? "Masuk" : "Keluar"}
                        </Badge>
                      </TableCell>
                      <TableCell className={trx.type === "IN" ? "text-emerald-600" : "text-rose-600"}>
                        {trx.type === "IN" ? "+" : "-"}{trx.quantity} {item.unit}
                      </TableCell>
                      <TableCell className="text-sm">{trx.description || trx.recipient || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}
