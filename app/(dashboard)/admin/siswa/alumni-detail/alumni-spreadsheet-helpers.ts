// Helper & tipe spreadsheet transkrip alumni (diekstrak dari use-alumni-detail.ts).
// Refactor — zero behavior change.

export interface ColumnDef {
  key: string;
  label: string;
  isCustom?: boolean;
}

export interface SavedTemplate {
  id: string;
  name: string;
  columns: ColumnDef[];
  subjects: Record<string, any>[];
}

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: "subjectName", label: "Mata Pelajaran" },
  { key: "subjectCode", label: "Kode MP" },
  { key: "score", label: "Nilai Angka" },
  { key: "scoreLetter", label: "Nilai Huruf" },
  { key: "notes", label: "Catatan" },
];

export function scoreToLetter(score: number): string {
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "E";
}

export function getAcademicYearOptions(enrolledYear?: string): string[] {
  const options: string[] = [];
  const baseYear = enrolledYear ? parseInt(enrolledYear) : 2018;
  const currentYear = new Date().getFullYear();
  const startYear = Math.min(baseYear - 1, currentYear - 8);
  const endYear = Math.max(baseYear + 8, currentYear + 2);

  for (let y = startYear; y <= endYear; y++) {
    options.push(`${y}/${y + 1}`);
  }
  return options.reverse();
}
