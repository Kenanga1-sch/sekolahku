/**
 * Contact Actions
 * Optimized with goFetch and handleAction.
 */

import { goGet, goPut, goDelete, goPatch, goPost, CacheTTL } from "@/lib/api-client";
import { handleAction } from "@/lib/action-utils";

export async function getContactMessagesAction(category?: string) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return handleAction(goGet(`/api/contact-messages${query}`, { ttl: CacheTTL.SHORT }));
}

export async function updateMessageStatusAction(id: string, status: string) {
  return handleAction(
    goPatch(`/api/contact-messages/${id}/status`, { status }),
    "Status pesan diperbarui"
  );
}

export async function getContactMessageAction(id: string) {
  return handleAction(goGet(`/api/contact-messages/${id}`));
}

export async function addContactReplyAction(id: string, body: string) {
  return handleAction(
    goPost(`/api/contact-messages/${id}/replies`, { body }),
    "Balasan terkirim"
  );
}

export async function getContactAttachmentsAction(id: string) {
  return handleAction(goGet(`/api/contact-messages/${id}/attachments`));
}

export async function addResolutionAttachmentAction(id: string, formData: FormData) {
  return handleAction(goPost(`/api/contact-messages/${id}/attachments`, formData));
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
