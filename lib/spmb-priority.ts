/**
 * SPMB Priority Logic
 * 
 * Prioritas Penerimaan Peserta Didik:
 * 1. Usia (Tertua → Termuda): 7-12 tahun > 6 tahun > <6 tahun
 * 2. Jarak (Terdekat → Terjauh): Hanya jika tahun + bulan lahir sama
 * 3. Waktu Pendaftaran (Lebih Awal): Hanya jika usia dan jarak sama persis
 */

import type { SPMBRegistrant } from "@/db/schema/spmb";

// ==========================================
// Types
// ==========================================

export interface AgePriority {
  /** Priority group: 1 = 7-12yo (highest), 2 = 6yo, 3 = <6yo (lowest) */
  group: 1 | 2 | 3;
  /** Age in years */
  years: number;
  /** Age in months (0-11) */
  months: number;
  /** Age in days (0-30) */
  days: number;
  /** Total age in months (for comparison) */
  totalMonths: number;
}

export interface RankedRegistrant extends SPMBRegistrant {
  /** Priority rank position (1 = highest) */
  priorityRank: number;
  /** Age priority details */
  agePriority: AgePriority;
  /** Acceptance recommendation based on quota */
  recommendation: "accepted" | "rejected" | "waitlist";
}

export interface ProcessingResult {
  success: boolean;
  totalProcessed: number;
  accepted: number;
  rejected: number;
  waitlist: number;
  rankings: RankedRegistrant[];
}

// ==========================================
// Date of Reference for Age Calculation
// ==========================================

/**
 * Get the reference date for age calculation.
 * Using July 1st of the current academic year as the cutoff date.
 * For academic year 2024/2025, the reference date is July 1, 2024.
 */
export function getAgeReferenceDate(academicYear?: string): Date {
  const year = academicYear 
    ? parseInt(academicYear.split("/")[0]) 
    : new Date().getFullYear();
  
  // July 1st of the academic year start
  return new Date(year, 6, 1); // Month is 0-indexed, so 6 = July
}

// ==========================================
// Age Calculation Functions
// ==========================================

/**
 * Calculate detailed age from birth date
 */
export function calculateAge(
  birthDate: string | Date,
  referenceDate: Date = new Date()
): { years: number; months: number; days: number; totalMonths: number } {
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  
  let years = referenceDate.getFullYear() - birth.getFullYear();
  let months = referenceDate.getMonth() - birth.getMonth();
  let days = referenceDate.getDate() - birth.getDate();

  // Adjust for negative days
  if (days < 0) {
    months--;
    const prevMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);
    days += prevMonth.getDate();
  }

  // Adjust for negative months
  if (months < 0) {
    years--;
    months += 12;
  }

  const totalMonths = years * 12 + months;

  return { years, months, days, totalMonths };
}

/**
 * Get age priority group based on birth date
 * 
 * Group 1: Age 7-12 years (HIGHEST PRIORITY - wajib didahulukan)
 * Group 2: Age 6 years
 * Group 3: Age < 6 years (LOWEST PRIORITY - urutan paling bawah)
 */
export function getAgePriorityGroup(
  birthDate: string | Date,
  referenceDate: Date = new Date()
): AgePriority {
  const age = calculateAge(birthDate, referenceDate);
  
  let group: 1 | 2 | 3;
  
  if (age.years >= 7 && age.years <= 12) {
    // Age 7-12: Highest priority
    group = 1;
  } else if (age.years === 6) {
    // Age 6: Medium priority
    group = 2;
  } else {
    // Age < 6 or > 12: Lowest priority
    group = 3;
  }

  return {
    group,
    years: age.years,
    months: age.months,
    days: age.days,
    totalMonths: age.totalMonths,
  };
}

/**
 * Check if two registrants have the same birth year and month
 */
export function hasSameBirthYearMonth(
  birthDateA: string | Date,
  birthDateB: string | Date
): boolean {
  const dateA = typeof birthDateA === "string" ? new Date(birthDateA) : birthDateA;
  const dateB = typeof birthDateB === "string" ? new Date(birthDateB) : birthDateB;
  
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth()
  );
}

// ==========================================
// Comparison & Sorting Functions
// ==========================================

/**
 * Compare two registrants by priority rules
 * Returns negative if A has higher priority, positive if B has higher priority
 * 
 * Priority order:
 * 1. Age group (1 > 2 > 3)
 * 2. Within same group: Older (more totalMonths) = higher priority
 * 3. If same birth year+month: Closer distance = higher priority
 * 4. If same distance: Earlier registration = higher priority
 */
