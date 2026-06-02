/**
 * SPMB Priority Logic
 *
 * Prioritas Penerimaan Peserta Didik:
 * 1. Radius efektif sekolah menjadi gerbang utama prioritas
 * 2. Skor seleksi memakai bobot seimbang: usia 50% + jarak 50%
 * 3. Jika skor sama, urutan dibedakan dari usia, jarak, lalu waktu daftar
 */

import type { SPMBRegistrant } from "@/types";

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
  /** Balanced 0-100 score: 50% age + 50% distance */
  selectionScore: number;
  ageScore: number;
  distanceScore: number;
  isWithinEffectiveRadius: boolean;
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

export interface SPMBScoreInput {
  birthDate?: string | Date | null;
  distanceKm?: number | null;
  maxDistanceKm: number;
  referenceDate?: Date;
}

export interface SPMBScoreResult {
  totalScore: number;
  ageScore: number;
  distanceScore: number;
  ageMonths: number;
  isWithinEffectiveRadius: boolean;
}

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculate a balanced SPMB selection score.
 * Radius is the priority gate; age and distance each contribute up to 50 points.
 */
export function calculateSPMBSelectionScore({
  birthDate,
  distanceKm,
  maxDistanceKm,
  referenceDate = getAgeReferenceDate(),
}: SPMBScoreInput): SPMBScoreResult {
  const safeMaxDistance = maxDistanceKm > 0 ? maxDistanceKm : 1;
  const safeDistance = typeof distanceKm === "number" && Number.isFinite(distanceKm)
    ? Math.max(distanceKm, 0)
    : Number.POSITIVE_INFINITY;
  const isWithinEffectiveRadius = safeDistance <= safeMaxDistance;

  let ageMonths = 0;
  if (birthDate) {
    ageMonths = calculateAge(birthDate, referenceDate).totalMonths;
  }

  // 5 years old starts at 0, 7 years and above receives full age score.
  const ageRatio = clamp((ageMonths - 60) / 24, 0, 1);
  const ageScore = ageRatio * 50;

  // Within the effective radius, closer homes receive stronger distance score.
  const distanceRatio = isWithinEffectiveRadius
    ? clamp(1 - safeDistance / safeMaxDistance, 0, 1)
    : 0;
  const distanceScore = distanceRatio * 50;

  return {
    totalScore: roundScore(ageScore + distanceScore),
    ageScore: roundScore(ageScore),
    distanceScore: roundScore(distanceScore),
    ageMonths,
    isWithinEffectiveRadius,
  };
}

// ==========================================
// Comparison & Sorting Functions
// ==========================================

/**
 * Compare two registrants by priority rules
 * Returns negative if A has higher priority, positive if B has higher priority
 * 
 * Priority order:
 * 1. Within effective radius
 * 2. Balanced score: age 50% + distance 50%
 * 3. Older age when score is tied
 * 4. Closer distance when age is tied
 * 5. Earlier registration when distance is tied
 */
export function compareRegistrants(
  a: SPMBRegistrant,
  b: SPMBRegistrant,
  referenceDate: Date = new Date(),
  maxDistanceKm = 3
): number {
  const scoreA = calculateSPMBSelectionScore({
    birthDate: a.birth_date,
    distanceKm: a.distance_to_school,
    maxDistanceKm,
    referenceDate,
  });
  const scoreB = calculateSPMBSelectionScore({
    birthDate: b.birth_date,
    distanceKm: b.distance_to_school,
    maxDistanceKm,
    referenceDate,
  });

  // Radius is the main gate: in-radius candidates always rank above out-radius.
  if (scoreA.isWithinEffectiveRadius !== scoreB.isWithinEffectiveRadius) {
    return scoreA.isWithinEffectiveRadius ? -1 : 1;
  }

  if (scoreA.totalScore !== scoreB.totalScore) {
    return scoreB.totalScore - scoreA.totalScore;
  }

  const ageA = getAgePriorityGroup(a.birth_date || "", referenceDate);
  const ageB = getAgePriorityGroup(b.birth_date || "", referenceDate);
  if (ageA.totalMonths !== ageB.totalMonths) {
    return ageB.totalMonths - ageA.totalMonths;
  }

  // Same score and age: compare by distance (closer = higher priority)
  const distanceA = a.distance_to_school ?? Infinity;
  const distanceB = b.distance_to_school ?? Infinity;
  
  // Round to 2 decimal places for comparison
  const roundedDistA = Math.round(distanceA * 100) / 100;
  const roundedDistB = Math.round(distanceB * 100) / 100;

  if (roundedDistA !== roundedDistB) {
    return roundedDistA - roundedDistB;
  }

  // Same distance: Compare by registration time (earlier = higher priority)
  // created is Date in Drizzle
  const timeA = a.created ? new Date(a.created).getTime() : 0;
  const timeB = b.created ? new Date(b.created).getTime() : 0;
  
  return timeA - timeB;
}

/**
 * Rank all registrants by priority
 * Returns sorted array with rank numbers assigned
 */
export function rankRegistrants(
  registrants: SPMBRegistrant[],
  referenceDate: Date = new Date(),
  maxDistanceKm = 3
): RankedRegistrant[] {
  // Create array with age priority calculated
  const withPriority = registrants.map((reg) => {
    const score = calculateSPMBSelectionScore({
      birthDate: reg.birth_date,
      distanceKm: reg.distance_to_school,
      maxDistanceKm,
      referenceDate,
    });

    return {
      ...reg,
      agePriority: getAgePriorityGroup(reg.birth_date || "", referenceDate),
      priorityRank: 0,
      selectionScore: score.totalScore,
      ageScore: score.ageScore,
      distanceScore: score.distanceScore,
      isWithinEffectiveRadius: score.isWithinEffectiveRadius,
      recommendation: "pending" as const,
    };
  });

  // Sort by priority rules
  withPriority.sort((a, b) => compareRegistrants(a, b, referenceDate, maxDistanceKm));

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
  referenceDate: Date = new Date(),
  maxDistanceKm = 3
): ProcessingResult {
  const ranked = rankRegistrants(registrants, referenceDate, maxDistanceKm);
  
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
