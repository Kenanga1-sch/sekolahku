"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Package, MapPin, Calendar, User, BookOpen, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PublicLabelData {
  type: string;
  id: string;
  name: string;
  code: string;
  category: string;
  unit?: string;
  location: string;
  fundingSource: string;
  fiscalYear: number;
  photoUrl?: string;
  quantity: number;
  unitNumber?: number;
  condition?: { good: number; lightDamaged: number; heavyDamaged: number; lost: number };
  activeBorrow?: { requesterName: string; reason: string; since: string };
  transfers?: { fromRoom: string; toRoom: string; at: string }[];
  recentTransactions?: { type: string; quantity: number; description: string; at: string }[];
}

function formatDate(iso: string): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export function PublicLabelDetailClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PublicLabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id");
    const t = searchParams.get("t") || searchParams.get("type") || "asset";
    const u = searchParams.get("u");

    if (!id) {
      setError("ID tidak ditemukan");
      setLoading(false);
      return;
    }

    const fetchUrl = `/api/public/inventory/label?id=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}${u ? `&u=${u}` : ""}`;

    fetch(fetchUrl)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((err) => setError(err.message || "Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Data Tidak Ditemukan</h1>
        <p className="text-muted-foreground">{error || "Data inventaris tidak tersedia"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold">
          Inventaris {data.fundingSource || "Sekolah"} {data.fiscalYear}
        </h1>
        <p className="text-sm text-muted-foreground">
          Unit {data.unitNumber || 1} dari {data.quantity}
        </p>
      </div>

      {data.photoUrl ? (
        <div className="w-full h-40 rounded-lg overflow-hidden bg-muted">
          <img src={data.photoUrl} alt={data.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-full h-40 rounded-lg bg-muted flex items-center justify-center">
          <Package className="h-12 w-12 text-muted-foreground/30" />
        </div>
      )}

      <Card>
        <CardContent className="space-y-3 py-4">
          <h2 className="font-semibold text-base">{data.name}</h2>
          {data.code && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Kode:</span>
              <Badge variant="outline">{data.code}</Badge>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Kategori:</span>
            <span>{data.category}</span>
          </div>
          {data.unit && (
            <div className="text-sm">
              <span className="text-muted-foreground">Satuan: </span>
              <span>{data.unit}</span>
            </div>
          )}
          {data.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{data.location}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {data.condition && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold text-sm mb-2">Kondisi</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Baik</span>
                <span className="font-medium text-green-600">{data.condition.good}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rusak Ringan</span>
                <span className="font-medium text-yellow-600">{data.condition.lightDamaged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rusak Berat</span>
                <span className="font-medium text-red-600">{data.condition.heavyDamaged}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hilang</span>
                <span className="font-medium text-gray-500">{data.condition.lost}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data.activeBorrow && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold text-sm mb-2">Sedang Dipinjam</h3>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{data.activeBorrow.requesterName}</span>
              </div>
              {data.activeBorrow.reason && (
                <p className="text-muted-foreground">{data.activeBorrow.reason}</p>
              )}
              {data.activeBorrow.since && (
                <p className="text-xs text-muted-foreground">
                  Sejak {formatDate(data.activeBorrow.since)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {data.transfers && data.transfers.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold text-sm mb-2">Riwayat Pemindahan</h3>
            <div className="space-y-2">
              {data.transfers.slice(0, 3).map((t, i) => (
                <div key={i} className="text-sm">
                  <span className="text-muted-foreground">{formatDate(t.at)}:</span>{" "}
                  {t.fromRoom || "-"} → {t.toRoom || "-"}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.recentTransactions && data.recentTransactions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h3 className="font-semibold text-sm mb-2">Mutasi Terakhir</h3>
            <div className="space-y-2">
              {data.recentTransactions.map((tx, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {tx.type === "IN" ? "+" : "-"}{tx.quantity} {data.unit || "unit"}
                    {tx.description ? ` — ${tx.description}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(tx.at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
