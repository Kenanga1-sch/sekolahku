"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Mail, MailOpen, Check, Trash2, RefreshCw, ChevronDown } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";
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

export function MessagesTab({ messages, loading, refreshing, error, pagination, category, changeCategory, refresh, handleMarkAsRead, handleUpdateStatus, handleDelete }: MessagesHook) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
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
            actions={(msg) => (
              <div className="flex items-center justify-end gap-2">
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
