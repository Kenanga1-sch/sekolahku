"use client";

import { classPct, studentPct, isBelowThreshold, dowLetter, type DayColumn } from "@/lib/presensi-report";
import { DOW_NAMES_ID, type StudentMatrix, type StudentRef } from "./presensi-report-types";

/* Tampilan layar mobile-first untuk daftar hadir bulanan.
   Terpisah dari artefak kertas (.print-page): di layar dipakai tabel .attm-*
   yang nyaman di HP (font 13px, kolom identitas menempel, tanggal bisa digeser,
   baris jumlah menempel di bawah), sementara format cetak tetap di PrintPage. */
export function ScreenMatrix({
  matrix, columns, effectiveDays, className, monthName, year, onStudentClick,
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  className: string; monthName: string; year: number;
  onStudentClick?: (student: StudentRef) => void;
}) {
  const colCount = columns.length;
  const totalSiswa = matrix.length;
  const pctKelas = classPct(matrix, effectiveDays);
  const dailyHadir = columns.map((c) =>
    c.effective ? matrix.reduce((n, s) => n + (s.dailyStatus[c.day] === "H" ? 1 : 0), 0) : null
  );
  return (
    <div className="no-print overflow-hidden rounded-lg border bg-white">
      {/* Identitas blok: kelas + periode + rekap singkat */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-slate-50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-800">
            Daftar Hadir — {className}
          </p>
          <p className="text-xs leading-tight text-slate-500">
            {monthName} {year} • {totalSiswa} siswa • Hari efektif {effectiveDays} hari
          </p>
        </div>
        <span className={`text-sm font-bold ${pctKelas !== null && pctKelas < 75 ? "text-red-600" : "text-green-700"}`}>
          {pctKelas === null ? "–" : `${pctKelas}%`}
        </span>
      </div>

      <div className="attm-wrap">
        <table className="attm-table">
          <thead>
            <tr>
              <th className="c-no" rowSpan={2}>No</th>
              <th className="c-nis" rowSpan={2}>NIS</th>
              <th className="c-name" rowSpan={2}>Nama Siswa</th>
              <th className="c-tgl" colSpan={Math.max(colCount, 1)}>Tanggal</th>
              <th className="c-sum" rowSpan={2}>H</th>
              <th className="c-sum" rowSpan={2}>S</th>
              <th className="c-sum" rowSpan={2}>I</th>
              <th className="c-sum" rowSpan={2}>A</th>
              <th className="c-pct" rowSpan={2}>%</th>
            </tr>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.day}
                  className={`c-day${c.effective ? "" : " day-off"}`}
                  title={c.effective ? DOW_NAMES_ID[c.dow] : "Hari libur / akhir pekan"}
                >
                  {c.day}
                  <span className="dow">{dowLetter(c.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {totalSiswa === 0 ? (
              <tr>
                <td colSpan={colCount + 7} className="py-6 text-center text-slate-400">
                  Belum ada data presensi untuk periode ini
                </td>
              </tr>
            ) : matrix.map((s, i) => {
              const pct = studentPct(s, effectiveDays);
              const warn = isBelowThreshold(s, effectiveDays);
              return (
                <tr key={s.studentId}>
                  <td className="c-no">{i + 1}</td>
                  <td className="c-nis">{s.nis || s.nisn || ""}</td>
                  <td
                    className="c-name"
                    style={{ cursor: onStudentClick ? "pointer" : "default" }}
                    title={`${s.studentName} — ketuk untuk detail`}
                    onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}
                  >
                    {s.studentName}
                    {/* NIS sekunder di layar kecil (kolom NIS sendiri tampil di md+) */}
                    <span className="attm-nis">{s.nis || s.nisn || ""}</span>
                  </td>
                  {columns.map((c) => {
                    if (!c.effective) return <td key={c.day} className="c-day day-off" title="Hari libur / akhir pekan" />;
                    const status = s.dailyStatus[c.day];
                    const cls = status === "H" ? "status-h" : status === "S" ? "status-s" : status === "I" ? "status-i" : status === "A" ? "status-a" : "status-none";
                    return <td key={c.day} className={`c-day ${cls}`}>{status || "–"}</td>;
                  })}
                  <td className="c-sum status-h">{s.totalHadir}</td>
                  <td className="c-sum status-s">{s.totalSakit}</td>
                  <td className="c-sum status-i">{s.totalIzin}</td>
                  <td className="c-sum status-a">{s.totalAlpha}</td>
                  <td className={`c-pct${warn ? " pct-warn" : ""}`}>{pct === null ? "–" : `${pct}%`}</td>
                </tr>
              );
            })}
          </tbody>
          {totalSiswa > 0 && (
            <tfoot>
              <tr>
                <td className="c-no" />
                <td className="c-nis" />
                <td className="c-name">Jumlah ({totalSiswa} siswa)</td>
                {columns.map((c, idx) => (
                  <td key={c.day} className={`c-day${c.effective ? "" : " day-off"}`}>
                    {dailyHadir[idx] === null ? "" : dailyHadir[idx]}
                  </td>
                ))}
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalHadir, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalSakit, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalIzin, 0)}</td>
                <td className="c-sum">{matrix.reduce((n, s) => n + s.totalAlpha, 0)}</td>
                <td className="c-pct">{pctKelas === null ? "–" : `${pctKelas}%`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="px-3 py-1.5 text-[11px] leading-snug text-slate-500 md:hidden">
        Ketuk nama siswa untuk detail kehadiran
      </p>
    </div>
  );
}
