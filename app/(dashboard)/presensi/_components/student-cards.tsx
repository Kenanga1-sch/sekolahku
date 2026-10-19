"use client";

import { classPct, studentPct, isBelowThreshold, STATUS_LABELS_ID, type DayColumn } from "@/lib/presensi-report";
import type { StudentMatrix, StudentRef } from "./presensi-report-types";

/**
 * Tampilan mobile (<md): satu kartu per siswa — nama/NIS, badge %,
 * grid chip tanggal (hari libur DIBLOK MERAH, status berwarna H/S/I/A),
 * rekap mini H/S/I/A. Menggantikan tabel 31 kolom yang sulit dibaca di
 * layar portrait kecil.
 */
export function StudentCards({
  matrix, columns, effectiveDays, className, monthName, year, onStudentClick,
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  className: string; monthName: string; year: number;
  onStudentClick?: (student: StudentRef) => void;
}) {
  const pctKelas = classPct(matrix, effectiveDays);
  return (
    <div className="md:hidden space-y-2">
      {/* Identitas blok + % kelas (setara header ScreenMatrix) */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-800">Daftar Hadir — {className}</p>
          <p className="text-xs leading-tight text-slate-500">
            {monthName} {year} • {matrix.length} siswa • Hari efektif {effectiveDays} hari
          </p>
        </div>
        <span className={`text-sm font-bold ${pctKelas !== null && pctKelas < 75 ? "text-red-600" : "text-success"}`}>
          {pctKelas === null ? "–" : `${pctKelas}%`}
        </span>
      </div>

      {matrix.map((s) => {
        const pct = studentPct(s, effectiveDays);
        const warn = isBelowThreshold(s, effectiveDays);
        return (
          <div key={s.studentId} className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold leading-tight text-slate-800"
                  style={{ cursor: onStudentClick ? "pointer" : "default" }}
                  onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}
                >
                  {s.studentName}
                </p>
                <p className="text-[11px] leading-tight text-slate-500">{s.nis || s.nisn || ""}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                  warn ? "bg-red-50 text-red-600 ring-1 ring-red-200" : "bg-green-50 text-success ring-1 ring-green-200"
                }`}
              >
                {pct === null ? "–" : `${pct}%`}
              </span>
            </div>

            {/* Chip tanggal: hari libur diblok merah, status H/S/I/A berwarna */}
            <div className="mt-2 grid grid-cols-8 gap-1 sm:grid-cols-10">
              {columns.map((c) => {
                const status = s.dailyStatus[c.day];
                if (!c.effective) {
                  return (
                    <div
                      key={c.day}
                      title={`Libur — ${c.reason || "hari libur/akhir pekan"}`}
                      className="rounded border border-red-300 bg-red-100 text-center leading-tight"
                    >
                      <div className="text-[9px] font-medium text-red-700">{c.day}</div>
                      <div className="text-[10px] font-bold text-red-700">✕</div>
                    </div>
                  );
                }
                const tone =
                  status === "H" ? "border-green-300 bg-green-50 text-success"
                  : status === "S" ? "border-amber-300 bg-amber-50 text-amber-700"
                  : status === "I" ? "border-blue-300 bg-blue-50 text-blue-700"
                  : status === "A" ? "border-red-300 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-400";
                return (
                  <div key={c.day} title={`${c.day} ${monthName} — ${STATUS_LABELS_ID[status || ""] || "Belum tercatat"}`} className={`rounded border text-center leading-tight ${tone}`}>
                    <div className="text-[9px] opacity-70">{c.day}</div>
                    <div className="text-[10px] font-bold">{status || "–"}</div>
                  </div>
                );
              })}
            </div>

            {/* Rekap mini */}
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-[11px]">
              <span className="text-slate-500">Rekap</span>
              <span className="flex gap-2.5 tabular-nums">
                <span><b className="text-success">H</b> {s.totalHadir}</span>
                <span><b className="text-amber-700">S</b> {s.totalSakit}</span>
                <span><b className="text-blue-700">I</b> {s.totalIzin}</span>
                <span><b className="text-red-700">A</b> {s.totalAlpha}</span>
              </span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-center text-[11px] text-slate-500">
        Ketuk nama siswa untuk detail kehadiran • {matrix.length} siswa
      </p>
    </div>
  );
}
