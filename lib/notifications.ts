/**
 * notifications — Client-side data fetcher for Admin Notifications
 */

import { goGet, goPost, goPatch } from "@/lib/api-client";

export async function createNotification(data: any) {
  return await goPost("/api/notifications", data);
}

export async function broadcastNotification(data: any) {
  return await goPost("/api/notifications/broadcast", data);
}

export async function getNotifications(limit = 20) {
  return await goGet(`/api/notifications?limit=${limit}`);
}

export async function getNotificationStats() {
  return await goGet("/api/notifications/stats");
}

export async function markNotificationAsRead(id: string) {
  return await goPatch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsAsRead() {
  return await goPost("/api/notifications/read-all", {});
}

export async function createSystemAlert(message: string, type: "info" | "warning" | "error" = "info") {
  return await broadcastNotification({
    title: "Sistem",
    message,
    type,
    category: "SYSTEM"
  });
}
