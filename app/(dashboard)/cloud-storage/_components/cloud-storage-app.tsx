"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  Folder,
  FolderPlus,
  Upload,
  Search,
  Trash2,
  Home,
  ChevronRight,
  MoreVertical,
  Download,
  Pencil,
  Copy,
  Scissors,
  ClipboardPaste,
  Share2,
  RotateCcw,
  X,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Video,
  Music,
  Loader2,
  HardDrive,
  Link2,
  Check,
  Star,
  StarOff,
  LayoutGrid,
  List as ListIcon,
  ArrowDownWideNarrow,
  Archive,
  Clock,
  FilePlus2,
  RotateCw,
  FolderInput,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile, CloudSort, CloudTypeFilter, CloudView } from "@/lib/cloudstorage/api";
import { uploadFileChunked, CHUNKED_THRESHOLD, clearResumeState } from "@/lib/cloudstorage/chunked-upload";
import { FilePreviewDialog } from "./file-preview-dialog";
import { TextEditorDialog } from "./text-editor-dialog";
import { FolderPickerDialog } from "./folder-picker-dialog";
import { useRubberBandSelection } from "./use-rubber-band";

type View = CloudView;

/** Item yang sedang diseret (untuk memindahkan ke folder). */
interface DragState {
  ids: string[];
  mode: "move" | "copy";
}

function KindIcon({ file, className }: { file: CloudFile; className?: string }) {
  const kind = cloud.fileKind(file);
  const cls = cn("h-6 w-6", className);
  switch (kind) {
    case "folder":
      return <Folder className={cn(cls, "text-emerald-600")} />;
    case "image":
      return <ImageIcon className={cn(cls, "text-sky-600")} />;
    case "video":
      return <Video className={cn(cls, "text-violet-600")} />;
    case "audio":
      return <Music className={cn(cls, "text-pink-600")} />;
    case "pdf":
      return <FileText className={cn(cls, "text-rose-600")} />;
    case "doc":
      return <FileText className={cn(cls, "text-amber-600")} />;
    default:
      return <FileIcon className={cn(cls, "text-neutral-500")} />;
  }
}

