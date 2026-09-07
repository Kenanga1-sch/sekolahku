"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Settings2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { goGet } from "@/lib/api-client";

const FUNDING_SOURCES = [
  "BOSP Reguler",
  "BOSP Kinerja",
  "APBD",
  "BOSDA",
  "Komite Sekolah",
  "Hibah",
  "Swadaya",
  "Lainnya",
];

interface AssetLabel {
  id: string;
  name: string;
  code: string;
  fundingSource: string;
  fiscalYear: number;
  quantity: number;
  type: "asset" | "item";
}

interface PrintConfig {
  paperWidth: number;
  paperHeight: number;
  labelWidth: number;
  labelHeight: number;
  columns: number;
  gapX: number;
  gapY: number;
  marginTop: number;
  marginLeft: number;
  fontSize: number;
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "…" : str;
}

export function LabelPrintClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<AssetLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [printConfig, setPrintConfig] = useState<PrintConfig>({
    paperWidth: 210,
    paperHeight: 297,
    labelWidth: 90,
    labelHeight: 20,
    columns: 2,
    gapX: 3,
    gapY: 3,
    marginTop: 10,
    marginLeft: 10,
    fontSize: 8,
  });
  const [overrideFunding, setOverrideFunding] = useState("");
  const [overrideYear, setOverrideYear] = useState(new Date().getFullYear().toString());
  const [showName, setShowName] = useState(true);
  const [editingTotals, setEditingTotals] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    const result: AssetLabel[] = [];
    const assetIds = searchParams.get("assets");
    const itemIds = searchParams.get("items");

    try {
      if (assetIds) {
        for (const id of assetIds.split(",").filter(Boolean)) {
          try {
            const res = await goGet(`/api/inventory/assets/${id}`);
            if (res && !res.error) {
              result.push({
                id: res.id,
                name: res.name,
                code: res.code || "",
                fundingSource: res.fundingSource || "",
                fiscalYear: res.fiscalYear || new Date().getFullYear(),
                quantity: res.quantity || 1,
                type: "asset",
              });
            }
          } catch {}
        }
      }
      if (itemIds) {
        for (const id of itemIds.split(",").filter(Boolean)) {
          try {
            const res = await goGet(`/api/inventory/items/${id}`);
            if (res && !res.error) {
              result.push({
                id: res.id,
                name: res.name,
                code: res.code || "",
                fundingSource: res.fundingSource || "",
                fiscalYear: res.fiscalYear || new Date().getFullYear(),
                quantity: res.currentStock || 1,
                type: "item",
              });
            }
          } catch {}
        }
      }
    } catch {}

    setItems(result);
    const totals: Record<string, number> = {};
    result.forEach((r) => (totals[r.id] = r.quantity));
    setEditingTotals(totals);
    setLoading(false);
  }, [searchParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getPrintStyles = (): string => {
    const { paperWidth, paperHeight, labelWidth, labelHeight, columns, gapX, gapY, marginTop, marginLeft, fontSize } = printConfig;
    return `
      @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; }
      @media print { @page { size: ${paperWidth}mm ${paperHeight}mm; margin: 0; } }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
      .label-grid {
        display: grid;
        grid-template-columns: repeat(${columns}, ${labelWidth}mm);
        grid-auto-rows: ${labelHeight}mm;
        column-gap: ${gapX}mm;
        row-gap: ${gapY}mm;
        padding-top: ${marginTop}mm;
        padding-left: ${marginLeft}mm;
        width: fit-content;
      }
      .label-cell {
        width: ${labelWidth}mm;
        height: ${labelHeight}mm;
        border: 0.3pt solid #999;
        display: flex;
        align-items: center;
        padding: 1.5mm;
        box-sizing: border-box;
        page-break-inside: avoid;
        overflow: hidden;
        font-family: Arial, sans-serif;
        font-size: ${fontSize}pt;
      }
      .label-text { flex: 1; min-width: 0; }
      .label-text-1 { font-weight: bold; font-size: ${Math.max(7, fontSize - 1)}pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .label-text-2 { font-size: ${Math.max(6, fontSize - 2)}pt; color: #444; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .label-seq { font-weight: bold; white-space: nowrap; margin-left: 2mm; }
      .label-qr { flex-shrink: 0; margin-left: 1.5mm; }
    `;
  };

  const makeQRUrl = (item: AssetLabel, unitNo: number): string => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/inventaris/detail?id=${item.id}&t=${item.type}&u=${unitNo}`;
  };

  const buildUnits = (item: AssetLabel): number[] => {
    const total = editingTotals[item.id] ?? item.quantity;
    return Array.from({ length: Math.max(1, total) }, (_, i) => i + 1);
  };

  const handlePrint = () => window.print();

  const allUnits = items.flatMap((item) =>
    buildUnits(item).map((u) => ({ item, unitNo: u, total: editingTotals[item.id] ?? item.quantity }))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Memuat data label...</p>
      </div>
    );
  }

  return (
    <>
      <div className="no-print space-y-6 p-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/inventaris">
            <Button variant="outline" size="icon" aria-label="Kembali">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Cetak Label Inventaris</h1>
            <p className="text-muted-foreground">{allUnits.length} label siap dicetak</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings2 className="h-4 w-4" /> Pengaturan Cetak
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Lebar Kertas (mm)</Label>
                <Input type="number" value={printConfig.paperWidth}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, paperWidth: +e.target.value || 210 }))} />
              </div>
              <div>
                <Label className="text-xs">Tinggi Kertas (mm)</Label>
                <Input type="number" value={printConfig.paperHeight}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, paperHeight: +e.target.value || 297 }))} />
              </div>
              <div>
                <Label className="text-xs">Lebar Label (mm)</Label>
                <Input type="number" value={printConfig.labelWidth}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, labelWidth: +e.target.value || 90 }))} />
              </div>
              <div>
                <Label className="text-xs">Tinggi Label (mm)</Label>
                <Input type="number" value={printConfig.labelHeight}
                  onChange={(e) => setPrintConfig((p) => ({ ...p, labelHeight: +e.target.value || 20 }))} />
              </div>
              <div>
                <Label className="text-xs">Kolom per Halaman</Label>
                <Input type="number" value={printConfig.columns} min="1" max="6"
                  onChange={(e) => setPrintConfig((p) => ({ ...p, columns: +e.target.value || 2 }))} />
              </div>
              <div>
                <Label className="text-xs">Font Size (pt)</Label>
                <Input type="number" value={printConfig.fontSize} min="5" max="14"
                  onChange={(e) => setPrintConfig((p) => ({ ...p, fontSize: +e.target.value || 8 }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sumber Dana Override</Label>
                <select className="w-full border rounded px-2 py-1 text-sm"
                  value={overrideFunding}
                  onChange={(e) => setOverrideFunding(e.target.value)}>
                  <option value="">Gunakan data aset</option>
                  {FUNDING_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Tahun Override</Label>
                <Input type="number" value={overrideYear}
                  onChange={(e) => setOverrideYear(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={showName}
                  onChange={(e) => setShowName(e.target.checked)} />
                Tampilkan nama barang
              </label>
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Tidak ada data untuk dicetak.</p>
              <p className="text-sm mt-1">Kembali ke daftar aset atau barang dan pilih item.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {items.map((item) => {
                const total = editingTotals[item.id] ?? item.quantity;
                return (
                  <Card key={item.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.code && `${item.code} · `}1/{total} label
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {item.fundingSource || "Tanpa Dana"} {item.fiscalYear}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">× </Label>
                          <Input type="number" className="w-16 h-7 text-xs" min="1"
                            value={total}
                            onChange={(e) => setEditingTotals((prev) => ({
                              ...prev,
                              [item.id]: Math.max(1, parseInt(e.target.value) || 1),
                            }))} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button size="lg" className="w-full gap-2" onClick={handlePrint}>
              <Printer className="h-5 w-5" /> Cetak Label ({allUnits.length})
            </Button>
          </>
        )}
      </div>

      <div className="hidden print:block">
        <style dangerouslySetInnerHTML={{ __html: getPrintStyles() }} />
        <div className="label-grid">
          {allUnits.map(({ item, unitNo, total }, idx) => {
            const funding = overrideFunding || item.fundingSource || "Inventaris";
            const year = overrideYear || String(item.fiscalYear);
            return (
              <div key={`${item.id}-${unitNo}`} className="label-cell">
                <div className="label-text">
                  <div className="label-text-1">
                    Inventaris {funding} {year}
                  </div>
                  {showName && (
                    <div className="label-text-2">
                      {truncate(item.name, 28)}{item.code ? ` · ${item.code}` : ""}
                    </div>
                  )}
                </div>
                <div className="label-seq">
                  {unitNo}/{total}
                </div>
                <div className="label-qr">
                  <QRCodeSVG
                    value={typeof window !== "undefined" ? makeQRUrl(item, unitNo) : ""}
                    size={parseInt(String(printConfig.labelHeight * 1.8))}
                    level="M"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
