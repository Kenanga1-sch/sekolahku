"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { goGet, goPatch, goPost } from "@/lib/api-client";

interface Notif {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  targetUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export default function ParentNotifikasiPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const data = await goGet<Notif[]>("/api/notifications?limit=50");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Gagal memuat notifikasi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const open = async (n: Notif) => {
    try {
      if (!n.isRead) {
        await goPatch(`/api/notifications/${n.id}/read`);
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      }
      if (n.targetUrl) router.push(n.targetUrl);
    } catch {
      // abaikan
    }
  };

  const markAll = async () => {
    try {
      await goPost("/api/notifications/read-all");
      setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
      toast.success("Semua ditandai sudah dibaca");
    } catch {
      toast.error("Gagal memproses");
    }
  };

  const icon = (t: string) => {
    if (t === "warning") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    if (t === "error") return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (t === "success") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    return <Info className="h-5 w-5 text-blue-600" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Notifikasi</h1>
          <p className="text-sm text-muted-foreground">Pemberitahuan kegiatan anak Anda.</p>
        </div>
        {items.some((x) => !x.isRead) && (
          <Button variant="outline" size="sm" onClick={markAll}>Tandai semua</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-3">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-muted-foreground" /></div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Belum ada notifikasi</p>
            </div>
          ) : (
            <div className="divide-y">
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={cn(
                    "w-full text-left flex gap-3 py-3 px-1 rounded-lg transition-colors hover:bg-muted/50",
                    !n.isRead && "bg-muted/30",
                  )}
                >
                  <div className="mt-0.5 shrink-0">{icon(n.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm", !n.isRead ? "font-semibold" : "font-medium")}>{n.title}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
