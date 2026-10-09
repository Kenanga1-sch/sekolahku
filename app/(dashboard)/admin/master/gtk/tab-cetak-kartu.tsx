"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Printer, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, TablePagination } from "@/components/data-table";
import { useSortableData } from "@/hooks/use-sortable-data";
import { useDebounce } from "@/hooks/use-debounce";
import { goGet } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import { formatNamaGtk } from "@/lib/gtk-name";

type Employee = {
  id: string;
  name: string;
  fullName?: string | null;
  email: string;
  nip: string | null;
  nuptk: string | null;
  employmentStatus: string | null;
  jobType: string | null;
  category: string | null;
  degree?: string | null;
  photoUrl: string | null;
};

const categoryLabel = (cat?: string | null) => {
  switch (cat) {
    case "kepsek": return "Kepala Sekolah";
    case "guru": return "Guru";
    case "staff": return "Staff TU";
    case "support": return "Tenaga Support";
    default: return "Belum diatur";
  }
};

export default function TabCetakKartuGtk() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const debouncedSearch = useDebounce(search, 500);
  const { sortedData, sortConfig, requestSort } = useSortableData(employees);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (debouncedSearch) params.set("q", debouncedSearch);
      // Catatan: response endpoint ini polos {data, pagination} — tanpa wrapper success.
      const res: any = await goGet(`/api/master/employees?${params.toString()}`);
      setEmployees(res?.data || []);
      setTotalPages(res?.pagination?.totalPages || 1);
      setTotalEmployees(res?.pagination?.total || 0);
    } catch {
      showError("Gagal memuat data GTK");
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const handleToggleAll = () => {
    setSelectedIds((prev) => (prev.length === employees.length ? [] : employees.map((e) => e.id)));
  };

  const handlePrint = () => {
    if (selectedIds.length === 0) {
      toast.error("Pilih GTK terlebih dahulu");
      return;
    }
    router.push(`/admin/master/gtk/cetak-kartu?ids=${selectedIds.join(",")}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Printer className="h-6 w-6 text-primary" /> Cetak Kartu GTK
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">
            Pilih guru/tenaga kependidikan, cetak kartu identitas (NIP/NUPTK + QR).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={fetchEmployees} className="w-full sm:w-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={selectedIds.length === 0} className="w-full sm:w-auto">
            <Printer className="h-4 w-4 mr-2" />
            Cetak Kartu ({selectedIds.length})
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="p-4 md:p-6 pb-4 border-b border-slate-100 dark:border-zinc-800">
          <CardTitle>Daftar GTK</CardTitle>
          <CardDescription>
            {totalEmployees} data · {selectedIds.length} terpilih
          </CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama, NIP, atau NUPTK..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10 border-slate-200 dark:border-zinc-800"
              />
            </div>
            <Select
              value={limit.toString()}
              onValueChange={(val) => {
                setLimit(parseInt(val));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Baris" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 Baris</SelectItem>
                <SelectItem value="20">20 Baris</SelectItem>
                <SelectItem value="50">50 Baris</SelectItem>
                <SelectItem value="100">100 Baris</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={loading ? [] : sortedData}
            getRowId={(emp) => emp.id}
            loading={loading}
            sortConfig={sortConfig}
            onSort={requestSort}
            selectable
            selectedIds={selectedIds}
            onToggleSelect={handleToggle}
            onToggleSelectAll={handleToggleAll}
            emptyTitle="Belum ada data GTK"
            emptyDescription="Data guru & tenaga kependidikan akan muncul di sini."
            columns={[
              {
                key: "name",
                header: "Nama",
                sortable: true,
                card: "title",
                render: (emp) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-9 w-9 border border-slate-100 dark:border-zinc-800 shadow-sm shrink-0">
                      <AvatarImage src={emp.photoUrl || undefined} />
                      <AvatarFallback className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold text-xs">
                        {(emp.name || "?")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-zinc-200">{formatNamaGtk(emp.name, emp.degree)}</p>
                      <p className="text-xs text-muted-foreground">{emp.email}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "nip",
                header: "NIP / NUPTK",
                sortable: true,
                card: "field",
                render: (emp) => (
                  <div className="flex flex-col text-xs space-y-0.5">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{emp.nip || "-"}</span>
                    <span className="text-muted-foreground">{emp.nuptk || "-"}</span>
                  </div>
                ),
              },
              {
                key: "jobType",
                header: "Jabatan",
                sortable: true,
                card: "field",
                render: (emp) => (
                  <Badge variant="outline" className="text-[11px] border-slate-200 dark:border-zinc-700">
                    {emp.jobType || "Belum diatur"}
                  </Badge>
                ),
              },
              {
                key: "category",
                header: "Kategori",
                card: "field",
                render: (emp) => (
                  <span className="text-xs text-muted-foreground">{categoryLabel(emp.category)}</span>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>

      {!loading && employees.length > 0 && (
        <TablePagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          label={`Total ${totalEmployees} GTK`}
        />
      )}
    </div>
  );
}
