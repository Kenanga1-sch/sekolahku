/**
 * Contact Actions
 * Fetches contact messages from the Go backend.
 */

export async function getContactMessagesAction() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || "http://localhost:8080"}/api/contact/messages`);
    if (!res.ok) throw new Error("Failed to fetch messages");
    return await res.json();
  } catch (error) {
    console.error("getContactMessagesAction error:", error);
    return [];
  }
}

export async function markMessageAsReadAction(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || "http://localhost:8080"}/api/admin/contact/messages/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) throw new Error("Failed to mark as read");
    return { success: true };
  } catch (error) {
    console.error("markMessageAsReadAction error:", error);
    return { success: false };
  }
}

export async function deleteMessageAction(id: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_GO_API_URL || "http://localhost:8080"}/api/admin/contact/messages/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete message");
    return { success: true };
  } catch (error) {
    console.error("deleteMessageAction error:", error);
    return { success: false };
  }
}
