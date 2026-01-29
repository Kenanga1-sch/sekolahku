"use client";

import { useEffect, useState } from "react";
import { 
  Plus, 
  Search, 
  FileText, 
  Edit, 
  Trash2,
  MoreVertical,
  Printer,
  Download,
  Upload,
  RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { ImportDialog } from "@/components/letters/import-dialog";

export default function TemplateListPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      
      const res = await fetch(`/api/letters/templates?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTemplates(data.data);
    } catch (error) {
      toast.error("Gagal memuat template surat");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
        fetchTemplates();
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus template ini?")) return;
    try {
      const res = await fetch(`/api/letters/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Template dihapus");
      fetchTemplates();
    } catch (error) {
      toast.error("Gagal menghapus template");
    }
  };

  const handleExport = (tpl: any) => {
    const data = {
        meta: {
            app_version: "1.0",
            exported_at: new Date().toISOString(),
            platform: "SekolahKu"
        },
        config: {
            name: tpl.name,
            category: tpl.category,
            paperSize: tpl.paperSize,
            orientation: tpl.orientation
        },
        content: tpl.content
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${tpl.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Template berhasil diexport");
  };

  return (
    <div className="space-y-6">
      <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Template Surat</h1>
          <p className="text-muted-foreground">
            Kelola desain dan layout surat untuk generator otomatis.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchTemplates} disabled={loading} title="Refresh Data">
              <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" /> Import Backup
            </Button>
            <Button onClick={() => router.push("/admin/surat/template/editor")} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" /> Buat Template Baru
            </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama template..."
            className="pl-9 bg-white dark:bg-zinc-800"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-white dark:bg-zinc-900">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Template</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Terakhir Update</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
               [1,2,3].map(i => (
                 <TableRow key={i}>
                   <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                   <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                   <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                   <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                 </TableRow>
               ))
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                  Belum ada template surat.
                </TableCell>
              </TableRow>
            ) : (
                templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded text-blue-600">
                            <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground">{tpl.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {tpl.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tpl.updatedAt), "dd MMM yyyy HH:mm", { locale: id })}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/surat/buat?templateId=${tpl.id}`)}>
                             <Printer className="mr-2 h-4 w-4" /> Gunakan / Cetak
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/surat/template/editor?id=${tpl.id}`)}>
                             <Edit className="mr-2 h-4 w-4" /> Edit Layout
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(tpl)}>
                             <Download className="mr-2 h-4 w-4" /> Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(tpl.id)}>
                             <Trash2 className="mr-2 h-4 w-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
