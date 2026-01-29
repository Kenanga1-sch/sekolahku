"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, CheckCircle2, Info, AlertTriangle, AlertCircle, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

export function NotificationPopover() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/notifications/stats");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notification stats", error);
    }
  };

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Poll stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, url?: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
      
      // Update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      if (url) {
        setIsOpen(false);
        router.push(url);
      }
    } catch (error) {
      toast.error("Gagal menandai notifikasi sebagai dibaca");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
      
      // Update local state
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success("Semua notifikasi ditandai sudah dibaca");
    } catch (error) {
      toast.error("Gagal memproses permintaan");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full"
          size="icon"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
          <span className="sr-only">Notifikasi</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Notifikasi</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700 hover:bg-transparent"
              onClick={handleMarkAllAsRead}
            >
              Tandai semua dibaca
            </Button>
          )}
        </div>
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length > 0 ? (
            <div className="grid gap-1 p-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md transition-colors cursor-pointer group relative",
                    notification.isRead ? "hover:bg-muted/50" : "bg-muted/30 hover:bg-muted/60"
                  )}
                  onClick={() => handleMarkAsRead(notification.id, notification.targetUrl)}
                >
                  <div className={cn("mt-1 p-2 rounded-full flex-shrink-0", getBgColor(notification.type))}>
                    {getIcon(notification.type)}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm font-medium leading-none truncate", !notification.isRead && "font-bold text-foreground")}>
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center text-xs text-muted-foreground pt-1 capitalize">
                      <span>{notification.category}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(notification.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <CheckCircle2 className="mx-auto h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm">Tidak ada notifikasi baru</p>
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between h-auto py-2 text-xs"
            asChild
          >
            {/* Ideally link to a full notification center page, but for now just a link */}
            <Link href="/admin/notifikasi" onClick={() => setIsOpen(false)}>
              Lihat Semua
              <Check className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
