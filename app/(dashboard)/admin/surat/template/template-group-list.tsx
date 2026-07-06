"use client";

import { useEffect, useState } from "react";
import { Plus, Search, MoreVertical, Edit, Trash2, Layers } from "lucide-react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { goDelete, goGet } from "@/lib/api-client";
import { TemplateGroupDialog } from "./template-group-dialog";

export function TemplateGroupList() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data: any = await goGet(`/api/eoffice/template-groups`);
      setGroups(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      toast.error("Gagal memuat grup template");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDelete = async (groupId: string) => {
    if (!confirm("Yakin ingin menghapus grup template ini?")) return;
    try {
      await goDelete(`/api/eoffice/template-groups/${groupId}`);
      toast.success("Grup template dihapus");
      fetchGroups();
    } catch (error) {
      toast.error("Gagal menghapus grup template");
    }
  };

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <TemplateGroupDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={fetchGroups}
        initialData={editingGroup}
      />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Grup Template</h2>
          <p className="text-sm text-muted-foreground">
            Kelompokkan template untuk membuat beberapa surat (paket) sekaligus.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingGroup(null);
            setIsDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" /> Buat Grup Baru
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama grup..."
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
              <TableHead>Nama Grup</TableHead>
              <TableHead>Jumlah Template</TableHead>
              <TableHead>Terakhir Update</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [1, 2].map((i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-8 ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-32 text-center text-muted-foreground"
                >
                  Belum ada grup template.
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded text-purple-600">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="font-medium text-foreground block">
                          {g.name}
                        </span>
                        {g.description && (
                          <span className="text-xs text-muted-foreground">
                            {g.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {g.items?.length || 0} Template
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(g.updatedAt), "dd MMM yyyy HH:mm", {
                      locale: id,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-muted-foreground hover:text-foreground">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingGroup(g);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" /> Edit Grup
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDelete(g.id)}
                        >
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
