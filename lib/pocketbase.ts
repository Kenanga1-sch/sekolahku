import PocketBase from "pocketbase";
import type {
  User,
  Profile,
  SchoolSettings,
  SPMBPeriod,
  SPMBRegistrant,
  Announcement,
} from "@/types";

// ==========================================
// PocketBase Client Singleton
// ==========================================

let pbInstance: PocketBase | null = null;

/**
 * Get or create PocketBase client instance
 * Uses singleton pattern to avoid multiple instances
 */
export function getPocketBase(): PocketBase {
  if (pbInstance) {
    return pbInstance;
  }

  // Use internal URL for server-side, public URL for client-side
  // Default to 8092 which is the Docker-exposed port
  const pbUrl = typeof window === "undefined"
    ? (process.env.POCKETBASE_URL || "http://127.0.0.1:8092")
    : (process.env.NEXT_PUBLIC_POCKETBASE_URL || "http://127.0.0.1:8092");

  if (typeof window !== "undefined") {
    console.log("[PocketBase] Client URL:", pbUrl);
  }

  pbInstance = new PocketBase(pbUrl);

  // Auto-refresh auth on expiry
  pbInstance.autoCancellation(false);

  return pbInstance;
}

// Export singleton instance for convenience
export const pb = getPocketBase();

// ==========================================
// Type-Safe Collection Helpers
// ==========================================

export const collections = {
  users: () => pb.collection("users"),
  profiles: () => pb.collection("profiles"),
  schoolSettings: () => pb.collection("school_settings"),
  spmbPeriods: () => pb.collection("spmb_periods"),
  spmbRegistrants: () => pb.collection("spmb_registrants"),
  announcements: () => pb.collection("announcements"),
} as const;

// ==========================================
// Auth Helpers
// ==========================================

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return pb.authStore.isValid;
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): User | null {
  if (!pb.authStore.isValid) return null;
  return pb.authStore.record as User | null;
}

/**
 * Login with email/username and password
 */
export async function login(
  identity: string,
  password: string
): Promise<User> {
  const authData = await collections.users().authWithPassword(identity, password);
  // PocketBase authStore.onChange will trigger auth state sync
  return authData.record as User;
}

/**
 * Logout current user
 */
export function logout(): void {
  pb.authStore.clear();
  // Clear any stored cookies if needed
  if (typeof document !== 'undefined') {
    document.cookie = 'pb_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

/**
 * Register new user
 */
export async function register(data: {
  email: string;
  password: string;
  passwordConfirm: string;
  username?: string;
  name?: string;
  phone?: string;
  role?: string;
}): Promise<User> {
  const user = await collections.users().create({
    ...data,
    role: data.role || "calon_siswa",
    emailVisibility: true,
  });
  return user as User;
}

// ==========================================
// School Settings Helpers
// ==========================================

/**
 * Get school settings (single record)
 */
export async function getSchoolSettings(): Promise<SchoolSettings | null> {
  try {
    const records = await collections.schoolSettings().getFullList<SchoolSettings>({
      sort: "-created",
    });
    return records[0] || null;
  } catch {
    return null;
  }
}

// ==========================================
// SPMB Helpers
// ==========================================

/**
 * Get active SPMB period
 */
export async function getActiveSPMBPeriod(): Promise<SPMBPeriod | null> {
  try {
    const record = await collections.spmbPeriods().getFirstListItem<SPMBPeriod>(
      "is_active = true"
    );
    return record;
  } catch {
    return null;
  }
}

/**
 * Create new SPMB registration
 */
export async function createRegistration(
  data: Partial<SPMBRegistrant>
): Promise<SPMBRegistrant> {
  const record = await collections.spmbRegistrants().create<SPMBRegistrant>(data);
  return record;
}

/**
 * Get registration by registration number
 */
export async function getRegistrationByNumber(
  registrationNumber: string
): Promise<SPMBRegistrant | null> {
  try {
    const record = await collections.spmbRegistrants().getFirstListItem<SPMBRegistrant>(
      `registration_number = "${registrationNumber}"`
    );
    return record;
  } catch {
    return null;
  }
}

/**
 * Generate registration number
 * Format: SPMB-YEAR-XXXX (e.g., SPMB-2024-0001)
 */
export async function generateRegistrationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SPMB-${year}-`;

  try {
    const records = await collections.spmbRegistrants().getList<SPMBRegistrant>(1, 1, {
      filter: `registration_number ~ "${prefix}"`,
      sort: "-registration_number",
    });

    if (records.items.length === 0) {
      return `${prefix}0001`;
    }

    const lastNumber = records.items[0].registration_number;
    const sequence = parseInt(lastNumber.split("-").pop() || "0", 10);
    const nextSequence = (sequence + 1).toString().padStart(4, "0");

    return `${prefix}${nextSequence}`;
  } catch {
    return `${prefix}0001`;
  }
}

// ==========================================
// Announcements Helpers
// ==========================================

/**
 * Get published announcements
 */
export async function getPublishedAnnouncements(
  limit = 10,
  category?: string
): Promise<Announcement[]> {
  try {
    let filter = "is_published = true";
    if (category) {
      filter += ` && category = "${category}"`;
    }

    const records = await collections.announcements().getList<Announcement>(1, limit, {
      filter,
      sort: "-published_at",
    });

    return records.items;
  } catch {
    return [];
  }
}

/**
 * Get announcement by slug
 */
export async function getAnnouncementBySlug(
  slug: string
): Promise<Announcement | null> {
  try {
    const record = await collections.announcements().getFirstListItem<Announcement>(
      `slug = "${slug}"`
    );
    return record;
  } catch {
    return null;
  }
}

// ==========================================
// File URL Helper
// ==========================================

/**
 * Get file URL from PocketBase
 */
export function getFileUrl(
  record: { id: string; collectionId: string; collectionName: string },
  filename: string,
  thumb?: string
): string {
  return pb.files.getURL(record, filename, { thumb });
}
