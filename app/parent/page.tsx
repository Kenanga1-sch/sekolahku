"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { GraduationCap, Wallet, Loader2, ChevronRight, IdCard } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getChildrenAction } from "@/actions/parent";

interface Child {
  studentId: string;
  fullName: string;
  nisn: string;
  classId: string;
  className: string;
  photo?: string | null;
  relation: string;
  balance: number;
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

export default function ParentHomePage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getChildrenAction();
        if (res.success) {
          setChildren((res.data as Child[]) || []);
        } else {
          toast.error(res.error || "Gagal memuat data anak");
        }
      } catch {
        toast.error("Gagal memuat data anak");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Beranda</h1>
        <p className="text-sm text-muted-foreground">Ringkasan data anak Anda.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini. Hubungi sekolah untuk menautkan akun Anda.
          </CardContent>
        </Card>
      ) : (
        children.map((c) => (
          <Card key={c.studentId}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {c.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.photo} alt={c.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">{c.fullName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="inline-flex items-center gap-1"><IdCard className="h-3 w-3" /> {c.nisn || "-"}</span>
                    <span>{c.className || "-"}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3.5 w-3.5" /> Saldo Tabungan</p>
                  <p className="font-semibold mt-0.5">{formatRupiah(c.balance)}</p>
                </div>
                <Link
                  href={`/parent/izin?anak=${c.studentId}`}
                  className="rounded-lg border bg-muted/30 p-3 hover:bg-muted transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Pengajuan Izin/Sakit</p>
                    <p className="font-medium mt-0.5">Ajukan</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
