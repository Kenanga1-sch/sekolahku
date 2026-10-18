"use client";

import { useRef, useState } from "react";
import { useTabParam } from "@/lib/hooks/use-tab-param";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { goPost, goGet } from "@/lib/api-client";
import { Loader2, Send, Ticket, Search, ShieldCheck, Copy, Check, HeartHandshake, Paperclip, X, FileVideo, FileImage } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "kritik", label: "Kritik" },
  { id: "saran", label: "Saran" },
  { id: "pengaduan", label: "Pengaduan" },
  { id: "lainnya", label: "Lainnya" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

const CATEGORY_HINTS: Record<CategoryId, string> = {
  kritik: "Tuliskan hal yang menurut Anda perlu diperbaiki di sekolah.",
  saran: "Tuliskan usulan ide atau perbaikan untuk sekolah.",
  pengaduan:
    "Ceritakan apa yang terjadi, di mana, dan kapan. Sebutkan nama jika berani — boleh kosong untuk tetap anonim. Untuk keadaan darurat (kekerasan fisik serius, kesehatan), hubungi polisi/puskesmas atau layanan darurat terdekat.",
  lainnya: "Tuliskan pesan Anda untuk sekolah.",
};

const MAX_FILES = 3;
const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime"];

const schema = z.object({
  name: z.string().max(100, "Nama maksimal 100 karakter").optional(),
  email: z.string().email("Format email tidak valid").optional().or(z.literal("")),
  phone: z.string().max(20, "Nomor HP maksimal 20 karakter").optional(),
  message: z.string().min(10, "Pesan minimal 10 karakter").max(5000, "Pesan maksimal 5000 karakter"),
});

type SchemaType = z.infer<typeof schema>;

interface PickedFile {
  file: File;
  preview: string;
  isVideo: boolean;
}

interface StatusReply {
  body: string;
  by: string;
  createdAt: string;
}

interface StatusView {
  category: string;
  status: string;
  ticket: string;
  createdAt: string;
  updatedAt: string;
  resolutionCount?: number;
  replies?: StatusReply[];
}

const STATUS_LABEL: Record<string, string> = {
  baru: "Baru diterima",
  diproses: "Sedang diproses",
  selesai: "Selesai ditindaklanjuti",
};

const STATUS_COLOR: Record<string, string> = {
  baru: "bg-blue-100 text-blue-700",
  diproses: "bg-amber-100 text-amber-700",
  selesai: "bg-green-100 text-green-700",
};

export default function KritikSaranPengaduanPage() {
  // Tab aktif tersimpan di URL (?tab=...) agar tetap terbuka setelah refresh.
  const [activeTab, setActiveTab] = useTabParam<"kirim" | "status">("kirim", {
    validTabs: ["kirim", "status"],
  });
  const [category, setCategory] = useState<CategoryId>("saran");
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [files, setFiles] = useState<PickedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [statusTicket, setStatusTicket] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<StatusView | null>(null);
  const [statusError, setStatusError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SchemaType>({
    resolver: zodResolver(schema),
  });

  const clearFiles = () => {
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]);
  };

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    for (const file of picked) {
      if (files.length >= MAX_FILES) {
        toast.error(`Maksimal ${MAX_FILES} lampiran`);
        break;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: tipe tidak diizinkan (gambar JPG/PNG/WebP/GIF atau video MP4/WebM)`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
      if (file.size > max) {
        toast.error(`${file.name}: melebihi ${isVideo ? "50MB" : "25MB"}`);
        continue;
      }
      setFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file), isVideo }]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const onSubmit = async (data: SchemaType) => {
    if (loading) return;
    setLoading(true);
    try {
      let res: { data: { ticket: string } };
      if (files.length > 0) {
        // Bukti lampiran dikirim satu request yang sama dengan pesan —
        // server menyimpan file hanya jika pesan valid (atomic).
        const fd = new FormData();
        fd.append("payload", JSON.stringify({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          subject: CATEGORIES.find((c) => c.id === category)?.label || "",
          message: data.message,
          category,
        }));
        files.forEach((f) => fd.append("files", f.file));
        res = await goPost("/api/public/contact", fd);
      } else {
        res = await goPost("/api/public/contact", {
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          subject: CATEGORIES.find((c) => c.id === category)?.label || "",
          message: data.message,
          category,
        });
      }
      setTicket(res.data?.ticket || null);
      clearFiles();
      reset();
      toast.success("Pesan terkirim. Simpan kode tiket Anda.");
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengirim pesan");
    } finally {
      setLoading(false);
    }
  };

  const copyTicket = async () => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard bisa diblokir — biarkan pengguna salin manual.
    }
  };

  const checkStatus = async () => {
    const code = statusTicket.trim();
    if (statusLoading) return;
    setStatusError("");
    setStatusResult(null);
    if (code.length < 4) {
      setStatusError("Masukkan kode tiket Anda");
      return;
    }
    setStatusLoading(true);
    try {
      const res = await goGet<{ data: StatusView }>(`/api/public/contact/status/${encodeURIComponent(code)}`);
      setStatusResult(res.data);
    } catch (error: any) {
      setStatusError(error?.message || "Kode tiket tidak ditemukan");
    } finally {
      setStatusLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return "-";
    }
  };

  return (
    <div className="container max-w-2xl py-12 px-4">
      <div className="mb-8 text-center space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Kritik, Saran &amp; Pengaduan</h1>
        <p className="text-muted-foreground max-w-[55ch] mx-auto">
          Sampaikan masukan untuk sekolah. Identitas boleh dikosongkan — laporan Anda tetap kami terima.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "kirim" | "status")}>
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="kirim">
            <Send className="mr-2 h-4 w-4" /> Kirim
          </TabsTrigger>
          <TabsTrigger value="status">
            <Ticket className="mr-2 h-4 w-4" /> Cek Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kirim">
          {ticket ? (
            <Card className="border-t-4 border-t-green-600 shadow-xl">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                  <ShieldCheck className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>Pesan Terkirim</CardTitle>
                <CardDescription>
                  {category === "pengaduan"
                    ? "Terima kasih sudah berani melapor. Simpan kode tiket di bawah untuk memantau tindak lanjutnya."
                    : "Terima kasih atas masukan Anda. Simpan kode tiket di bawah untuk memantau tindak lanjutnya."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <button
                  onClick={copyTicket}
                  className="font-mono text-2xl font-bold tracking-[0.3em] px-6 py-3 rounded-xl border-2 border-dashed border-green-300 bg-green-50 hover:bg-green-100 transition-colors"
                  aria-label="Salin kode tiket"
                >
                  {ticket}
                </button>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {copied ? (
                    <><Check className="h-3 w-3" /> Tersalin</>
                  ) : (
                    <><Copy className="h-3 w-3" /> Ketuk kode untuk menyalin</>
                  )}
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button variant="outline" className="w-full" onClick={() => setTicket(null)}>
                  Kirim Pesan Lain
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <HeartHandshake className="h-5 w-5 text-green-600" /> Sampaikan Pesan Anda
                </CardTitle>
                <CardDescription>
                  Nama, email, dan nomor HP opsional. Kosongkan semuanya untuk mengirim secara anonim.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-2">Kategori</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                            category === c.id
                              ? "border-green-600 bg-green-600 text-white"
                              : "border-input bg-background hover:bg-muted",
                          )}
                          aria-pressed={category === c.id}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <p className={cn(
                      "text-xs mt-2 leading-relaxed",
                      category === "pengaduan" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
                    )}>
                      {CATEGORY_HINTS[category]}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="nama" className="text-sm font-medium">Nama (opsional)</label>
                      <Input id="nama" placeholder="Kosongkan untuk anonim" {...register("name")} />
                      {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="hp" className="text-sm font-medium">No. HP (opsional)</label>
                      <Input id="hp" placeholder="Untuk ditindaklanjuti" inputMode="tel" {...register("phone")} />
                      {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-medium">Email (opsional)</label>
                    <Input id="email" type="email" placeholder="nama@contoh.com" {...register("email")} />
                    {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="pesan" className="text-sm font-medium">Pesan</label>
                    <Textarea
                      id="pesan"
                      rows={6}
                      placeholder={CATEGORY_HINTS[category]}
                      {...register("message")}
                    />
                    {errors.message && <p className="text-xs text-red-500">{errors.message.message}</p>}
                  </div>

                  {/* Bukti lampiran: gambar/video, max 3, tervalidasi klien+server */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Paperclip className="h-3.5 w-3.5" /> Bukti (opsional)
                      </label>
                      <span className="text-xs text-muted-foreground">{files.length}/{MAX_FILES} · gambar ≤25MB, video ≤50MB</span>
                    </div>
                    {files.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {files.map((f, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-lg border overflow-hidden bg-muted">
                            {f.isVideo ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                                <FileVideo className="h-8 w-8" />
                                <span className="text-[10px] mt-1 px-1 truncate max-w-full">{f.file.name}</span>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={f.preview} alt={f.file.name} className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            <button
                              type="button"
                              onClick={() => removeFile(idx)}
                              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                              aria-label={`Hapus ${f.file.name}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {files.length < MAX_FILES && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-lg border border-dashed py-3 text-sm text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
                      >
                        <FileImage className="h-4 w-4" />
                        Tambah foto/video bukti
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ALLOWED_TYPES.join(",")}
                      multiple
                      className="hidden"
                      onChange={pickFiles}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Kirim Pesan
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Pesan masuk langsung ke pusat informasi sekolah. Anda akan menerima kode tiket untuk cek status.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="status">
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg">Cek Status Laporan</CardTitle>
              <CardDescription>
                Masukkan kode tiket yang Anda terima saat mengirim pesan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                onSubmit={(e) => { e.preventDefault(); checkStatus(); }}
                className="flex gap-2"
              >
                <Input
                  value={statusTicket}
                  onChange={(e) => setStatusTicket(e.target.value)}
                  placeholder="mis. a3b2cd"
                  className="font-mono"
                  maxLength={12}
                  aria-label="Kode tiket"
                />
                <Button type="submit" disabled={statusLoading}>
                  {statusLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </form>

              {statusError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
                  {statusError}
                </div>
              )}

              {statusResult && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{statusResult.ticket}</span>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", STATUS_COLOR[statusResult.status] || STATUS_COLOR.baru)}>
                      {STATUS_LABEL[statusResult.status] || statusResult.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Kategori</p>
                      <p className="font-medium capitalize">{statusResult.category}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dikirim</p>
                      <p className="font-medium">{formatDate(statusResult.createdAt)}</p>
                    </div>
                  </div>
                  {(statusResult.resolutionCount ?? 0) > 0 && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 px-3 py-2 text-sm text-green-700 dark:text-green-300">
                      Sekolah telah mengunggah {statusResult.resolutionCount} bukti tindak lanjut untuk laporan ini.
                    </div>
                  )}
                  {(statusResult.replies?.length ?? 0) > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Balasan dari sekolah</p>
                      {statusResult.replies!.map((rep, i) => (
                        <div key={i} className="rounded-lg border bg-muted/40 dark:bg-zinc-800/50 p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold">{rep.by}</span>
                            <span className="text-[10px] text-muted-foreground">{formatDate(rep.createdAt)}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{rep.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Terakhir diperbarui {formatDate(statusResult.updatedAt)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
