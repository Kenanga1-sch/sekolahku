import type { SPMBAgeEligibility } from "@/lib/spmb-priority";

export interface GlobalSettings {
  spmb_is_open?: boolean;
  max_distance_km?: number;
  [key: string]: unknown;
}

export interface SPMBRegistrantsResponse {
  success?: boolean;
  items?: Registrant[];
  total?: number;
  totalPages?: number;
}

export interface SPMBStatsResponse {
  success?: boolean;
  data?: {
    total?: number;
    pending?: number;
    verified?: number;
    accepted?: number;
    rejected?: number;
  };
  total?: number;
  pending?: number;
  verified?: number;
  accepted?: number;
  rejected?: number;
}

export interface Registrant {
    id: string;
    registrationNumber: string;
    fullName: string;
    gender: "L" | "P";
    distanceToSchool: number;
    isInZone: boolean;
    createdAt: string;
    birthDate: string;
    status: string;
    priorityScore?: number;
    ageEligibility?: SPMBAgeEligibility;
    needsSpecialRecommendation?: boolean;
    isAgeEligible?: boolean;
    isWithinReceptionArea?: boolean;
}

export interface SPMBStats {
  total: number;
  pending: number;
  verified: number;
  accepted: number;
  rejected: number;
}

export interface Period {
  id: string;
  name: string;
  academicYear?: string;
  committeeName?: string;
  startDate: string;
  endDate: string;
  status?: string;
  quota: number;
  isActive: boolean;
  registered: number;
}

export function normalizePeriod(item: Record<string, unknown>): Period {
  return {
    id: String(item.id ?? ""),
    name: String(item.name ?? ""),
    academicYear: item.academicYear ? String(item.academicYear) : item.academic_year ? String(item.academic_year) : undefined,
    committeeName: item.committeeName ? String(item.committeeName) : item.committee_name ? String(item.committee_name) : undefined,
    startDate: String(item.startDate ?? ""),
    endDate: String(item.endDate ?? ""),
    status: item.status ? String(item.status) : undefined,
    quota: Number(item.quota ?? 0),
    isActive: Boolean(item.isActive ?? item.is_active ?? item.status === "active"),
    registered: Number(item.registered ?? 0),
  };
}

export function getAgePriorityLabel(ageEligibility?: SPMBAgeEligibility) {
  switch (ageEligibility) {
    case "priority_7_plus":
      return "Prioritas 7+";
    case "eligible_6_plus":
      return "Memenuhi";
    case "conditional_5_6":
      return "Butuh Rekomendasi";
    case "ineligible":
      return "Belum Memenuhi";
    default:
      return "-";
  }
}

export function getAgePriorityClass(ageEligibility?: SPMBAgeEligibility) {
  switch (ageEligibility) {
    case "priority_7_plus":
      return "bg-green-100 text-green-800 border-green-200 hover:bg-green-100 dark:bg-green-950 dark:text-green-100 dark:border-green-800";
    case "eligible_6_plus":
      return "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-100 dark:border-green-800";
    case "conditional_5_6":
      return "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-800";
    case "ineligible":
      return "bg-red-100 text-red-800 border-red-200 hover:bg-red-100 dark:bg-red-950 dark:text-red-100 dark:border-red-800";
    default:
      return "";
  }
}
