"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wallet,
  Receipt,
  Tags,
  BarChart3,
  Building2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import {
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getSummary,
  recapByCategory,
  recapMonthly,
  formatRupiah,
  formatRupiahShort,
  directionLabel,
  unitTypeLabel,
  formatPeriod,
  isSampahUnit,
  type FinanceUnit,
  type FinanceCategory,
  type FinanceTransaction,
  type FinanceSummary,
  type FinanceCategoryRecap,
  type FinanceMonthlyRecap,
  type FinanceDirection,
  type TransactionInput,
} from "@/lib/keuangan";
import {
  exportTransactionsExcel,
  exportTransactionsPDF,
  exportMonthlyExcel,
} from "@/lib/keuangan/export";
import { TransaksiDialog, type TxForm } from "./_components/transaksi-dialog";
import { useTabParam } from "@/lib/hooks/use-tab-param";

type KeuanganTab = "ringkasan" | "transaksi" | "unit" | "kategori" | "laporan";

const KEUANGAN_TABS: KeuanganTab[] = ["ringkasan", "transaksi", "unit", "kategori", "laporan"];

function fmtDate(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateInput(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export default function KeuanganPage() {
  // Tab aktif tersimpan di URL (?tab=...) agar tetap terbuka setelah refresh.
  const [activeTab, setActiveTab] = useTabParam<KeuanganTab>("ringkasan", {
    validTabs: KEUANGAN_TABS,
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/overview">
          <Button variant="ghost" size="icon" aria-label="Kembali ke dasbor">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Keuangan</h1>
          <p className="text-muted-foreground text-sm">
            Catat & kelola keuangan unit usaha sekolah: sampah, koperasi, dan lainnya.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as KeuanganTab)} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto gap-1">
          <TabsTrigger value="ringkasan" className="gap-1.5">
            <Wallet className="h-4 w-4" /> Ringkasan
          </TabsTrigger>
          <TabsTrigger value="transaksi" className="gap-1.5">
            <Receipt className="h-4 w-4" /> Transaksi
          </TabsTrigger>
          <TabsTrigger value="unit" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Unit Usaha
          </TabsTrigger>
          <TabsTrigger value="kategori" className="gap-1.5">
            <Tags className="h-4 w-4" /> Kategori
          </TabsTrigger>
          <TabsTrigger value="laporan" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Laporan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan">
          <RingkasanTab />
        </TabsContent>
        <TabsContent value="transaksi">
          <TransaksiTab />
        </TabsContent>
        <TabsContent value="unit">
          <UnitTab />
        </TabsContent>
        <TabsContent value="kategori">
          <KategoriTab />
        </TabsContent>
        <TabsContent value="laporan">
          <LaporanTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================= Ringkasan =================

function RingkasanTab() {
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [summaries, setSummaries] = useState<FinanceSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([listUnits(true), getSummary()]);
      setUnits(u);
      setSummaries(s);
    } catch {
      showError("Gagal memuat ringkasan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    let tin = 0,
      tout = 0;
    for (const s of summaries) {
      tin += s.totalIn;
      tout += s.totalOut;
    }
    return { tin, tout, saldo: tin - tout };
  }, [summaries]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  const unitById = new Map(units.map((u) => [u.id, u]));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4 text-green-600" /> Total Pemasukan
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600">{formatRupiah(totals.tin)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingDown className="h-4 w-4 text-red-600" /> Total Pengeluaran
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">{formatRupiah(totals.tout)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="h-4 w-4" /> Saldo Keseluruhan
            </div>
            <p className="text-2xl font-bold mt-1">{formatRupiah(totals.saldo)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Saldo per Unit Usaha</h2>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-4 w-4" /> Muat ulang
        </Button>
      </div>

      {summaries.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Belum ada unit usaha.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((s) => {
            const u = unitById.get(s.unitId);
            return (
              <Card key={s.unitId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{s.unitName}</span>
                    {u && <Badge variant="secondary">{unitTypeLabel(u.type)}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pemasukan</span>
                    <span className="text-green-600">{formatRupiah(s.totalIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pengeluaran</span>
                    <span className="text-red-600">{formatRupiah(s.totalOut)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Saldo</span>
                    <span>{formatRupiah(s.balance)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">{s.txCount} transaksi</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================= Transaksi =================

const emptyTxForm: TxForm = {
  id: "",
  unitId: "",
  categoryId: "",
  direction: "in" as FinanceDirection,
  amount: 0,
  description: "",
  txDate: toDateInput(new Date().toISOString()),
  party: "",
  quantity: "" as string,
  unitPrice: 0,
  reference: "",
};

function TransaksiTab() {
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [txns, setTxns] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterUnit, setFilterUnit] = useState("");
  const [filterDir, setFilterDir] = useState<"" | FinanceDirection>("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<TxForm>({ ...emptyTxForm });

  const loadUnits = useCallback(async () => {
    try {
      const [u, c] = await Promise.all([listUnits(true), listCategories(undefined, true)]);
      setUnits(u);
      setCategories(c);
    } catch {
      showError("Gagal memuat data referensi");
    }
  }, []);

  const loadTxns = useCallback(async () => {
    setLoading(true);
    try {
      const items = await listTransactions({
        unitId: filterUnit || undefined,
        direction: filterDir || undefined,
        dateFrom: filterFrom || undefined,
        dateTo: filterTo || undefined,
        search: search || undefined,
        limit: 500,
      });
      setTxns(items);
    } catch {
      showError("Gagal memuat transaksi");
    } finally {
      setLoading(false);
    }
  }, [filterUnit, filterDir, filterFrom, filterTo, search]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadTxns();
  }, [loadTxns]);

  const activeUnit = units.find((u) => u.id === form.unitId);
  const sampahMode = activeUnit ? isSampahUnit(activeUnit.type) : false;

  const formCategories = useMemo(
    () => categories.filter((c) => c.unitId === form.unitId && c.direction === form.direction),
    [categories, form.unitId, form.direction],
  );

  function openNew() {
    setForm({ ...emptyTxForm, unitId: units[0]?.id || "", txDate: toDateInput(new Date().toISOString()) });
    setDialogOpen(true);
  }

  function openEdit(t: FinanceTransaction) {
    setForm({
      id: t.id,
      unitId: t.unitId,
      categoryId: t.categoryId || "",
      direction: t.direction,
      amount: t.amount,
      description: t.description,
      txDate: toDateInput(t.txDate),
      party: t.party,
      quantity: t.quantity != null ? String(t.quantity) : "",
      unitPrice: t.unitPrice ?? 0,
      reference: t.reference,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.unitId) {
      showError("Pilih unit usaha terlebih dahulu");
      return;
    }
    let amount = form.amount;
    if (sampahMode && form.quantity && form.unitPrice) {
      amount = Math.round(Number(form.quantity) * form.unitPrice);
    }
    if (!amount || amount <= 0) {
      showError("Jumlah harus lebih dari 0");
      return;
    }
    const payload: TransactionInput = {
      unitId: form.unitId,
      categoryId: form.categoryId || undefined,
      direction: form.direction,
      amount,
      description: form.description,
      txDate: form.txDate,
      party: form.party,
      quantity: sampahMode && form.quantity ? Number(form.quantity) : null,
      unitPrice: sampahMode && form.unitPrice ? form.unitPrice : null,
      reference: form.reference,
    };
    setSaving(true);
    try {
      if (form.id) {
        await updateTransaction(form.id, payload);
        showSuccess("Transaksi diperbarui");
      } else {
        await createTransaction(payload);
        showSuccess("Transaksi ditambahkan");
      }
      setDialogOpen(false);
      await Promise.all([loadTxns(), loadUnits()]);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t: FinanceTransaction) {
    if (!confirm("Hapus transaksi ini? Tindakan tidak bisa dibatalkan.")) return;
    try {
      await deleteTransaction(t.id);
      showSuccess("Transaksi dihapus");
      await Promise.all([loadTxns(), loadUnits()]);
    } catch {
      showError("Gagal menghapus transaksi");
    }
  }

  const filterUnitName = units.find((u) => u.id === filterUnit)?.name || "Semua Unit";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          <select
            aria-label="Filter unit"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
          >
            <option value="">Semua Unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter jenis"
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={filterDir}
            onChange={(e) => setFilterDir(e.target.value as "" | FinanceDirection)}
          >
            <option value="">Semua Jenis</option>
            <option value="in">Pemasukan</option>
            <option value="out">Pengeluaran</option>
          </select>
          <DateInput type="date" aria-label="Dari tanggal" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-10 sm:w-40" />
          <DateInput type="date" aria-label="Sampai tanggal" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-10 sm:w-40" />
          <div className="relative flex-1 min-w-[140px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Cari transaksi"
              placeholder="Cari uraian/pihak..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
        </div>
        <Button onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Tambah
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : txns.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Belum ada transaksi.</p>
      ) : (
        <div className="space-y-2">
          {txns.map((t) => (
            <div key={t.id} className="border rounded-lg p-3 flex items-start gap-3">
              <div
                className={`mt-1 h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                  t.direction === "in" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {t.direction === "in" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{t.description || "(tanpa uraian)"}</span>
                  {t.categoryName && <Badge variant="secondary">{t.categoryName}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtDate(t.txDate)} · {t.unitName}
                  {t.party ? ` · ${t.party}` : ""}
                  {t.quantity != null ? ` · ${t.quantity} kg` : ""}
                  {t.unitPrice != null ? ` @ ${formatRupiah(t.unitPrice)}` : ""}
                </p>
                {t.createdByName && <p className="text-[11px] text-muted-foreground">Diinput: {t.createdByName}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold ${t.direction === "in" ? "text-green-600" : "text-red-600"}`}>
                  {t.direction === "in" ? "+" : "−"}
                  {formatRupiah(t.amount)}
                </p>
                <div className="flex gap-1 justify-end mt-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ubah" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Hapus" onClick={() => handleDelete(t)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <TransaksiDialog
        open={dialogOpen}
        form={form}
        units={units}
        formCategories={formCategories}
        sampahMode={sampahMode}
        saving={saving}
        onChange={setForm}
        onSave={handleSave}
        onOpenChange={setDialogOpen}
      />

      {txns.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportTransactionsExcel(txns, { unitName: filterUnitName })}
          >
            <Download className="h-4 w-4" /> Ekspor Excel ({txns.length})
          </Button>
        </div>
      )}
    </div>
  );
}

// ================= Unit Usaha =================

const emptyUnitForm = {
  id: "",
  code: "",
  name: "",
  type: "generic",
  description: "",
  icon: "wallet",
  color: "",
  sortOrder: 0,
  isActive: true,
};

function UnitTab() {
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyUnitForm });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUnits(await listUnits(true));
    } catch {
      showError("Gagal memuat unit usaha");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setForm({ ...emptyUnitForm });
    setDialogOpen(true);
  }

  function openEdit(u: FinanceUnit) {
    setForm({
      id: u.id,
      code: u.code,
      name: u.name,
      type: u.type,
      description: u.description,
      icon: u.icon,
      color: u.color,
      sortOrder: u.sortOrder,
      isActive: u.isActive,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      showError("Nama unit wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        type: form.type,
        description: form.description,
        icon: form.icon,
        color: form.color,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      if (form.id) {
        await updateUnit(form.id, payload);
        showSuccess("Unit diperbarui");
      } else {
        await createUnit(payload);
        showSuccess("Unit ditambahkan");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Gagal menyimpan unit");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: FinanceUnit) {
    if (!confirm(`Hapus unit "${u.name}" beserta seluruh transaksinya? Tindakan tidak bisa dibatalkan.`)) return;
    try {
      await deleteUnit(u.id);
      showSuccess("Unit dihapus");
      await load();
    } catch {
      showError("Gagal menghapus unit");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Tambah Unit
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : units.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Belum ada unit usaha.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {units.map((u) => (
            <Card key={u.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{u.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ubah" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Hapus" onClick={() => handleDelete(u)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{unitTypeLabel(u.type)}</Badge>
                  {!u.isActive && <Badge variant="outline">Nonaktif</Badge>}
                </div>
                {u.description && <p className="text-muted-foreground text-xs">{u.description}</p>}
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Saldo</p>
                  <p className="font-bold text-lg">{formatRupiah(u.balance ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">
                    +{formatRupiahShort(u.totalIn ?? 0)} / −{formatRupiahShort(u.totalOut ?? 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Ubah Unit Usaha" : "Tambah Unit Usaha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Unit *</Label>
              <Input
                placeholder="mis. Sampah Plastik, Koperasi Siswa"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Unit</Label>
              <select
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="generic">Umum</option>
                <option value="sampah">Pengelolaan Sampah</option>
                <option value="koperasi">Koperasi</option>
                <option value="kantin">Kantin</option>
                <option value="lainnya">Lainnya</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Jenis &quot;Pengelolaan Sampah&quot; mengaktifkan form timbangan (kg &amp; harga/kg).
              </p>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi (opsional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Kode (opsional)</Label>
                <Input
                  placeholder="otomatis dari nama"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Urutan</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value || "0", 10) })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              Unit aktif
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================= Kategori =================

function KategoriTab() {
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", direction: "in" as FinanceDirection, sortOrder: 0 });

  const loadUnits = useCallback(async () => {
    try {
      const u = await listUnits(true);
      setUnits(u);
      if (u.length && !selectedUnit) setSelectedUnit(u[0].id);
    } catch {
      showError("Gagal memuat unit");
    }
  }, [selectedUnit]);

  const loadCategories = useCallback(async () => {
    if (!selectedUnit) return;
    setLoading(true);
    try {
      setCategories(await listCategories(selectedUnit, true));
    } catch {
      showError("Gagal memuat kategori");
    } finally {
      setLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  function openNew() {
    setForm({ id: "", name: "", direction: "in", sortOrder: 0 });
    setDialogOpen(true);
  }

  function openEdit(c: FinanceCategory) {
    setForm({ id: c.id, name: c.name, direction: c.direction, sortOrder: c.sortOrder });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !selectedUnit) {
      showError("Nama kategori wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = { unitId: selectedUnit, name: form.name, direction: form.direction, sortOrder: form.sortOrder };
      if (form.id) {
        await updateCategory(form.id, payload);
        showSuccess("Kategori diperbarui");
      } else {
        await createCategory(payload);
        showSuccess("Kategori ditambahkan");
      }
      setDialogOpen(false);
      await loadCategories();
    } catch {
      showError("Gagal menyimpan kategori");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: FinanceCategory) {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await deleteCategory(c.id);
      showSuccess("Kategori dihapus");
      await loadCategories();
    } catch {
      showError("Gagal menghapus kategori");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <select
          aria-label="Pilih unit"
          className="h-10 rounded-md border bg-background px-3 text-sm flex-1"
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
        >
          {units.length === 0 && <option value="">— Belum ada unit —</option>}
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <Button onClick={openNew} disabled={!selectedUnit} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" /> Tambah Kategori
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : categories.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">Belum ada kategori untuk unit ini.</p>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 flex items-center gap-3">
              <Badge variant={c.direction === "in" ? "default" : "destructive"}>
                {directionLabel(c.direction)}
              </Badge>
              <span className="flex-1 font-medium">{c.name}</span>
              {!c.isActive && <Badge variant="outline">Nonaktif</Badge>}
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ubah" onClick={() => openEdit(c)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Hapus" onClick={() => handleDelete(c)}>
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Ubah Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nama Kategori *</Label>
              <Input
                placeholder="mis. Penjualan Sampah Plastik"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["in", "out"] as FinanceDirection[]).map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={form.direction === d ? "default" : "outline"}
                    onClick={() => setForm({ ...form, direction: d })}
                  >
                    {directionLabel(d)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================= Laporan =================

function LaporanTab() {
  const [units, setUnits] = useState<FinanceUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [byCategory, setByCategory] = useState<FinanceCategoryRecap[]>([]);
  const [monthly, setMonthly] = useState<FinanceMonthlyRecap[]>([]);
  const [txns, setTxns] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUnits = useCallback(async () => {
    try {
      const u = await listUnits(true);
      setUnits(u);
      if (u.length && !selectedUnit) setSelectedUnit(u[0].id);
    } catch {
      showError("Gagal memuat unit");
    }
  }, [selectedUnit]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const [s, cat, mon, txs] = await Promise.all([
        getSummary(selectedUnit || undefined),
        selectedUnit ? recapByCategory(selectedUnit) : Promise.resolve([]),
        recapMonthly(selectedUnit || undefined, 24),
        listTransactions({ unitId: selectedUnit || undefined, limit: 1000 }),
      ]);
      setSummary(s[0] || null);
      setByCategory(cat);
      setMonthly(mon);
      setTxns(txs);
    } catch {
      showError("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const unitName = units.find((u) => u.id === selectedUnit)?.name || "Semua Unit";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <select
          aria-label="Pilih unit"
          className="h-10 rounded-md border bg-background px-3 text-sm flex-1"
          value={selectedUnit}
          onChange={(e) => setSelectedUnit(e.target.value)}
        >
          <option value="">Semua Unit</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportTransactionsExcel(txns, { unitName })}
            disabled={txns.length === 0}
          >
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => exportTransactionsPDF(txns, summary, { unitName })}
            disabled={txns.length === 0}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          {summary && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Pemasukan</p>
                  <p className="text-xl font-bold text-green-600">{formatRupiah(summary.totalIn)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Pengeluaran</p>
                  <p className="text-xl font-bold text-red-600">{formatRupiah(summary.totalOut)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Saldo</p>
                  <p className="text-xl font-bold">{formatRupiah(summary.balance)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Rekap per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              {byCategory.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Belum ada data.</p>
              ) : (
                <div className="space-y-2">
                  {byCategory.map((c, i) => (
                    <div key={`${c.categoryId}-${c.direction}-${i}`} className="flex items-center gap-3">
                      <Badge variant={c.direction === "in" ? "default" : "destructive"}>
                        {directionLabel(c.direction)}
                      </Badge>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.txCount}x</span>
                      <span className="font-semibold">{formatRupiah(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Rekap Bulanan</CardTitle>
              {monthly.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => exportMonthlyExcel(monthly, { unitName })}
                >
                  <Download className="h-4 w-4" /> Excel
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Belum ada data.</p>
              ) : (
                <div className="space-y-1">
                  {monthly.map((m) => (
                    <div key={m.period} className="flex items-center gap-3 text-sm py-1 border-b last:border-0">
                      <span className="flex-1">{formatPeriod(m.period)}</span>
                      <span className="text-green-600">+{formatRupiahShort(m.totalIn)}</span>
                      <span className="text-red-600">−{formatRupiahShort(m.totalOut)}</span>
                      <span className={`font-semibold w-28 text-right ${m.net >= 0 ? "" : "text-red-600"}`}>
                        {formatRupiah(m.net)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
