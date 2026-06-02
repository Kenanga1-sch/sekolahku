/**
 * Contact Actions
 * Optimized with goFetch and handleAction.
 */

import { goGet, goPut, goDelete, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

export async function getContactMessagesAction() {
  return handleAction(goGet("/api/contact-messages", { ttl: CacheTTL.SHORT }));
}

export async function markMessageAsReadAction(id: string) {
  return handleAction(
    goPut(`/api/contact-messages/${id}/read`),
    "Pesan ditandai sebagai sudah dibaca"
  );
}

export async function deleteMessageAction(id: string) {
  return handleAction(
    goDelete(`/api/contact-messages/${id}`),
    "Pesan berhasil dihapus"
  );
}
