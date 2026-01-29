import { db } from "@/db";
import { adminNotifications, NewAdminNotification, notificationCategoryEnum, notificationTypeEnum, users, UserRole } from "@/db";
import { eq, inArray } from "drizzle-orm";

type NotificationType = typeof notificationTypeEnum[number];
type NotificationCategory = typeof notificationCategoryEnum[number];

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  category?: NotificationCategory;
  targetUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a specific user
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    const notification: NewAdminNotification = {
      userId: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      category: params.category || "system",
      targetUrl: params.targetUrl,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      isRead: false,
    };

    await db.insert(adminNotifications).values(notification);
    return true;
  } catch (error) {
    console.error("Failed to create notification:", error);
    return false;
  }
}

/**
 * Broadcast notification to all users with specific roles
 */
export async function broadcastNotification(
  roles: UserRole[],
  params: Omit<CreateNotificationParams, "userId">
) {
  try {
    // Find all users with the matching roles
    const recipients = await db.query.users.findMany({
      where: inArray(users.role, roles),
      columns: {
        id: true,
      },
    });

    if (recipients.length === 0) return 0;

    const notifications: NewAdminNotification[] = recipients.map((user) => ({
      userId: user.id,
      title: params.title,
      message: params.message,
      type: params.type || "info",
      category: params.category || "system",
      targetUrl: params.targetUrl,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      isRead: false,
    }));

    await db.insert(adminNotifications).values(notifications);
    return recipients.length;
  } catch (error) {
    console.error("Failed to broadcast notification:", error);
    return 0;
  }
}

/**
 * Create a system alert for admins (Superadmin & Admin)
 */
export async function createSystemAlert(
  title: string, 
  message: string, 
  url?: string
) {
  return broadcastNotification(["superadmin", "admin"], {
    title,
    message,
    type: "warning",
    category: "system",
    targetUrl: url,
  });
}