export function compareRegistrants(
  a: SPMBRegistrant,
  b: SPMBRegistrant,
  referenceDate: Date = new Date()
): number {
  const ageA = getAgePriorityGroup(a.birthDate, referenceDate);
  const ageB = getAgePriorityGroup(b.birthDate, referenceDate);

  // 1. Compare by priority group (lower group number = higher priority)
  if (ageA.group !== ageB.group) {
    return ageA.group - ageB.group;
  }

  // 2. Within same group, compare by age (older = higher priority = more totalMonths)
  // Check if they have the same birth year and month
  const sameBirthYearMonth = hasSameBirthYearMonth(
    a.birthDate,
    b.birthDate
  );

  if (!sameBirthYearMonth) {
    // Different birth year/month: older (more months) = higher priority
    return ageB.totalMonths - ageA.totalMonths;
  }

  // 3. Same birth year+month: Compare by distance (closer = higher priority)
  const distanceA = a.distanceToSchool ?? Infinity;
  const distanceB = b.distanceToSchool ?? Infinity;
  
  // Round to 2 decimal places for comparison
  const roundedDistA = Math.round(distanceA * 100) / 100;
  const roundedDistB = Math.round(distanceB * 100) / 100;

  if (roundedDistA !== roundedDistB) {
    return roundedDistA - roundedDistB;
  }

  // 4. Same distance: Compare by registration time (earlier = higher priority)
  // createdAt is Date in Drizzle
  const timeA = a.createdAt ? a.createdAt.getTime() : 0; 
  const timeB = b.createdAt ? b.createdAt.getTime() : 0;
  
  return timeA - timeB;
}

/**
 * Rank all registrants by priority
 * Returns sorted array with rank numbers assigned
 */
export function rankRegistrants(
  registrants: SPMBRegistrant[],
  referenceDate: Date = new Date()
): RankedRegistrant[] {
  // Create array with age priority calculated
  const withPriority = registrants.map((reg) => ({
    ...reg,
    agePriority: getAgePriorityGroup(reg.birthDate, referenceDate),
    priorityRank: 0,
    recommendation: "pending" as const,
  }));

  // Sort by priority rules
  withPriority.sort((a, b) => compareRegistrants(a, b, referenceDate));

  // Assign rank numbers
  const ranked: RankedRegistrant[] = withPriority.map((reg, index) => ({
    ...reg,
    priorityRank: index + 1,
    recommendation: "pending" as "accepted" | "rejected" | "waitlist",
  }));

  return ranked;
}

/**
 * Process acceptance based on quota
 * Marks registrants as accepted, rejected, or waitlist
 */
export function processAcceptance(
  registrants: SPMBRegistrant[],
  quota: number,
  referenceDate: Date = new Date()
): ProcessingResult {
  const ranked = rankRegistrants(registrants, referenceDate);
  
  let accepted = 0;
  let rejected = 0;
  let waitlist = 0;

  const processed = ranked.map((reg) => {
    if (reg.priorityRank <= quota) {
      // Within quota - accepted
      reg.recommendation = "accepted";
      accepted++;
    } else if (reg.agePriority.group === 3) {
      // Under 6 years old and over quota - rejected
      reg.recommendation = "rejected";
      rejected++;
    } else {
      // Over quota but eligible age - waitlist
      reg.recommendation = "waitlist";
      waitlist++;
    }
    return reg;
  });

  return {
    success: true,
    totalProcessed: processed.length,
    accepted,
    rejected,
    waitlist,
    rankings: processed,
  };
}

// ==========================================
// Formatting Helpers
// ==========================================

/**
 * Format age for display
 */
export function formatAge(agePriority: AgePriority): string {
  const { years, months } = agePriority;
  
  if (years === 0) {
    return `${months} bulan`;
  }
  
  if (months === 0) {
    return `${years} tahun`;
  }
  
  return `${years} tahun ${months} bulan`;
}

/**
 * Get priority group label
 */
export function getPriorityGroupLabel(group: 1 | 2 | 3): string {
  switch (group) {
    case 1:
      return "Prioritas Utama (7-12 tahun)";
    case 2:
      return "Prioritas Kedua (6 tahun)";
    case 3:
      return "Prioritas Terendah (<6 tahun)";
    default:
      return "Unknown";
  }
}

/**
 * Get priority group badge color
 */
export function getPriorityGroupColor(group: 1 | 2 | 3): string {
  switch (group) {
    case 1:
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    case 2:
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case 3:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
