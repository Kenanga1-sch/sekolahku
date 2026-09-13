"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Mail, MailOpen, Check, Trash2, RefreshCw, ChevronDown, Paperclip, Upload, FileVideo, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { useMessages } from "./use-messages";

type MessagesHook = ReturnType<typeof useMessages>;

const CATEGORY_STYLE: Record<string, string> = {
  pengaduan: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  kritik: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  saran: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  lainnya: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru",
  diproses: "Diproses",
  selesai: "Selesai",
};

const STATUS_STYLE: Record<string, string> = {
  baru: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  diproses: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  selesai: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

const FILTERS = [
  { id: "", label: "Semua" },
  { id: "pengaduan", label: "Pengaduan" },
  { id: "kritik", label: "Kritik" },
  { id: "saran", label: "Saran" },
  { id: "lainnya", label: "Lainnya" },
];

export function MessagesTab({ messages, loading, refreshing, error, pagination, category, changeCategory, refresh, handleMarkAsRead, handleUpdateStatus, handleDelete, expandedIds, toggleExpand, attachments, uploadingId, handleUploadResolution, formatBytes }: MessagesHook) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const openFilePicker = (msgId: string) => {
    setUploadTargetId(msgId);
    fileInputRef.current?.click();
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetId;
    e.target.value = "";
    setUploadTargetId(null);
    if (file && target) handleUploadResolution(target, file);
  };

  return (
    <div className="space-y-6">
      {/* File picker tersembunyi untuk bukti tindak lanjut */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov"
        className="hidden"
        onChange={onFilePicked}
      />

      <div className="flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-xl font-semibold">Pesan Masuk</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id || "semua"}
            onClick={() => changeCategory(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
              category === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-input hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Card className="border-none shadow-xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600"><Mail className="h-5 w-5" /></div>
            <CardTitle>Daftar Pesan ({pagination.total || messages.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">{error}</div>
          )}
          <DataTable
            data={messages}
            getRowId={(msg) => msg.id}
            loading={loading}
            emptyTitle="Belum ada pesan masuk"
            emptyDescription="Kritik, saran, dan pengaduan dari layanan publik akan tampil di sini."
            onToggleExpand={toggleExpand}
            expandedRowIds={expandedIds}
            columns={[
              {
                key: "isRead",
                header: "Status",
                card: "field",
                render: (msg) => !msg.isRead ? <div className="h-2 w-2 rounded-full bg-blue-500" title="Belum dibaca" /> : <MailOpen className="h-4 w-4 text-muted-foreground" />,
              },
              {
                key: "createdAt",
                header: "Tanggal",
                card: "field",
                render: (msg) => (
                  <span className="font-medium text-muted-foreground">
                    {msg.createdAt ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}
                  </span>
                ),
              },
              {
                key: "name",
                header: "Pengirim",
                card: "title",
                render: (msg) => (
                  <div className="flex flex-col">
                    <span className={`${!msg.isRead ? "font-bold" : "font-medium"} text-zinc-700 dark:text-zinc-300`}>{msg.name}</span>
                    <span className="text-xs text-muted-foreground">{msg.email || msg.phone || "Anonim"}</span>
                  </div>
                ),
              },
              {
                key: "category",
                header: "Kategori",
                card: "field",
                render: (msg) => (
                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", CATEGORY_STYLE[msg.category || "lainnya"])}>
                    {msg.category || "lainnya"}
                  </span>
                ),
              },
              {
                key: "status",
                header: "Tindak Lanjut",
                card: "field",
                render: (msg) => (
                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[msg.status || "baru"])}>
                    {STATUS_LABEL[msg.status || "baru"] || msg.status}
                  </span>
                ),
              },
              {
                key: "message",
                header: "Pesan",
                card: "hidden",
                render: (msg) => (
                  <p className={`max-w-md truncate transition-colors ${!msg.isRead ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-muted-foreground"}`}>{msg.message}</p>
                ),
              },
            ]}
            expandedContent={(msg) => (
              <div className="w-full space-y-4 p-1">
                <div className="rounded-lg border bg-muted/30 dark:bg-zinc-800/50 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Isi Pesan</p>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Nama</p>
                      <p className="font-medium">{msg.name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kontak</p>
                      <p className="font-medium break-words">{msg.phone || msg.email || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kode Tiket</p>
                      <p className="font-mono font-medium">{msg.ticket || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Diterima</p>
                      <p className="font-medium">{msg.createdAt ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Lampiran</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openFilePicker(msg.id)}
                      disabled={uploadingId === msg.id}
                    >
                      {uploadingId === msg.id ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
                      Unggah Bukti Tindak Lanjut
                    </Button>
                  </div>
                  {(attachments[msg.id]?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">Belum ada lampiran. Bukti tindak lanjut (foto/video) tampil sebagai jumlah di halaman cek status pelapor.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {attachments[msg.id]?.map((att) => (
                        <a
                          key={att.id}
                          href={att.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-2 rounded-lg border p-2 hover:bg-muted transition-colors"
                        >
                          {att.fileKind === "video" ? (
                            <FileVideo className="h-8 w-8 shrink-0 text-purple-500" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.filePath}
                              alt={att.originalName}
                              className="h-8 w-8 shrink-0 rounded object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{att.originalName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {att.kind === "resolution" ? "Bukti tindak lanjut" : "Bukti pelapor"} · {formatBytes(att.fileSize)}
                            </p>
                          </div>
                          <Paperclip className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            actions={(msg) => (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => toggleExpand(msg.id)}
                  title="Buka detail pesan"
                >
                  Detail <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Ubah status tindak lanjut">
                      Tindak lanjut <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel className="text-xs">Status laporan {msg.ticket ? `(${msg.ticket})` : ""}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, "baru")}>Baru diterima</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, "diproses")}>Sedang diproses</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, "selesai")}>Selesai ditindaklanjuti</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {!msg.isRead && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20" onClick={() => handleMarkAsRead(msg.id)} title="Tandai sudah dibaca">
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <AlertDialog open={deletingId === msg.id} onOpenChange={(v) => !v && setDeletingId(null)}>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20" title="Hapus pesan" onClick={() => setDeletingId(msg.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus Pesan?</AlertDialogTitle>
                      <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Pesan dari <strong>{msg.name}</strong> akan dihapus permanen.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { handleDelete(msg.id); setDeletingId(null); }} className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
