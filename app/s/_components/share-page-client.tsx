"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Cloud,
  Download,
  FileText,
  File as FileIcon,
  Folder,
  Image as ImageIcon,
  Loader2,
  Music,
  ShieldAlert,
  Video,
  Archive,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  fetchSharedInfo,
  sharedDownloadUrl,
  sharedFileUrl,
  sharedZipUrl,
  formatBytes,
  type SharedInfo,
} from "@/lib/cloudstorage/api";
import { cn } from "@/lib/utils";

type State =
  | { kind: "loading" }
  | { kind: "ready"; info: SharedInfo; token: string }
  | { kind: "error"; message: string };

/** Ikon berdasarkan nama/mime untuk entri di dalam folder share. */
function EntryIcon({ name, mime, isFolder }: { name: string; mime: string; isFolder: boolean }) {
  const cls = "h-5 w-5 shrink-0";
  if (isFolder) return <Folder className={cn(cls, "text-emerald-600")} />;
  const m = mime || "";
  if (m.startsWith("image/")) return <ImageIcon className={cn(cls, "text-sky-600")} />;
  if (m.startsWith("video/")) return <Video className={cn(cls, "text-violet-600")} />;
  if (m.startsWith("audio/")) return <Music className={cn(cls, "text-pink-600")} />;
  if (m === "application/pdf" || /\.pdf$/i.test(name)) return <FileText className={cn(cls, "text-rose-600")} />;
  if (m.startsWith("text/")) return <FileText className={cn(cls, "text-amber-600")} />;
  return <FileIcon className={cn(cls, "text-neutral-500")} />;
}

export function SharePageClient() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    if (!token) {
      setState({ kind: "error", message: "Tautan tidak lengkap (token tidak ditemukan)." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const info = await fetchSharedInfo(token);
      setState({ kind: "ready", info, token });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Tautan tidak valid atau sudah kadaluarsa.";
      setState({ kind: "error", message: msg });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Label masa berlaku. Backend sudah menolak token kadaluarsa, jadi di sini
  // cukup menampilkan tanggal berlakunya (tanpa memanggil fungsi waktu saat
  // render agar komponen tetap murni).
  const expiresLabel = useMemo(() => {
    if (state.kind !== "ready" || !state.info.expires_at) return null;
    const d = new Date(state.info.expires_at * 1000);
    return `Berlaku sampai ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
  }, [state]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="border-b bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Cloud className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Cloud Storage
            </p>
            <p className="truncate text-xs text-neutral-500">Berbagi berkas — UPTD SDN 1 Kenanga</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {state.kind === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-neutral-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Memuat berkas…</p>
          </div>
        )}

        {state.kind === "error" && (
          <Card className="mx-auto max-w-md p-8 text-center">
            <div className="mb-3 flex justify-center">
              <ShieldAlert className="h-12 w-12 text-amber-500" />
            </div>
            <h1 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Tautan Tidak Tersedia
            </h1>
            <p className="text-sm text-neutral-500">{state.message}</p>
          </Card>
        )}

        {state.kind === "ready" && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  {state.info.is_folder ? (
                    <Folder className="h-7 w-7 text-emerald-600" />
                  ) : (
                    <EntryIcon name={state.info.name} mime={state.info.mime_type} isFolder={false} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {state.info.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-neutral-500">
                    {state.info.is_folder
                      ? `Folder • ${state.info.entries?.length ?? 0} item`
                      : `${state.info.mime_type || "Berkas"} • ${formatBytes(state.info.size)}`}
                  </p>
                  {expiresLabel && <p className="mt-1 text-xs text-neutral-400">{expiresLabel}</p>}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {state.info.is_folder ? (
                  <Button asChild className="gap-2">
                    <a href={sharedZipUrl(state.token)} download>
                      <Archive className="h-4 w-4" /> Unduh Semua (.zip)
                    </a>
                  </Button>
                ) : (
                  <>
                    <Button asChild className="gap-2">
                      <a href={sharedDownloadUrl(state.token)} download>
                        <Download className="h-4 w-4" /> Unduh
                      </a>
                    </Button>
                    {(state.info.mime_type.startsWith("image/") ||
                      state.info.mime_type.startsWith("video/") ||
                      state.info.mime_type.startsWith("audio/") ||
                      state.info.mime_type === "application/pdf") && (
                      <Button variant="outline" asChild>
                        <a href={sharedFileUrl(state.token)} target="_blank" rel="noreferrer">
                          Buka di tab baru
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Pratinjau inline untuk berkas tunggal */}
            {!state.info.is_folder && (
              <Card className="overflow-hidden">
                <div className="flex min-h-[240px] items-center justify-center bg-neutral-100 p-2 dark:bg-neutral-900">
                  {state.info.mime_type.startsWith("image/") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sharedFileUrl(state.token)}
                      alt={state.info.name}
                      className="max-h-[70vh] w-auto object-contain"
                    />
                  )}
                  {state.info.mime_type.startsWith("video/") && (
                    <video src={sharedFileUrl(state.token)} controls className="max-h-[70vh] w-full">
                      Browser Anda tidak mendukung pemutar video.
                    </video>
                  )}
                  {state.info.mime_type.startsWith("audio/") && (
                    <audio src={sharedFileUrl(state.token)} controls className="w-full px-6">
                      Browser Anda tidak mendukung pemutar audio.
                    </audio>
                  )}
                  {state.info.mime_type === "application/pdf" && (
                    <iframe
                      src={sharedFileUrl(state.token)}
                      className="h-[70vh] w-full"
                      title={state.info.name}
                    />
                  )}
                  {!state.info.mime_type.startsWith("image/") &&
                    !state.info.mime_type.startsWith("video/") &&
                    !state.info.mime_type.startsWith("audio/") &&
                    state.info.mime_type !== "application/pdf" && (
                      <div className="flex flex-col items-center gap-2 p-10 text-neutral-400">
                        <FileIcon className="h-12 w-12" />
                        <p className="text-sm">Pratinjau tidak tersedia untuk tipe berkas ini.</p>
                        <p className="text-xs">
                          {state.info.mime_type || "application/octet-stream"} • {formatBytes(state.info.size)}
                        </p>
                      </div>
                    )}
                </div>
              </Card>
            )}

            {/* Isi folder */}
            {state.info.is_folder && (state.info.entries?.length ?? 0) > 0 && (
              <Card className="divide-y dark:divide-neutral-800">
                {state.info.entries!.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-3">
                    <EntryIcon name={e.name} mime={e.mime_type} isFolder={e.is_folder} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200">{e.name}</p>
                      <p className="text-xs text-neutral-400">
                        {e.is_folder ? "Folder" : formatBytes(e.size)}
                      </p>
                    </div>
                    {!e.is_folder && (
                      <Button size="sm" variant="ghost" asChild className="gap-1.5">
                        <a href={sharedFileUrl(state.token, e.id)} download>
                          <Download className="h-4 w-4" /> Unduh
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </Card>
            )}

            {state.info.is_folder && (state.info.entries?.length ?? 0) === 0 && (
              <Card className="py-16 text-center text-neutral-400">
                <Folder className="mx-auto mb-2 h-10 w-10" />
                <p className="text-sm">Folder ini kosong.</p>
              </Card>
            )}
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-xs text-neutral-400">
        Dibagikan melalui Cloud Storage Sekolahku
      </footer>
    </div>
  );
}
