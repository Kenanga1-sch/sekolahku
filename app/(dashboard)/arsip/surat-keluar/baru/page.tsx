"use client";

import { useEffect, useState } from "react";
import { 
  Search, 
  FileText, 
  Layers,
  RotateCcw,
  Printer,
  ArrowLeft,
  Blocks
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { goGet } from "@/lib/api-client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/lib/hooks/use-tab-param";

type BuatSuratTab = "modular" | "tunggal" | "grup" | "umum";

const BUAT_SURAT_TABS: BuatSuratTab[] = ["modular", "tunggal", "grup", "umum"];

export default function SuratKeluarBaruPage() {
  const router = useRouter();

  // Tab aktif tersimpan di URL (?tab=...) agar tetap terbuka setelah refresh.
  const [activeTab, setActiveTab] = useTabParam<BuatSuratTab>("tunggal", {
    validTabs: BUAT_SURAT_TABS,
  });
  
  // States
  const [templates, setTemplates] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [searchTemplate, setSearchTemplate] = useState("");
  const [searchGroup, setSearchGroup] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch templates
      const templatesRes: any = await goGet("/api/eoffice/letter-templates?limit=100");
      setTemplates(Array.isArray(templatesRes.data) ? templatesRes.data : []);

      // Fetch template groups
      const groupsRes: any = await goGet("/api/eoffice/template-groups");
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
    } catch (error) {
      toast.error("Gagal memuat data template");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter templates
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchTemplate.toLowerCase())
  );

  // Filter groups
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchGroup.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Link href="/arsip">
            <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                Kembali ke E-Arsip
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Buat Surat Keluar</h1>
            <p className="text-muted-foreground">
              Pilih template tunggal atau paket surat (grup) untuk membuat surat keluar otomatis.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} title="Refresh Data">
            <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as BuatSuratTab)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="modular" className="flex gap-2 items-center">
            <Blocks className="h-4 w-4" />
            Modular
            <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              Disarankan
            </span>
          </TabsTrigger>
          <TabsTrigger value="tunggal" className="flex gap-2 items-center">
            <FileText className="h-4 w-4" />
            Template Tunggal
          </TabsTrigger>
          <TabsTrigger value="grup" className="flex gap-2 items-center">
            <Layers className="h-4 w-4" />
            Grup / Paket Surat
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Lama
            </span>
          </TabsTrigger>
          <TabsTrigger value="umum" className="flex gap-2 items-center">
            <FileText className="h-4 w-4" />
            Surat Umum
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              Lama
            </span>
          </TabsTrigger>
        </TabsList>

        {/* --- TABS CONTENT: MODULAR (BARU) --- */}
        <TabsContent value="modular" className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800 p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center">
              <Blocks className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Editor Surat Modular</h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mt-2">
                Pilih jenis surat, sistem menerapkan standar baku tata naskah dinas
                (font, margin, spasi) otomatis. Lalu rakit surat dari blok siap pakai:
                kop, nomor/perihal, tujuan, isi, acara, penutup, tanda tangan, dan modul SK.
                Pratinjau PDF langsung.
              </p>
            </div>
            <Button onClick={() => router.push('/arsip/surat-keluar/buat-modular')} className="mt-4 bg-blue-600 hover:bg-blue-700">
              Mulai Buat Surat Modular
            </Button>
          </div>
        </TabsContent>

        {/* --- TABS CONTENT: SURAT UMUM --- */}
        <TabsContent value="umum" className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Surat Umum / Kondisional</h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto mt-2">
                Buat surat bebas tanpa format template. Nomor surat dan KOP surat akan dibuatkan secara otomatis oleh sistem, Anda hanya perlu mengetikkan isi suratnya.
              </p>
            </div>
            <Button onClick={() => router.push('/arsip/surat-keluar/buat-umum')} className="mt-4">
              Mulai Mengetik Surat Umum
            </Button>
          </div>
        </TabsContent>

        {/* --- TABS CONTENT: TEMPLATE TUNGGAL --- */}
        <TabsContent value="tunggal" className="space-y-4">
          <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama template..."
                className="pl-9 bg-white dark:bg-zinc-800"
                value={searchTemplate}
                onChange={(e) => setSearchTemplate(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            data={loading ? [] : filteredTemplates}
            getRowId={(tpl) => tpl.id}
            loading={loading}
            emptyTitle="Tidak ada template surat yang ditemukan."
            emptyDescription="Cari dengan kata kunci lain atau tambahkan template baru."
            actions={(tpl) => (
              <Button
                onClick={() => router.push(`/admin/surat/buat?templateId=${tpl.id}`)}
                className="bg-blue-600 hover:bg-blue-700 text-white size-sm"
                size="sm"
              >
                <Printer className="mr-2 h-4 w-4" /> Gunakan
              </Button>
            )}
            columns={[
              {
                key: "name",
                header: "Nama Template",
                card: "title",
                render: (tpl) => (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <span className="font-medium text-foreground">{tpl.name}</span>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Kategori",
                card: "field",
                render: (tpl) => (
                  <Badge variant="secondary" className="text-xs">
                    {tpl.category}
                  </Badge>
                ),
              },
              {
                key: "updatedAt",
                header: "Terakhir Update",
                card: "field",
                render: (tpl) => (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(tpl.updatedAt), "dd MMM yyyy HH:mm", { locale: id })}
                  </span>
                ),
              },
            ]}
          />
        </TabsContent>

        {/* --- TABS CONTENT: GRUP / PAKET SURAT --- */}
        <TabsContent value="grup" className="space-y-4">
          <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama grup / paket..."
                className="pl-9 bg-white dark:bg-zinc-800"
                value={searchGroup}
                onChange={(e) => setSearchGroup(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            data={loading ? [] : filteredGroups}
            getRowId={(g) => g.id}
            loading={loading}
            emptyTitle="Tidak ada grup / paket surat yang ditemukan."
            emptyDescription="Cari dengan kata kunci lain atau buat grup surat baru."
            actions={(g) => (
              <Button
                onClick={() => router.push(`/admin/surat/buat?groupId=${g.id}`)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                size="sm"
              >
                <Printer className="mr-2 h-4 w-4" /> Gunakan Paket
              </Button>
            )}
            columns={[
              {
                key: "name",
                header: "Nama Grup / Paket Surat",
                card: "title",
                render: (g) => (
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded text-purple-600">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground block">{g.name}</span>
                      {g.description && (
                        <span className="text-xs text-muted-foreground block">{g.description}</span>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: "items",
                header: "Jumlah Template",
                card: "field",
                render: (g) => (
                  <Badge variant="secondary" className="text-xs">
                    {g.items?.length || 0} Template
                  </Badge>
                ),
              },
              {
                key: "updatedAt",
                header: "Terakhir Update",
                card: "field",
                render: (g) => (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(g.updatedAt), "dd MMM yyyy HH:mm", { locale: id })}
                  </span>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