/** Format tanggal ringkas dari Unix seconds. */
function formatDate(ts: number): string {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function CloudStorageApp() {
  const [view, setView] = useState<View>("files");
  const [cwd, setCwd] = useState<string | null>(null);
  const [crumbs, setCrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: "Beranda" }]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [trash, setTrash] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<cloud.CloudUsage>({ used_bytes: 0, file_count: 0 });
  const [config, setConfig] = useState<cloud.CloudConfig | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{ ids: string[]; mode: "copy" | "cut" } | null>(null);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CloudFile[] | null>(null);

  // Tampilan & sortir (disimpan di localStorage).
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<CloudSort>("name");
  const [typeFilter, setTypeFilter] = useState<CloudTypeFilter>("all");

  const [uploads, setUploads] = useState<Array<{ name: string; percent: number }>>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<CloudFile | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [preview, setPreview] = useState<CloudFile | null>(null);
  const [editorTarget, setEditorTarget] = useState<{ file: CloudFile | null } | null>(null);
  const [shareInfo, setShareInfo] = useState<{ name: string; url: string } | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CloudFile | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{ ids: string[]; mode: "move" | "copy" } | null>(null);

  // Drag & drop (pindah ke folder) & drop-upload.
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null); // id folder | "__crumb_N" | "__root"
  const [dropUploadActive, setDropUploadActive] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // Muat preferensi tampilan.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const l = window.localStorage.getItem("cloud.layout");
    if (l === "grid" || l === "list") setLayout(l);
    const s = window.localStorage.getItem("cloud.sort");
    if (s) setSort(s as CloudSort);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("cloud.layout", layout);
    window.localStorage.setItem("cloud.sort", sort);
  }, [layout, sort]);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(await cloud.fetchUsage());
    } catch {
      /* abaikan */
    }
  }, []);

  const loadFiles = useCallback(
    async (parentId: string | null) => {
      setLoading(true);
      try {
        const params: cloud.ListFilesParams = { parentId, sort, type: typeFilter };
        if (view === "starred") params.view = "starred";
        else if (view === "recent") params.view = "recent";
        else if (view === "large") params.view = "large";
        setFiles(await cloud.listFiles2(params));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Gagal memuat berkas");
      } finally {
        setLoading(false);
      }
    },
    [sort, typeFilter, view],
  );

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      setTrash(await cloud.listTrash());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat trash");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cloud.fetchConfig().then(setConfig).catch(() => {});
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    if (view === "trash") loadTrash();
    else loadFiles(cwd);
    setSelected(new Set());
  }, [view, cwd, loadFiles, loadTrash]);

  // Pencarian (debounce sederhana).
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setSearchResults(await cloud.searchFiles(search.trim()));
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const displayed = searchResults ?? files;
  const isCrossFolderView = view === "starred" || view === "recent" || view === "large";
  const showBreadcrumb = view === "files" && !search;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFolder = (file: CloudFile) => {
    setSearch("");
    setCwd(file.id);
    setCrumbs((c) => [...c, { id: file.id, name: file.name }]);
  };

  const navigateCrumb = (index: number) => {
    setSearch("");
    const target = crumbs[index];
    setCrumbs(crumbs.slice(0, index + 1));
    setCwd(target.id);
  };

  // ----- Upload (klik, input, dan drop) -----
  const doUpload = useCallback(
    async (fileList: FileList | File[] | null, parentId: string | null) => {
      const arr = fileList ? Array.from(fileList) : [];
      if (arr.length === 0) return;
      if (!config?.enabled) {
        toast.error("Cloud Storage belum diaktifkan (bot token belum diisi)");
        return;
      }
      setUploads(arr.map((f) => ({ name: f.name, percent: 0 })));
      let ok = 0;
      for (let i = 0; i < arr.length; i++) {
        try {
          if (arr[i].size > CHUNKED_THRESHOLD) {
            await uploadFileChunked(arr[i], parentId, (p) => {
              setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, percent: p.percent } : u)));
            });
            await clearResumeState(arr[i]);
          } else {
            await cloud.uploadFileWithProgress(arr[i], parentId, (p) => {
              setUploads((prev) => prev.map((u, idx) => (idx === i ? { ...u, percent: p } : u)));
            });
          }
          ok++;
        } catch (e: unknown) {
          toast.error(`${arr[i].name}: ${e instanceof Error ? e.message : "gagal"}`);
        }
      }
      setUploads([]);
      if (ok > 0) toast.success(`${ok} berkas diunggah`);
      loadFiles(parentId);
      loadUsage();
    },
    [config, loadFiles, loadUsage],
  );

  const handleUpload = (fileList: FileList | null) => {
    doUpload(fileList, cwd);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Drop-upload pada area daftar.
  const onAreaDrop = (e: React.DragEvent) => {
    // Bila ini drag internal (memindahkan item), jangan perlakukan sebagai upload.
    if (drag) return;
    e.preventDefault();
    setDropUploadActive(false);
    if (e.dataTransfer.files?.length) doUpload(e.dataTransfer.files, cwd);
  };
  const onAreaDragOver = (e: React.DragEvent) => {
    if (drag) return;
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      setDropUploadActive(true);
    }
  };
  const onAreaDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) setDropUploadActive(false);
  };

  // ----- Pindah/ salin via drag -----
  const startDrag = (e: React.DragEvent, ids: string[], mode: "move" | "copy") => {
    setDrag({ ids, mode });
    e.dataTransfer.effectAllowed = mode === "copy" ? "copy" : "move";
    e.dataTransfer.setData("text/plain", ids.join(","));
  };

  const dropOnFolder = async (targetId: string | null) => {
    if (!drag) return;
    const { ids, mode } = drag;
    // Tidak boleh menjatuhkan ke folder tujuan yang sedang dipindah.
    if (targetId && ids.includes(targetId)) {
      setDrag(null);
      setDragOverFolder(null);
      return;
    }
    setBusy(true);
    try {
      if (mode === "copy") {
        await cloud.copyFiles(ids, targetId);
        toast.success("Disalin");
      } else {
        await cloud.moveFiles(ids, targetId);
        toast.success("Dipindahkan");
      }
      setSelected(new Set());
      loadFiles(cwd);
      loadUsage();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memindahkan");
    } finally {
      setBusy(false);
      setDrag(null);
      setDragOverFolder(null);
    }
  };

  // ----- Aksi lain -----
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await cloud.createFolder(name, cwd);
      toast.success("Folder dibuat");
      setNewFolderOpen(false);
      setNewFolderName("");
      loadFiles(cwd);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat folder");
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await cloud.renameFile(renameTarget.id, renameValue.trim());
      toast.success("Nama diubah");
      setRenameTarget(null);
      loadFiles(cwd);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengganti nama");
    }
  };

  const handleTrash = async () => {
    if (!deleteTarget) return;
    try {
      await cloud.trashFile(deleteTarget.id);
      toast.success("Dipindahkan ke trash");
      setDeleteTarget(null);
      loadFiles(cwd);
      loadUsage();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  const trashMany = async (ids: string[]) => {
    for (const id of ids) {
      try {
        await cloud.trashFile(id);
      } catch {
        /* lanjutkan */
      }
    }
    setSelected(new Set());
    toast.success("Dipindahkan ke trash");
    loadFiles(cwd);
    loadUsage();
  };

  const doPaste = async () => {
    if (!clipboard) return;
    setBusy(true);
    try {
      if (clipboard.mode === "copy") {
        await cloud.copyFiles(clipboard.ids, cwd);
        toast.success("Disalin");
      } else {
        await cloud.moveFiles(clipboard.ids, cwd);
        toast.success("Dipindahkan");
        setClipboard(null);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal menempel");
    } finally {
      setBusy(false);
      loadFiles(cwd);
    }
  };

  const handleShare = async (file: CloudFile) => {
    try {
      const token = await cloud.createShare(file.id);
      setShareInfo({ name: file.name, url: cloud.shareUrl(token) });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat tautan");
    }
  };

  const toggleStar = async (file: CloudFile, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const updated = await cloud.setStar(file.id, !file.is_starred);
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      if (searchResults) setSearchResults((prev) => prev?.map((f) => (f.id === updated.id ? updated : f)) ?? null);
      if (isCrossFolderView) loadFiles(cwd);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah favorit");
    }
  };

  const downloadZipSelected = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      const fallback = ids.length === 1 ? displayed.find((f) => f.id === ids[0])?.name ?? "berkas" : "cloud-storage";
      await cloud.downloadZip(ids, fallback);
      toast.success("Arsip ZIP diunduh");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunduh ZIP");
    } finally {
      setBusy(false);
    }
  };

  const handleRotate = async (file: CloudFile, deg: number) => {
    setBusy(true);
    try {
      await cloud.rotateImage(file.id, deg);
      toast.success("Gambar diputar");
      setPreview(null);
      loadFiles(cwd);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal memutar gambar");
    } finally {
      setBusy(false);
    }
  };

  // ----- Seleksi area (rubber-band) -----
  const onBandSelect = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);
  const { rect: bandRect, onMouseDown: onBandMouseDown } = useRubberBandSelection({
    enabled: view !== "trash" && !search,
    onSelect: onBandSelect,
    containerRef: gridRef,
  });

  const usedPercent = useMemo(() => {
    if (usage.used_bytes <= 0) return 0;
    const baseline = 5 * 1024 * 1024 * 1024;
    return Math.min(100, Math.round((usage.used_bytes / baseline) * 100));
  }, [usage]);

  const viewTitle: Record<View, string> = {
    files: "Penyimpanan pribadi Anda",
    starred: "Berkas favorit Anda",
    recent: "Berkas yang terakhir diakses",
    large: "Berkas dengan ukuran terbesar",
    trash: "Berkas yang dihapus",
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <Cloud className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Cloud Storage</h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">{viewTitle[view]}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {usage.used_bytes > 0 && (
            <Badge variant="secondary" className="gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {cloud.formatBytes(usage.used_bytes)} • {usage.file_count} berkas
            </Badge>
          )}
        </div>
      </div>

      {usage.used_bytes > 0 && (
        <div className="space-y-1">
          <Progress value={usedPercent} className="h-1.5" />
          <p className="text-xs text-neutral-400">Pemakaian penyimpanan (tanpa batas kuota)</p>
        </div>
      )}

      {config && !config.enabled && (
        <Card className="border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Cloud Storage belum diaktifkan. Administrator perlu mengisi <code>CLOUDSTORAGE_BOT_TOKEN</code> dan{" "}
            <code>CLOUDSTORAGE_CHAT_ID</code> di server.
          </p>
        </Card>
      )}

      {/* Navigasi view */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { v: "files" as View, label: "Berkas", icon: Home },
            { v: "starred" as View, label: "Favorit", icon: Star },
            { v: "recent" as View, label: "Terbaru", icon: Clock },
            { v: "large" as View, label: "Ukuran besar", icon: ArrowDownWideNarrow },
            { v: "trash" as View, label: "Trash", icon: Trash2 },
          ] as const
        ).map(({ v, label, icon: Icon }) => (
          <Button
            key={v}
            size="sm"
            variant={view === v ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => {
              setView(v);
              setSearch("");
              if (v !== "trash") setCwd(null);
            }}
          >
            <Icon className="h-4 w-4" /> {label}
          </Button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {view === "files" ? (
          <>
            <Button onClick={() => fileInputRef.current?.click()} disabled={!config?.enabled} className="gap-2">
              <Upload className="h-4 w-4" /> Unggah
            </Button>
            <Button variant="outline" onClick={() => setNewFolderOpen(true)} className="gap-2">
              <FolderPlus className="h-4 w-4" /> Folder Baru
            </Button>
            <Button variant="outline" onClick={() => setEditorTarget({ file: null })} className="gap-2">
              <FilePlus2 className="h-4 w-4" /> Catatan
            </Button>
            {clipboard && (
              <Button variant="outline" onClick={doPaste} disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardPaste className="h-4 w-4" />}
                Tempel {clipboard.mode === "cut" ? "(pindah)" : "(salin)"} {clipboard.ids.length}
              </Button>
            )}
          </>
        ) : view === "trash" ? (
          trash.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await cloud.restoreAll();
                    toast.success("Semua dipulihkan");
                    loadTrash();
                    loadUsage();
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Gagal");
                  }
                }}
              >
                <RotateCcw className="h-4 w-4" /> Pulihkan Semua
              </Button>
              <Button variant="destructive" onClick={() => setConfirmEmptyTrash(true)}>
                Kosongkan Trash
              </Button>
            </>
          )
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view !== "trash" && (
            <>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CloudTypeFilter)}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua jenis</SelectItem>
                  <SelectItem value="folder">Folder</SelectItem>
                  <SelectItem value="image">Gambar</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="doc">Dokumen</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>

              {view === "files" && (
                <Select value={sort} onValueChange={(v) => setSort(v as CloudSort)}>
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nama (A–Z)</SelectItem>
                    <SelectItem value="size">Ukuran terbesar</SelectItem>
                    <SelectItem value="date_desc">Terbaru diubah</SelectItem>
                    <SelectItem value="date_asc">Terlama diubah</SelectItem>
                    <SelectItem value="manual">Urutan manual</SelectItem>
                  </SelectContent>
                </Select>
              )}

              <div className="flex overflow-hidden rounded-md border dark:border-neutral-700">
                <button
                  className={cn("px-2 py-1.5", layout === "grid" ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                  onClick={() => setLayout("grid")}
                  title="Tampilan kotak"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  className={cn("px-2 py-1.5", layout === "list" ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900" : "hover:bg-neutral-100 dark:hover:bg-neutral-800")}
                  onClick={() => setLayout("list")}
                  title="Tampilan daftar"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari berkas..."
                  className="pl-8"
                />
              </div>
            </>
          )}
        </div>

        <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {/* Breadcrumb (juga drop-target ke Beranda) */}
      {showBreadcrumb && (
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />}
              <button
                onClick={() => navigateCrumb(i)}
                onDragOver={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  setDragOverFolder("__crumb_" + i);
                }}
                onDrop={(e) => {
                  if (!drag) return;
                  e.preventDefault();
                  dropOnFolder(c.id);
                }}
                className={cn(
                  "rounded px-1.5 py-0.5 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                  i === crumbs.length - 1 ? "font-medium text-neutral-900 dark:text-neutral-100" : "text-neutral-500",
                  (dragOverFolder === "__crumb_" + i || (i === 0 && dragOverFolder === "__root")) &&
                    "bg-emerald-100 ring-1 ring-emerald-500 dark:bg-emerald-900/40",
                )}
              >
                {c.name}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* Progress upload */}
      {uploads.length > 0 && (
        <Card className="space-y-2 p-3">
          {uploads.map((u, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="truncate">{u.name}</span>
                <span>{u.percent}%</span>
              </div>
              <Progress value={u.percent} className="h-1.5" />
            </div>
          ))}
        </Card>
      )}

      {/* Grid / daftar — area drop-upload + rubber-band */}
      <div
        ref={gridRef}
        className={cn("relative min-h-[200px] rounded-xl", dropUploadActive && "ring-2 ring-emerald-500 ring-offset-2")}
        onMouseDown={onBandMouseDown}
        onDragOver={onAreaDragOver}
        onDragLeave={onAreaDragLeave}
        onDrop={onAreaDrop}
      >
        {/* Overlay drop-upload */}
        {dropUploadActive && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-emerald-50/80 backdrop-blur-sm dark:bg-emerald-950/60">
            <div className="flex flex-col items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Upload className="h-10 w-10" />
              <p className="font-medium">Lepaskan berkas untuk mengunggah</p>
            </div>
          </div>
        )}

        {/* Kotak seleksi area */}
        {bandRect && (
          <div
            className="pointer-events-none absolute z-20 rounded border border-emerald-500 bg-emerald-500/10"
            style={{ left: bandRect.x, top: bandRect.y, width: bandRect.w, height: bandRect.h }}
          />
        )}

        {loading ? (
          <div className={cn(layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5" : "space-y-2")}>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className={cn(layout === "grid" ? "h-32 rounded-xl" : "h-14 rounded-lg")} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-neutral-400">
            {view === "trash" ? <Trash2 className="h-12 w-12" /> : view === "starred" ? <Star className="h-12 w-12" /> : <Cloud className="h-12 w-12" />}
            <p>
              {view === "trash"
                ? "Trash kosong"
                : search
                  ? "Tidak ada hasil"
                  : view === "starred"
                    ? "Belum ada berkas favorit"
                    : "Belum ada berkas"}
            </p>
          </div>
        ) : view === "trash" ? (
          <div className="divide-y rounded-xl border dark:border-neutral-800">
            {trash.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3">
                <KindIcon file={f} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-neutral-400">
                    {cloud.formatBytes(f.size)} • dihapus {f.deleted_at ? formatDate(f.deleted_at) : "-"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      await cloud.restoreFile(f.id);
                      toast.success("Dipulihkan");
                      loadTrash();
                      loadUsage();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Pulihkan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-rose-600"
                  onClick={async () => {
                    try {
                      await cloud.permanentDelete(f.id);
                      toast.success("Dihapus permanen");
                      loadTrash();
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "Gagal");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Hapus
                </Button>
              </div>
            ))}
          </div>
        ) : layout === "list" ? (
          /* ================= TAMPILAN DAFTAR ================= */
          <div className="overflow-hidden rounded-xl border dark:border-neutral-800">
            <div className="hidden grid-cols-[auto_1fr_100px_120px_130px_40px] items-center gap-3 border-b bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 md:grid">
              <span className="w-4" />
              <span>Nama</span>
              <span>Jenis</span>
              <span className="text-right">Ukuran</span>
              <span>Diubah</span>
              <span />
            </div>
            {displayed.map((f) => (
              <div
                key={f.id}
                data-select-id={f.id}
                draggable
                onDragStart={(e) => startDrag(e, selected.has(f.id) ? Array.from(selected) : [f.id], e.altKey ? "copy" : "move")}
                onDragEnd={() => {
                  setDrag(null);
                  setDragOverFolder(null);
                }}
                onDragOver={(e) => {
                  if (!drag || !f.is_folder) return;
                  e.preventDefault();
                  setDragOverFolder(f.id);
                }}
                onDragLeave={() => f.is_folder && setDragOverFolder(null)}
                onDrop={(e) => {
                  if (!drag || !f.is_folder) return;
                  e.preventDefault();
                  dropOnFolder(f.id);
                }}
                className={cn(
                  "grid cursor-pointer grid-cols-[auto_1fr_40px] items-center gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-neutral-50 md:grid-cols-[auto_1fr_100px_120px_130px_40px] dark:border-neutral-800 dark:hover:bg-neutral-900",
                  selected.has(f.id) && "bg-emerald-50 dark:bg-emerald-950/30",
                  dragOverFolder === f.id && "ring-2 ring-inset ring-emerald-500",
                )}
                onClick={() => (f.is_folder ? openFolder(f) : setPreview(f))}
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={() => toggleSelect(f.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 accent-emerald-600"
                />
                <div className="flex min-w-0 items-center gap-2">
                  <GripVertical className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  <button
                    className="shrink-0"
                    onClick={(e) => toggleStar(f, e)}
                    title={f.is_starred ? "Hapus dari favorit" : "Tandai favorit"}
                  >
                    {f.is_starred ? (
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ) : (
                      <StarOff className="h-4 w-4 text-neutral-300" />
                    )}
                  </button>
                  <KindIcon file={f} className="h-4 w-4" />
                  <span className="truncate text-sm font-medium">{f.name}</span>
                </div>
                <span className="hidden text-xs text-neutral-400 md:block">{f.is_folder ? "Folder" : (f.mime_type || "—").split("/")[1] || "berkas"}</span>
                <span className="hidden text-right text-xs text-neutral-500 md:block">{f.is_folder ? "—" : cloud.formatBytes(f.size)}</span>
                <span className="hidden text-xs text-neutral-500 md:block">{formatDate(f.updated_at)}</span>
                <RowMenu
                  file={f}
                  onPreview={() => setPreview(f)}
                  onRename={() => {
                    setRenameTarget(f);
                    setRenameValue(f.name);
                  }}
                  onCopy={() => setClipboard({ ids: [f.id], mode: "copy" })}
                  onCut={() => setClipboard({ ids: [f.id], mode: "cut" })}
                  onShare={() => handleShare(f)}
                  onDelete={() => setDeleteTarget(f)}
                  onEdit={() => setEditorTarget({ file: f })}
                  onRotate={(deg) => handleRotate(f, deg)}
                  onMoveTo={() => setPickerTarget({ ids: [f.id], mode: "move" })}
                  onCopyTo={() => setPickerTarget({ ids: [f.id], mode: "copy" })}
                />
              </div>
            ))}
          </div>
        ) : (
          /* ================= TAMPILAN KOTAK ================= */
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {displayed.map((f) => (
              <Card
                key={f.id}
                data-select-id={f.id}
                draggable
                onDragStart={(e) => startDrag(e, selected.has(f.id) ? Array.from(selected) : [f.id], e.altKey ? "copy" : "move")}
                onDragEnd={() => {
                  setDrag(null);
                  setDragOverFolder(null);
                }}
                onDragOver={(e) => {
                  if (!drag || !f.is_folder) return;
                  e.preventDefault();
                  setDragOverFolder(f.id);
                }}
                onDragLeave={() => f.is_folder && setDragOverFolder(null)}
                onDrop={(e) => {
                  if (!drag || !f.is_folder) return;
                  e.preventDefault();
                  dropOnFolder(f.id);
                }}
                className={cn(
                  "group relative flex cursor-pointer flex-col items-center gap-2 p-3 transition hover:shadow-md",
                  selected.has(f.id) && "ring-2 ring-emerald-500",
                  dragOverFolder === f.id && "ring-2 ring-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
                )}
                onClick={() => (f.is_folder ? openFolder(f) : setPreview(f))}
              >
                <input
                  type="checkbox"
                  checked={selected.has(f.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(f.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute left-2 top-2 h-4 w-4 accent-emerald-600"
                />
                <button
                  className="absolute left-7 top-2.5"
                  onClick={(e) => toggleStar(f, e)}
                  title={f.is_starred ? "Hapus dari favorit" : "Tandai favorit"}
                >
                  {f.is_starred ? (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ) : (
                    <StarOff className="h-4 w-4 text-neutral-300 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
                <div className="absolute right-1 top-1">
                  <RowMenu
                    file={f}
                    onPreview={() => setPreview(f)}
                    onRename={() => {
                      setRenameTarget(f);
                      setRenameValue(f.name);
                    }}
                    onCopy={() => setClipboard({ ids: [f.id], mode: "copy" })}
                    onCut={() => setClipboard({ ids: [f.id], mode: "cut" })}
                    onShare={() => handleShare(f)}
                    onDelete={() => setDeleteTarget(f)}
                    onEdit={() => setEditorTarget({ file: f })}
                    onRotate={(deg) => handleRotate(f, deg)}
                    onMoveTo={() => setPickerTarget({ ids: [f.id], mode: "move" })}
                    onCopyTo={() => setPickerTarget({ ids: [f.id], mode: "copy" })}
                  />
                </div>

                <div className="mt-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-neutral-50 dark:bg-neutral-900">
                  {cloud.fileKind(f) === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cloud.fileThumbUrl(f.id)}
                      alt={f.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <KindIcon file={f} className="h-8 w-8" />
                  )}
                </div>
                <p className="line-clamp-2 w-full break-words text-center text-xs font-medium" title={f.name}>
                  {f.name}
                </p>
                <p className="text-[11px] text-neutral-400">
                  {f.is_folder ? "Folder" : cloud.formatBytes(f.size)}
                  {isCrossFolderView && f.path ? ` • ${f.path.split(" / ").slice(0, -1).join(" / ")}` : ""}
                </p>
              </Card>
            ))}
          </div>
        )}

        {/* Petunjuk (hanya bila ada isi) */}
        {!loading && displayed.length > 0 && view !== "trash" && (
          <p className="mt-3 text-center text-xs text-neutral-400">
            Seret berkas ke folder untuk memindahkan (tahan Alt = salin) • Seret di ruang kosong untuk memilih area
          </p>
        )}
      </div>

      {/* ================= Dialog ================= */}

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Folder Baru</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nama folder"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreateFolder}>Buat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti Nama</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Batal
            </Button>
            <Button onClick={handleRename}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share */}
      <Dialog open={!!shareInfo} onOpenChange={(o) => !o && setShareInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Tautan Berbagi
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-500">{shareInfo?.name}</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareInfo?.url ?? ""} />
            <Button
              className="gap-1.5"
              onClick={() => {
                if (shareInfo) {
                  navigator.clipboard.writeText(shareInfo.url);
                  toast.success("Tautan disalin");
                }
              }}
            >
              <Check className="h-4 w-4" /> Salin
            </Button>
          </div>
          <p className="text-xs text-neutral-400">
            Siapa pun yang memiliki tautan ini dapat mengunduh berkas/folder tersebut.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareInfo(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pindahkan ke trash?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; akan dipindahkan ke trash. Anda dapat memulihkannya nanti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleTrash}>Pindahkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm empty trash */}
      <AlertDialog open={confirmEmptyTrash} onOpenChange={setConfirmEmptyTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kosongkan trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua berkas di trash akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await cloud.emptyTrash();
                  toast.success("Trash dikosongkan");
                  loadTrash();
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Gagal");
                }
              }}
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview */}
      {preview && (
        <FilePreviewDialog
          file={preview}
          onClose={() => setPreview(null)}
          onEdit={() => {
            setEditorTarget({ file: preview });
            setPreview(null);
          }}
          onRotate={(deg) => handleRotate(preview, deg)}
        />
      )}

      {/* Editor teks */}
      {editorTarget && (
        <TextEditorDialog
          file={editorTarget.file}
          parentId={cwd}
          onClose={() => setEditorTarget(null)}
          onSaved={() => {
            loadFiles(cwd);
            loadUsage();
          }}
        />
      )}

      {/* Pilih folder tujuan (fallback sentuh) */}
      {pickerTarget && (
        <FolderPickerDialog
          title={pickerTarget.mode === "copy" ? "Salin ke Folder" : "Pindah ke Folder"}
          excludeIds={pickerTarget.ids}
          onClose={() => setPickerTarget(null)}
          onPick={async (folderId) => {            setBusy(true);
            try {
              if (pickerTarget.mode === "copy") {
                await cloud.copyFiles(pickerTarget.ids, folderId);
                toast.success("Disalin");
              } else {
                await cloud.moveFiles(pickerTarget.ids, folderId);
                toast.success("Dipindahkan");
              }
              setSelected(new Set());
              loadFiles(cwd);
              loadUsage();
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Gagal");
            } finally {
              setBusy(false);
              setPickerTarget(null);
            }
          }}
        />
      )}

      {/* Floating multi-select actions */}
      {selected.size > 0 && view !== "trash" && (
        <div className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-full border bg-white px-3 py-2 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 md:bottom-6">
          <span className="px-2 text-sm font-medium">{selected.size} dipilih</span>
          <Button size="sm" variant="ghost" onClick={downloadZipSelected} disabled={busy} title="Unduh ZIP">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setClipboard({ ids: Array.from(selected), mode: "copy" })} title="Salin">
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setClipboard({ ids: Array.from(selected), mode: "cut" })} title="Potong">
            <Scissors className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPickerTarget({ ids: Array.from(selected), mode: "move" })}
            title="Pindah ke folder"
          >
            <FolderInput className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600"
            onClick={() => trashMany(Array.from(selected))}
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} title="Batal pilih">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

/** Menu aksi per-item (dipakai di tampilan kotak maupun daftar). */
function RowMenu({
  file,
  onPreview,
  onRename,
  onCopy,
  onCut,
  onShare,
  onDelete,
  onEdit,
  onRotate,
  onMoveTo,
  onCopyTo,
}: {
  file: CloudFile;
  onPreview: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onShare: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRotate: (deg: number) => void;
  onMoveTo: () => void;
  onCopyTo: () => void;
}) {
  const isImage = !file.is_folder && (file.mime_type || "").startsWith("image/");
  const canEdit = cloud.isEditableText(file);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {!file.is_folder && (
          <DropdownMenuItem onClick={onPreview}>
            <FileText className="mr-2 h-4 w-4" /> Pratinjau
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" /> Edit teks
          </DropdownMenuItem>
        )}
        {isImage && (
          <>
            <DropdownMenuItem onClick={() => onRotate(90)}>
              <RotateCw className="mr-2 h-4 w-4" /> Putar 90° ke kanan
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRotate(270)}>
              <RotateCw className="mr-2 h-4 w-4 -scale-x-100" /> Putar 90° ke kiri
            </DropdownMenuItem>
          </>
        )}
        {!file.is_folder && (
          <DropdownMenuItem asChild>
            <a href={cloud.fileDownloadUrl(file.id, true)} download>
              <Download className="mr-2 h-4 w-4" /> Unduh
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="mr-2 h-4 w-4" /> Ganti Nama
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveTo}>
          <FolderInput className="mr-2 h-4 w-4" /> Pindah ke…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyTo}>
          <Copy className="mr-2 h-4 w-4" /> Salin ke…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopy}>
          <Copy className="mr-2 h-4 w-4" /> Salin
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCut}>
          <Scissors className="mr-2 h-4 w-4" /> Potong
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShare}>
          <Share2 className="mr-2 h-4 w-4" /> Bagikan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-rose-600" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
