"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

interface Transaction {
  id: string;
  tipe: string;
  nominal: number;
  keterangan: string;
  createdAt: number;
}

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(ms: number): string {
  if (!ms) return "-";
  const d = new Date(ms);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export default function TabunganSayaPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSavings = async () => {
      try {
        const res = await fetch("/api/student/me/savings");
        const json = await res.json();
        if (json.success) {
          setBalance(json.data.balance || 0);
          setTransactions(json.data.transaksi || []);
        }
      } catch (err) {
        console.error("Gagal memuat tabungan:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSavings();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tabungan Saya</h1>

      {/* Balance card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Saldo Saat Ini</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatRupiah(balance)}</div>
        </CardContent>
      </Card>

      {/* Transaction list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Riwayat Transaksi</h2>
        {transactions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Belum ada transaksi.
            </CardContent>
          </Card>
        ) : (
          transactions.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {t.tipe === "setoran" ? (
                    <ArrowUpCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">{t.keterangan}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</div>
                  </div>
                </div>
                <div className={`font-semibold ${t.tipe === "setoran" ? "text-green-600" : "text-red-600"}`}>
                  {t.tipe === "setoran" ? "+" : "-"}{formatRupiah(t.nominal)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
