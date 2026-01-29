"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AdminNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  category: string;
  targetUrl?: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      // Fetch more for the full page
      const res = await fetch("/api/notifications?limit=50");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      toast.error("Gagal memuat notifikasi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string, url?: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );

      if (url) {
        router.push(url);
      }
    } catch (error) {
      toast.error("Gagal menandai notifikasi sebagai dibaca");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success("Semua notifikasi ditandai sudah dibaca");
    } catch (error) {
      toast.error("Gagal memproses permintaan");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "warning":
        return "bg-amber-100 dark:bg-amber-900/30";
      case "error":
        return "bg-red-100 dark:bg-red-900/30";
      case "success":
        return "bg-green-100 dark:bg-green-900/30";
      default:
        return "bg-blue-100 dark:bg-blue-900/30";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifikasi</h2>
          <p className="text-muted-foreground">
            Riwayat notifikasi dan aktivitas sistem.
          </p>
        </div>
        <Button onClick={handleMarkAllAsRead} variant="outline">
          Tandai Semua Dibaca
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Semua Notifikasi</CardTitle>
          <CardDescription>
            Menampilkan 50 notifikasi terakhir Anda.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex flex-col sm:flex-row gap-4 p-4 rounded-lg border transition-all cursor-pointer",
                    notification.isRead 
                      ? "bg-card hover:bg-muted/50" 
                      : "bg-muted/30 border-l-4 border-l-blue-500 hover:bg-muted/60"
                  )}
                  onClick={() => handleMarkAsRead(notification.id, notification.targetUrl)}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={cn("p-2 rounded-full mt-1", getBgColor(notification.type))}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className={cn("font-medium", !notification.isRead && "text-blue-700 dark:text-blue-400 font-bold")}>
                          {notification.title}
                        </h4>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {new Date(notification.createdAt).toLocaleDateString("id-ID", {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent capitalize">
                          {notification.category}
                        </span>
                        {notification.targetUrl && (
                          <span className="text-xs text-blue-600 hover:underline">
                            Lihat Detail →
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-4 opacity-20" />
              <p>Tidak ada notifikasi ditemukan</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
