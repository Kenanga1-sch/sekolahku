"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, CreditCard, Loader2 } from "lucide-react";

import type { Hutang } from "./types";

const formatRupiah = (num: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

/** Dialog form pembayaran cicilan hutang (tunai atau potong tabungan). */
export function PayHutangDialog({
  hutang,
  savingsBalance,
  paymentMethod,
  payAmount,
  isPaying,
  onPaymentMethodChange,
  onPayAmountChange,
  onSubmit,
  onClose,
}: {
  hutang: Hutang | null;
  savingsBalance: number;
  paymentMethod: "cash" | "tabungan";
  payAmount: string;
  isPaying: boolean;
  onPaymentMethodChange: (m: "cash" | "tabungan") => void;
  onPayAmountChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!hutang} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Form Pembayaran Cicilan</DialogTitle>
          <DialogDescription>
            Pilih metode pembayaran (Tunai vs Potong Tabungan) dan masukkan nominal bayar.
          </DialogDescription>
        </DialogHeader>
        {hutang && (
          <form onSubmit={onSubmit} className="space-y-4 pt-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nama Siswa</Label>
              <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {hutang.siswa?.nama || "-"}
              </div>
              <div className="text-xs text-muted-foreground">
                NISN: {hutang.siswa?.nisn || "-"} • Kelas {hutang.siswa?.kelas || "-"}
              </div>
            </div>

            <div className="space-y-1.5 border-t dark:border-slate-800 pt-3">
              <Label className="text-xs text-muted-foreground">Detail Hutang</Label>
              <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">{hutang.namaBarang}</div>
              <div className="text-xs flex justify-between">
                <span>Total Tagihan ({hutang.jumlah}x):</span>
                <span className="font-mono">{formatRupiah(hutang.nominal * hutang.jumlah)}</span>
              </div>
              <div className="text-xs flex justify-between text-emerald-600">
                <span>Sudah Dibayar:</span>
                <span className="font-mono">{formatRupiah(hutang.terbayar)}</span>
              </div>
              <div className="text-xs flex justify-between font-bold text-amber-600 border-t dark:border-slate-800 pt-1.5">
                <span>Sisa Tagihan:</span>
                <span className="font-mono">{formatRupiah((hutang.nominal * hutang.jumlah) - hutang.terbayar)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t dark:border-slate-800 pt-3">
              <Label>Metode Pembayaran</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={paymentMethod === "cash" ? "default" : "outline"}
                  onClick={() => onPaymentMethodChange("cash")}
                  className="w-full flex items-center justify-center gap-1.5 h-9"
                >
                  <Coins className="h-4 w-4" />
                  Tunai (Cash)
                </Button>
                <Button
                  type="button"
                  variant={paymentMethod === "tabungan" ? "default" : "outline"}
                  onClick={() => onPaymentMethodChange("tabungan")}
                  className="w-full flex items-center justify-center gap-1.5 h-9"
                >
                  <CreditCard className="h-4 w-4" />
                  Potong Tabungan
                </Button>
              </div>
            </div>

            {paymentMethod === "tabungan" && (
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg space-y-1.5">
                <div className="text-xs text-muted-foreground flex justify-between items-center">
                  <span>Saldo Tabungan Siswa:</span>
                  {savingsBalance < ((hutang.nominal * hutang.jumlah) - hutang.terbayar) && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold uppercase">Saldo Kurang untuk Pelunasan</span>
                  )}
                </div>
                <div className="text-lg font-bold text-primary font-mono">
                  {formatRupiah(savingsBalance)}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="payAmount">Nominal Pembayaran (Rp)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const remaining = (hutang.nominal * hutang.jumlah) - hutang.terbayar;
                    if (paymentMethod === "tabungan") {
                      onPayAmountChange(Math.min(remaining, savingsBalance).toString());
                    } else {
                      onPayAmountChange(remaining.toString());
                    }
                  }}
                  className="text-[11px] h-6 px-2 text-slate-500 hover:text-slate-800"
                >
                  Set Maksimal / Lunas
                </Button>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">Rp</span>
                <Input
                  id="payAmount"
                  className="pl-9 font-mono text-sm"
                  value={payAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    onPayAmountChange(val ? parseInt(val).toLocaleString("id-ID") : "");
                  }}
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <DialogFooter className="border-t dark:border-slate-800 pt-3 flex gap-2">
              <Button type="button" variant="outline" onClick={() => onClose()}>
                Batal
              </Button>
              <Button type="submit" disabled={isPaying}>
                {isPaying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Proses Bayar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
