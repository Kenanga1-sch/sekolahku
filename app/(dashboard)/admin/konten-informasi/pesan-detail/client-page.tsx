"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ArrowLeft, Loader2, Send, Ticket, Paperclip, Upload, FileVideo,
  MessageSquareText, User, Phone, Mail, CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  getContactMessageAction, addContactReplyAction,
  addResolutionAttachmentAction, updateMessageStatusAction,
} from "@/actions/contact";

interface ContactAttachment {
  id: string;
  kind: "evidence" | "resolution";
  fileKind: "image" | "video";
  filePath: string;
  originalName: string;
  fileSize: number;
  createdAt?: string;
}

interface ContactReply {
  id: string;
  body: string;
  authorName: string;
  createdAt?: string;
}

interface MessageData {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  ticket: string;
  isRead: boolean;
  createdAt?: string;
}

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
  selesai: "bg-green-100 text-success dark:bg-green-900/30 dark:text-green-300",
};

const formatBytes = (n: number) => {
  if (!n) return "-";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

interface DetailPayload {
  message: MessageData;
  replies: ContactReply[];
  attachments: ContactAttachment[];
}

export default function PesanDetailClientPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<MessageData | null>(null);
  const [replies, setReplies] = useState<ContactReply[]>([]);
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);

  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getContactMessageAction(id);
      if (res.success) {
        const raw = res.data as any;
        // handleAction menumpuk objek respons Go ({ success: true, data: { message, replies, attachments } })
        // di dalam res.data. Unwrap secara defensif (dukung res.data maupun res.data.data).
        const payload: DetailPayload = raw?.data ?? raw;
        if (payload?.message) {
          setMsg(payload.message);
          setReplies(payload.replies || []);
          setAttachments(payload.attachments || []);
        } else {
          setMsg(null);
          toast.error("Format data pesan tidak sesuai");
        }
      } else {
        toast.error(res.error || "Gagal memuat pesan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal memuat pesan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const sendReply = async () => {
    const body = replyText.trim();
    if (!body || sendingReply || !id) return;
    if (body.length < 2) {
      toast.error("Isi balasan minimal 2 karakter");
      return;
    }
    setSendingReply(true);
    try {
      const res = await addContactReplyAction(id, body);
      if (res.success) {
        setReplyText("");
        toast.success("Balasan terkirim — pelapor dapat melihatnya via kode tiket");
        await fetchAll();
      } else {
        toast.error(res.error || "Gagal mengirim balasan");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengirim balasan");
    } finally {
      setSendingReply(false);
    }
  };

  const changeStatus = async (status: string) => {
    if (!id || !msg) return;
    const res = await updateMessageStatusAction(id, status);
    if (res.success) {
      setMsg({ ...msg, status, isRead: true });
      toast.success("Status diperbarui");
    } else {
      toast.error(res.error || "Gagal memperbarui status");
    }
  };

  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? 50 * 1024 * 1024 : 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Ukuran maksimal ${isVideo ? "50MB (video)" : "25MB (gambar)"}`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await addResolutionAttachmentAction(id, fd);
      if (res.success) {
        toast.success("Bukti tindak lanjut tersimpan");
        await fetchAll();
      } else {
        toast.error(res.error || "Gagal mengunggah bukti");
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal mengunggah bukti");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!msg) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/konten-informasi"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
        </Button>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Pesan tidak ditemukan.</CardContent></Card>
      </div>
    );
  }

  const evidence = attachments.filter((a) => a.kind === "evidence");
  const resolutions = attachments.filter((a) => a.kind === "resolution");

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov"
        className="hidden"
        onChange={onFilePicked}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/konten-informasi"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Status: {STATUS_LABEL[msg.status] || msg.status}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-xs">Ubah status tindak lanjut</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => changeStatus("baru")}>Baru diterima</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeStatus("diproses")}>Sedang diproses</DropdownMenuItem>
            <DropdownMenuItem onClick={() => changeStatus("selesai")}>Selesai ditindaklanjuti</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Kartu pesan — layout vertikal ala email, teks panjang membungkus */}
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold break-words">{msg.subject || "(Tanpa subjek)"}</h1>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", CATEGORY_STYLE[msg.category || "lainnya"])}>
                  {msg.category || "lainnya"}
                </span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[msg.status || "baru"])}>
                  {STATUS_LABEL[msg.status] || msg.status}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {msg.name}</span>
                {(msg.email || msg.phone) && (
                  <span className="inline-flex items-center gap-1">
                    {msg.phone ? <Phone className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                    {msg.phone || msg.email}
                  </span>
                )}
                <span>{msg.createdAt ? format(new Date(msg.createdAt), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span>
                {msg.ticket && (
                  <span className="inline-flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> <span className="font-mono">{msg.ticket}</span></span>
                )}
              </div>
            </div>
          </div>

          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed border-t pt-4">
            {msg.message}
          </div>

          {/* Lampiran pelapor */}
          {evidence.length > 0 && (
            <div className="border-t pt-4 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" /> Bukti dari pelapor ({evidence.length})
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {evidence.map((att) => (
                  <a key={att.id} href={att.filePath} target="_blank" rel="noopener noreferrer" className="group block rounded-lg border overflow-hidden hover:bg-muted transition-colors">
                    {att.fileKind === "video" ? (
                      <div className="aspect-video flex items-center justify-center"><FileVideo className="h-8 w-8 text-purple-500" /></div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={att.filePath} alt={att.originalName} className="aspect-video w-full object-cover" loading="lazy" />
                    )}
                    <p className="p-1.5 text-[11px] truncate text-muted-foreground">{att.originalName} · {formatBytes(att.fileSize)}</p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Riwayat balasan (tampilan percakapan) */}
      {replies.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
              <MessageSquareText className="h-3.5 w-3.5" /> Riwayat balasan ({replies.length})
            </p>
            {replies.map((r) => (
              <div key={r.id} className="rounded-xl border bg-muted/40 dark:bg-zinc-800/50 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold">Tim Sekolah <span className="text-xs text-muted-foreground font-normal">({r.authorName})</span></span>
                  <span className="text-xs text-muted-foreground">{r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{r.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Form balasan */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <p className="text-sm font-medium">Balas / Catat Tindak Lanjut</p>
          <p className="text-xs text-muted-foreground">
            Balasan tampil di halaman cek status pelapor sebagai "Tim Sekolah". Contoh: "Saran yang kamu masukan akan diteruskan kepada pejabat yang terkait."
          </p>
          <Textarea
            rows={4}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Tulis pesan balasan untuk pelapor…"
            maxLength={2000}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{replyText.length}/2000</span>
            <Button onClick={sendReply} disabled={sendingReply || replyText.trim().length < 2}>
              {sendingReply ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Kirim Balasan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bukti tindak lanjut */}
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Bukti Tindak Lanjut ({resolutions.length})
            </p>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Upload className="mr-2 h-3 w-3" />}
              Unggah Bukti
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Gambar ≤25MB, video ≤50MB. Pelapor hanya melihat jumlahnya, bukan isinya.</p>
          {resolutions.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {resolutions.map((att) => (
                <a key={att.id} href={att.filePath} target="_blank" rel="noopener noreferrer" className="group block rounded-lg border overflow-hidden hover:bg-muted transition-colors">
                  {att.fileKind === "video" ? (
                    <div className="aspect-video flex items-center justify-center"><FileVideo className="h-8 w-8 text-purple-500" /></div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={att.filePath} alt={att.originalName} className="aspect-video w-full object-cover" loading="lazy" />
                  )}
                  <p className="p-1.5 text-[11px] truncate text-muted-foreground">{att.originalName} · {formatBytes(att.fileSize)}</p>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
