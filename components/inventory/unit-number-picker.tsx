"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { goGet } from "@/lib/api-client";

interface UnitInfo {
  id: string;
  itemId: string;
  batchId?: string;
  unitNo: number;
  year: number;
  status: string;
  issuedTo?: string;
}

interface UnitNumberPickerProps {
  itemId: string;
  // Tahun penomoran, mengikuti tanggal transaksi di form induk.
  year: number;
  quantity: number;
  selected: number[];
  onChange: (numbers: number[]) => void;
}

/**
 * Pemilih nomor bungkus untuk barang habis pakai.
 *
 * Meniru pola pemilih tanggal: tombol membuka panel berisi daftar nomor
 * tersedia, klik untuk memilih. Hanya nomor yang masih tersedia yang
 * ditawarkan, sehingga mustahil mengeluarkan bungkus yang sudah keluar.
 *
 * Karena operator harus bisa memilih cepat, tersedia tombol "Ambil N terkecil"
 * untuk kasus bungkus yang memang diambil berurutan.
 */
export function UnitNumberPicker({
  itemId,
  year,
  quantity,
  selected,
  onChange,
}: UnitNumberPickerProps) {
  const [units, setUnits] = useState<UnitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!itemId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    goGet(`/api/inventory/items/${itemId}/units?year=${year}`)
      .then((res: any) => {
        if (cancelled) return;
        setUnits(res?.units || res?.data || []);
      })
      .catch(() => {
        if (!cancelled) setUnits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, year]);

  const toggle = (no: number) => {
    if (selected.includes(no)) {
      onChange(selected.filter((n) => n !== no));
    } else {
      onChange([...selected, no].sort((a, b) => a - b));
    }
  };

  const takeLowest = () => {
    const available = units
      .map((u) => u.unitNo)
      .filter((n) => !selected.includes(n))
      .sort((a, b) => a - b)
      .slice(0, Math.max(0, quantity));
    onChange([...selected, ...available].sort((a, b) => a - b));
  };

  const clear = () => onChange([]);

  const visible = filter
    ? units.filter((u) => String(u.unitNo).includes(filter))
    : units;

  const label =
    selected.length === 0
      ? "Pilih nomor bungkus"
      : `${selected.length} nomor: ${selected.slice(0, 6).join(", ")}${
          selected.length > 6 ? "…" : ""
        }`;

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2">
        <Label htmlFor="nomor-bungkus">Nomor Bungkus</Label>
        {selected.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={clear}
          >
            Kosongkan
          </Button>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="nomor-bungkus"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            disabled={!itemId}
          >
            <span className="truncate">{itemId ? label : "Pilih barang dulu"}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start">
          <div className="flex items-center gap-2 pb-2">
            <Input
              placeholder="Cari nomor…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 gap-1 text-xs"
              onClick={takeLowest}
              disabled={quantity <= 0}
              title={`Ambil ${quantity} nomor terkecil yang masih tersedia`}
            >
              <Sparkles className="h-3 w-3" /> Ambil {quantity} terkecil
            </Button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">Memuat nomor…</p>
            ) : visible.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Tidak ada nomor tersedia. Barang ini belum punya bungkus
                tercatat, atau semua sudah keluar.
              </p>
            ) : (
              <div className="grid grid-cols-5 gap-1">
                {visible.map((u) => {
                  const active = selected.includes(u.unitNo);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggle(u.unitNo)}
                      className={`flex h-9 items-center justify-center rounded border text-sm transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {u.unitNo}
                      {active && <Check className="ml-1 h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <p className="pt-2 text-[11px] leading-snug text-muted-foreground">
            Nomor yang sudah keluar tidak ditampilkan. Kosongkan bila barang ini
            tidak dilacak per bungkus — nomor akan diisi otomatis.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
