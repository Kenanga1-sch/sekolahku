"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { Mail, MailOpen, Check, Trash2, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useState } from "react";
import type { useMessages } from "./use-messages";

type MessagesHook = ReturnType<typeof useMessages>;

export function MessagesTab({ messages, loading, refreshing, error, pagination, refresh, handleMarkAsRead, handleDelete }: MessagesHook) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Log Formulir Kontak</h2>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing || loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
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
            emptyDescription="Pesan dari formulir kontak akan tampil di sini."
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
                    <span className="text-xs text-muted-foreground">{msg.email}</span>
                  </div>
                ),
              },
              {
                key: "subject",
                header: "Subjek",
                card: "field",
                render: (msg) => (
                  <span className={`${!msg.isRead ? "font-bold" : "font-medium"}`}>{msg.subject || "-"}</span>
                ),
              },
              {
                key: "message",
                header: "Pesan",
                card: "hidden",
                render: (msg) => (
                  <p className={`truncate transition-colors ${!msg.isRead ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-muted-foreground"}`}>{msg.message}</p>
                ),
              },
            ]}
            actions={(msg) => (
              <div className="flex items-center justify-end gap-2">
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