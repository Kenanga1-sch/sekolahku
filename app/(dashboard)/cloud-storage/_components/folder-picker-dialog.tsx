"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Folder, Home, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile } from "@/lib/cloudstorage/api";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  /** Item yang dipindahkan/diSalin (untuk mencegah pindah ke dirinya sendiri). */
  excludeIds?: string[];
  onClose: () => void;
  /** folderId null = Beranda; name = label folder terpilih. */
  onPick: (folderId: string | null, name: string) => void;
}

/**
 * FolderPickerDialog — memilih folder tujuan (dipakai untuk "Pindah ke…" dan
 * "Salin ke…", khususnya sebagai pengganti drag & drop di perangkat sentuh).
 */
export function FolderPickerDialog({ title = "Pindah ke Folder", excludeIds = [], onClose, onPick }: Props) {
  const [cwd, setCwd] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Beranda" }]);
  const [folders, setFolders] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (parentId: string | null) => {
    setLoading(true);
    setError(false);
    try {
      const items = await cloud.listFiles2({ parentId, type: "folder" });
      // Jangan tawarkan folder yang sedang dipindah (menghindari siklus).
      setFolders(items.filter((f) => !excludeIds.includes(f.id)));
    } catch {
      // Bedakan gagal-memuat dari kosong agar pengguna tidak salah paham.
      setFolders([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [excludeIds]);

  useEffect(() => {
    load(cwd);
  }, [cwd, load]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
              <button
                onClick={() => {
                  setCrumbs(crumbs.slice(0, i + 1));
                  setCwd(c.id);
                }}
                className={cn(
                  "rounded px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  i === crumbs.length - 1 ? "font-medium" : "text-neutral-500",
                )}
              >
                {i === 0 ? <Home className="inline h-3.5 w-3.5" /> : c.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="max-h-64 min-h-[120px] overflow-y-auto rounded-lg border dark:border-neutral-800">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex h-32 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
              <p className="text-rose-600">Gagal memuat folder. Periksa koneksi Anda.</p>
              <Button size="sm" variant="outline" onClick={() => load(cwd)}>
                Coba lagi
              </Button>
            </div>
          ) : folders.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-400">Tidak ada subfolder di sini.</p>
          ) : (
            <ul className="divide-y dark:divide-neutral-800">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    className="flex w-full items-center gap-2 p-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    onClick={() => {
                      setCrumbs((c) => [...c, { id: f.id, name: f.name }]);
                      setCwd(f.id);
                    }}
                  >
                    <Folder className="h-4 w-4 text-emerald-600" />
                    <span className="truncate">{f.name}</span>
                    <ChevronRight className="ml-auto h-4 w-4 text-neutral-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => onPick(cwd, crumbs[crumbs.length - 1]?.name ?? "Beranda")}>
            {cwd === null ? "Pindahkan ke Beranda" : "Pindahkan ke folder ini"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
