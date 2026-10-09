"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search } from "lucide-react";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import { formatNamaGtk } from "@/lib/gtk-name";

type GtkAccount = {
  id: string;
  employeeId: string;
  nama: string;
  kategori: string;
  qrCode: string;
  saldoTerakhir: number;
};

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export function TabunganGtkTab() {
  const [rows, setRows] = useState<GtkAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search.trim()) params.set("search", search.trim());
      const res: any = await goGet(`/api/tabungan/gtk?${params.toString()}`);
      setRows(res?.data || []);
      setTotal(res?.total || 0);
    } catch {
      showError("Gagal memuat tabungan GTK");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <Card>
      <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Tabungan GTK</CardTitle>
            <CardDescription>
              {total} rekening GTK. Setor/tarik dilakukan lewat Scan Harian (kartu GTK).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, NIP, atau QR GTK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 border-slate-200 dark:border-zinc-800"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Belum ada rekening GTK. Rekening dibuat otomatis saat kartu GTK pertama kali di-scan.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-zinc-800">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{formatNamaGtk(r.nama, null)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{r.qrCode}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.kategori && <Badge variant="outline" className="text-[11px]">{r.kategori}</Badge>}
                  <span className="font-mono font-semibold text-sm">{formatRupiah(r.saldoTerakhir)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
