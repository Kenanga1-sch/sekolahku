"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Mail, Loader2, Check, Trash2, MailOpen, RefreshCcw } from "lucide-react";
import { getContactMessagesAction, markMessageAsReadAction, deleteMessageAction } from "@/actions/contact";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject?: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
}

interface ContactMessagePayload {
  items?: ContactMessage[];
  total?: number;
  page?: number;
  perPage?: number;
  totalPages?: number;
}

export default function MessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pagination, setPagination] = useState<ContactMessagePayload>({
    total: 0,
    page: 1,
    perPage: 20,
    totalPages: 1,
  });

  const normalizeMessages = (payload: unknown): ContactMessagePayload => {
    if (Array.isArray(payload)) {
      return { items: payload, total: payload.length, page: 1, perPage: payload.length, totalPages: 1 };
    }
    if (payload && typeof payload === "object") {
      const response = payload as { data?: ContactMessagePayload | ContactMessage[] };
      if (Array.isArray(response.data)) {
        return { items: response.data, total: response.data.length, page: 1, perPage: response.data.length, totalPages: 1 };
      }
      if (response.data && typeof response.data === "object") {
        return response.data;
      }
    }
    return { items: [], total: 0, page: 1, perPage: 20, totalPages: 1 };
  };

  const fetchMessages = async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const res = await getContactMessagesAction();
      if (res.success) {
        const payload = normalizeMessages(res.data);
        setMessages(payload.items || []);
        setPagination(payload);
      } else {
        setLoadError(res.error || "Gagal memuat pesan");
        toast.error(res.error || "Gagal memuat pesan");
      }
    } catch (err) {
      console.error(err);
      setLoadError("Gagal memuat pesan");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  const handleMarkAsRead = async (msgId: string) => {
    const res = await markMessageAsReadAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.map(m => m.id === msgId ? { ...m, isRead: true } : m));
      toast.success("Pesan ditandai sebagai sudah dibaca");
    } else {
      toast.error(res.error || "Gagal memperbarui status pesan");
    }
  };

  const handleDelete = async (msgId: string) => {
    const res = await deleteMessageAction(msgId);
    if (res.success) {
      setMessages((prev) => prev.filter(m => m.id !== msgId));
      setPagination((prev) => ({ ...prev, total: Math.max((prev.total || 1) - 1, 0) }));
      toast.success("Pesan berhasil dihapus");
    } else {
      toast.error(res.error || "Gagal menghapus pesan");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 to-zinc-500 dark:from-white dark:to-zinc-500">
            Pesan Masuk
          </h1>
          <p className="text-muted-foreground mt-2">
            Daftar pesan dari formulir kontak website.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setIsRefreshing(true);
            fetchMessages();
          }}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-none shadow-xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20 text-blue-600">
              <Mail className="h-5 w-5" />
            </div>
            <CardTitle>Daftar Pesan ({pagination.total || messages.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loadError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {loadError}
            </div>
          )}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <Table>
              <TableHeader className="bg-zinc-50/50 dark:bg-white/5">
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Pengirim</TableHead>
                  <TableHead>Subjek</TableHead>
                  <TableHead>Pesan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Belum ada pesan masuk.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg) => (
                    <TableRow key={msg.id} className={`group hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors ${!msg.isRead ? "bg-blue-50/30 dark:bg-blue-900/5" : ""}`}>
                      <TableCell>
                        {!msg.isRead ? (
                           <div className="h-2 w-2 rounded-full bg-blue-500" title="Belum dibaca" />
                        ) : (
                           <MailOpen className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="w-[180px] font-medium text-muted-foreground">
                        {msg.createdAt
                          ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", {
                              locale: id,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="w-[250px]">
                        <div className="flex flex-col">
                          <span className={`${!msg.isRead ? "font-bold text-zinc-900 dark:text-white" : "font-medium text-zinc-700 dark:text-zinc-300"}`}>
                            {msg.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {msg.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={`w-[200px] ${!msg.isRead ? "font-bold" : "font-medium"}`}>
                        {msg.subject || "-"}
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <p className={`truncate group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors ${!msg.isRead ? "text-zinc-900 dark:text-zinc-100 font-medium" : "text-muted-foreground"}`}>
                          {msg.message}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!msg.isRead && (
                             <Button
                               variant="ghost"
                               size="icon"
                               className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900/20"
                               onClick={() => handleMarkAsRead(msg.id)}
                               title="Tandai sudah dibaca"
                             >
                                <Check className="h-4 w-4" />
                             </Button>
                          )}
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                                title="Hapus pesan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Pesan?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tindakan ini tidak dapat dibatalkan. Pesan dari <strong>{msg.name}</strong> akan dihapus permanen.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(msg.id)} className="bg-red-600 hover:bg-red-700">
                                  Hapus
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

