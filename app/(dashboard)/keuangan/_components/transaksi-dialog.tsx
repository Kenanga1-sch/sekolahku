"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

import {
  formatRupiah,
  directionLabel,
  unitTypeLabel,
  type FinanceUnit,
  type FinanceCategory,
  type FinanceDirection,
} from "@/lib/keuangan";

/** Bentuk form transaksi (dipakai dialog & tab). */
export interface TxForm {
  id: string;
  unitId: string;
  categoryId: string;
  direction: FinanceDirection;
  amount: number;
  description: string;
  txDate: string;
  party: string;
  quantity: string;
  unitPrice: number;
  reference: string;
}

/** Dialog tambah/ubah transaksi keuangan. */
export function TransaksiDialog({
  open,
  form,
  units,
  formCategories,
  sampahMode,
  saving,
  onChange,
  onSave,
  onOpenChange,
}: {
  open: boolean;
  form: TxForm;
  units: FinanceUnit[];
  formCategories: FinanceCategory[];
  sampahMode: boolean;
  saving: boolean;
  onChange: (next: TxForm) => void;
  onSave: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Ubah Transaksi" : "Tambah Transaksi"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Unit Usaha</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={form.unitId}
              onChange={(e) => onChange({ ...form, unitId: e.target.value, categoryId: "" })}
            >
              <option value="">— Pilih Unit —</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({unitTypeLabel(u.type)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Jenis Transaksi</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as FinanceDirection[]).map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant={form.direction === d ? "default" : "outline"}
                  onClick={() => onChange({ ...form, direction: d, categoryId: "" })}
                >
                  {directionLabel(d)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategori (opsional)</Label>
            <select
              className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              value={form.categoryId}
              onChange={(e) => onChange({ ...form, categoryId: e.target.value })}
            >
              <option value="">— Tanpa Kategori —</option>
              {formCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {sampahMode && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Unit sampah: seluruh sampah plastik dicatat sebagai satu jenis.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Berat (Kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="0"
                    value={form.quantity}
                    onChange={(e) => {
                      const q = e.target.value;
                      const amt = Math.round((Number(q) || 0) * (form.unitPrice || 0));
                      onChange({ ...form, quantity: q, amount: amt });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Harga / Kg</Label>
                  <CurrencyInput
                    value={form.unitPrice || undefined}
                    onChange={(v) => {
                      const up = v || 0;
                      const amt = Math.round((Number(form.quantity) || 0) * up);
                      onChange({ ...form, unitPrice: up, amount: amt });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Jumlah (Rp)</Label>
            <CurrencyInput value={form.amount || undefined} onChange={(v) => onChange({ ...form, amount: v || 0 })} />
            {sampahMode && form.quantity && form.unitPrice ? (
              <p className="text-xs text-muted-foreground">Otomatis: {form.quantity} kg × {formatRupiah(form.unitPrice)}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Uraian</Label>
            <Textarea
              placeholder="Keterangan transaksi..."
              value={form.description}
              onChange={(e) => onChange({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <DateInput type="date" value={form.txDate} onChange={(e) => onChange({ ...form, txDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{sampahMode ? "Pengepul / Pembeli" : "Pihak"}</Label>
              <Input
                placeholder={sampahMode ? "Nama pengepul" : "Nama pihak"}
                value={form.party}
                onChange={(e) => onChange({ ...form, party: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>No. Nota / Referensi (opsional)</Label>
            <Input value={form.reference} onChange={(e) => onChange({ ...form, reference: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={onSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
