"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getChildSavingsAction, getChildrenAction } from "@/actions/parent";

interface Child {
  studentId: string;
  fullName: string;
  className: string;
}

interface TxItem {
  id: string;
  tipe: string;
  nominal: number;
  status: string;
  catatan: string;
  createdAt: number;
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);

const formatDate = (ms: number) => {
  try {
    return new Date(ms).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
};

export default function ParentTabunganClient() {
  const [children, setChildren] = useState<Child[]>([]);
  const [studentId, setStudentId] = useState("");
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getChildrenAction();
        if (res.success) {
          const list = (res.data as Child[]) || [];
          setChildren(list);
          if (list[0]?.studentId) setStudentId(list[0].studentId);
        }
      } catch {
        toast.error("Gagal memuat data anak");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await getChildSavingsAction(studentId);
        if (res.success) {
          const data = res.data as { balance: number; transactions: TxItem[] };
          setBalance(data.balance || 0);
          setTransactions(data.transactions || []);
        }
      } catch {
        toast.error("Gagal memuat data tabungan");
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Tabungan</h1>
        <p className="text-sm text-muted-foreground">Saldo dan riwayat transaksi tabungan anak Anda.</p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {children.map((c) => (
            <button
              key={c.studentId}
              onClick={() => setStudentId(c.studentId)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                studentId === c.studentId
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c.fullName}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        </div>
      ) : studentId ? (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Tabungan</p>
                  <p className="text-2xl font-bold">{formatRupiah(balance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riwayat Transaksi</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Belum ada transaksi.</p>
              ) : (
                <div className="divide-y">
                  {transactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "rounded-full p-1.5",
                          t.tipe === "setor" ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30",
                        )}>
                          {t.tipe === "setor" ? (
                            <ArrowDownCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          ) : (
                            <ArrowUpCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium capitalize">{t.tipe === "setor" ? "Setoran" : "Penarikan"}</p>
                          <p className="text-xs text-muted-foreground truncate">{t.catatan || formatDate(t.createdAt)}</p>
                        </div>
                      </div>
                      <p className={cn(
                        "text-sm font-semibold shrink-0",
                        t.tipe === "setor" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
                      )}>
                        {t.tipe === "setor" ? "+" : "-"}{formatRupiah(t.nominal)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada data anak yang tertaut ke akun ini.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
