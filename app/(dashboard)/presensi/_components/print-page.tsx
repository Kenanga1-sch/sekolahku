"use client";

import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { classPct, studentPct, isBelowThreshold, dowLetter, type DayColumn } from "@/lib/presensi-report";
import { siteConfig } from "@/lib/config";
import { pageCss, printAreaPx } from "@/lib/worksheet-print";
import { DOW_NAMES_ID, type StudentMatrix, type StudentRef } from "./presensi-report-types";

export function PrintPage({
  matrix, columns, effectiveDays, monthName, year, academicYear, className,
  onStudentClick, principalName, principalNIP, waliKelas, waliNIP,
  holidayReasons = [], belowThreshold = 0, preview = false,
  paperSize = "F4", orientation = "landscape",
}: {
  matrix: StudentMatrix[]; columns: DayColumn[]; effectiveDays: number;
  monthName: string; year: number; academicYear: string; className: string;
  onStudentClick?: (student: StudentRef) => void;
  principalName?: string; principalNIP?: string; waliKelas?: string; waliNIP?: string;
  holidayReasons?: [string, string][]; belowThreshold?: number;
  /** Tampilkan artefak kertas di layar (pratinjau eksplisit dari toolbar) */
  preview?: boolean;
  /** Ukuran kertas template default (mis. F4) — dari meta record presensi. */
  paperSize?: string;
  orientation?: string;
}) {
  const totalSiswa = matrix?.length || 0;
  const colCount = columns.length;
  const persentaseKelas = classPct(matrix, effectiveDays);
  // Jumlah hadir per tanggal (untuk baris "Jumlah" di kaki tabel)
  const dailyHadir = columns.map((c) =>
    c.effective ? matrix.reduce((n, s) => n + (s.dailyStatus[c.day] === "H" ? 1 : 0), 0) : null
  );
  // Nama kelas tanpa awalan "Kelas" ganda (label sudah berawalan "Kelas …")
  const classLabel = (className || "").replace(/^Kelas\s+/i, "").trim();
  const classTitle = /^semua kelas$/i.test(classLabel) ? className : `Kelas ${classLabel}`;
  const waliTitle = /^semua kelas$/i.test(classLabel) ? null : `Wali Kelas ${classLabel}`;
  // Tempat & tanggal tanda tangan: "Kab. …" diambil dari alamat sekolah
  const signPlace = (
    siteConfig.school.address.match(/Kab\.\s*([^,]+)/)?.[1] ||
    siteConfig.school.address.match(/Kota\s+([^,]+)/)?.[1] ||
    ""
  ).trim();
  const signDate = format(new Date(), "d MMMM yyyy", { locale: localeId });

  // Ukuran font adaptif agar 1 kelas selalu muat 1 lembar (F4 landscape):
  // tinggi layak = tinggi area cetak (printAreaPx, mis. F4 landscape 775px);
  // kop+judul+meta+legenda+tanda tangan ≈ 260px;
  // baris tabel ≈ font*1.15 + padding 3px. Kelas sedikit → font besar (maks 10),
  // kelas besar → font ciut otomatis (min 5.5) tanpa pecah halaman.
  const rowCount = Math.max(totalSiswa, 1) + 3;
  const areaHeight = printAreaPx({ paperSize, orientation })[1];
  const rowBudget = Math.max((areaHeight - 260) / rowCount, 7);
  const baseFont = Math.min(10, Math.max(5.5, (rowBudget - 3) / 1.15));

  return (
    <div className={`print-page${preview ? " show-print-preview" : ""}`} style={{ [ "--pf" as any]: `${baseFont}px`, background: "white" }}>
      <style>{`
        @media print {
          ${pageCss({ paperSize, orientation })}
          body { font-size: ${baseFont}px; }
        }
        .print-page {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        @media screen {
          .print-page { border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.04); }
          .pt-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e2e8f0; border-radius: 6px; }
          .print-table { min-width: 720px; }
          .print-table th, .print-table td { padding: 4px 5px; }
          .print-table .sticky-no { position: sticky; left: 0; z-index: 3; background: #fff; width: 40px; min-width: 40px; }
          .print-table .sticky-nis { position: sticky; left: 40px; z-index: 3; background: #fff; width: 76px; min-width: 76px; }
          .print-table .sticky-name { position: sticky; left: 116px; z-index: 3; background: #fff; width: 150px; min-width: 150px; box-shadow: 2px 0 0 #cbd5e1; }
          .print-table thead .sticky-no, .print-table thead .sticky-nis, .print-table thead .sticky-name { background: #f0f0f0; z-index: 4; }
        }
        @media print {
          .print-page { padding: 0; border: none; box-shadow: none; }
          .print-table .sticky-no, .print-table .sticky-nis, .print-table .sticky-name { position: static; box-shadow: none; }
          .day-off { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-page + .print-page {
          break-before: page;
          page-break-before: always;
        }
        .kop-surat { text-align: center; border-bottom: 3px double #000; padding-bottom: 4px; margin-bottom: 6px; }
        .print-table {
          width: 100%; border-collapse: collapse; font-size: var(--pf);
        }
        .print-table th, .print-table td {
          border: 0.5px solid #000; padding: 1.4px 2px; text-align: center; white-space: nowrap;
        }
        .print-table th { background: #f0f0f0; font-weight: 600; }
        .print-table .col-no { width: 3%; }
        .print-table .col-nis { width: 6%; }
        .print-table .col-name { text-align: left; }
        .print-table .col-day { font-size: calc(var(--pf) * 0.9); min-width: 10px; width: ${(56 / Math.max(colCount, 1)).toFixed(3)}%; max-width: ${(56 / Math.max(colCount, 1)).toFixed(3)}%; }
        .print-table .col-day .dow { display: block; font-size: calc(var(--pf) * 0.8); color: #64748b; line-height: 1.15; }
        .print-table .col-sum { }
        .print-table .col-pct { font-weight: 600; }
        .print-table .col-hadir { color: #15803d; font-weight: 600; }
        .print-table .status-h { color: #15803d; }
        .print-table .status-s { color: #b45309; }
        .print-table .status-i { color: #1d4ed8; }
        .print-table .status-a { color: #dc2626; }
        .print-table .status-none { color: #64748b; }
        .print-table .day-off { background: #fee2e2; color: #dc2626; }
        .print-table .pct-warn { color: #dc2626; font-weight: 700; }
        .print-table tfoot td { background: #f8fafc; font-weight: 600; }
        .print-table td.col-name { text-decoration: none !important; }
        .report-note { font-size: calc(var(--pf) * 1.1); color: #334155; margin: 5px 0 0; line-height: 1.4; }
        .report-legend { font-size: calc(var(--pf) * 1.05); color: #334155; margin: 6px 0 0; line-height: 1.4; }
        .signature-block { break-inside: avoid; page-break-inside: avoid; }
      `}</style>

      {/* Kop surat sekolah */}
      <div className="kop-surat">
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.6)", fontWeight: 700, textTransform: "uppercase" }}>
          {siteConfig.school.name}
        </p>
        <p style={{ margin: "1px 0", fontSize: "calc(var(--pf) * 1.15)" }}>
          NPSN {siteConfig.school.npsn}
        </p>
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.1)" }}>{siteConfig.school.address}</p>
        {(siteConfig.school.email || siteConfig.school.website) && (
          <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.1)" }}>
            {[siteConfig.school.email, siteConfig.school.website].filter(Boolean).join(" • ")}
          </p>
        )}
      </div>

      <div style={{ textAlign: "center", marginBottom: "0.3rem" }}>
        <h2 style={{ margin: 0, fontSize: "calc(var(--pf) * 1.8)", fontWeight: 700 }}>DAFTAR HADIR SISWA</h2>
        <p style={{ margin: "1px 0", fontSize: "calc(var(--pf) * 1.3)", fontWeight: 600 }}>
          {classTitle} — {monthName} {year}
        </p>
        <p style={{ margin: 0, fontSize: "calc(var(--pf) * 1.2)" }}>Tahun Pelajaran {academicYear}</p>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <span><strong>Jumlah Siswa:</strong> {totalSiswa}</span>
        <span><strong>Hari Efektif:</strong> {effectiveDays} hari</span>
        <span><strong>Kehadiran Kelas:</strong> {persentaseKelas === null ? "–" : `${persentaseKelas}%`}</span>
      </div>

      <div className="pt-wrap">
        <table className="print-table">
          {/* Lebar kolom eksplisit: saat cetak globals.css memaksa table-layout:fixed,
              yang diandalkan adalah baris pertama / elemen <col>, bukan lebar konten. */}
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "6%" }} />
            <col style={{ width: "13%" }} />
            {columns.map((c) => (
              <col key={c.day} style={{ width: `${(56 / Math.max(colCount, 1)).toFixed(3)}%` }} />
            ))}
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4.5%" }} />
            <col style={{ width: "4%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-no sticky-no" rowSpan={2}>No</th>
              <th className="col-nis sticky-nis" rowSpan={2}>NIS</th>
              <th className="col-name sticky-name" rowSpan={2}>Nama Siswa</th>
              <th colSpan={colCount} className="col-day">Tanggal</th>
              <th className="col-sum col-hadir" rowSpan={2}>H</th>
              <th className="col-sum" rowSpan={2}>S</th>
              <th className="col-sum" rowSpan={2}>I</th>
              <th className="col-sum" rowSpan={2}>A</th>
              <th className="col-pct" rowSpan={2}>%</th>
            </tr>
            <tr>
              {columns.map((c) => (
                <th key={c.day} className={`col-day${c.effective ? "" : " day-off"}`} title={c.effective ? DOW_NAMES_ID[c.dow] : "Hari libur / akhir pekan"}>
                  {c.day}
                  <span className="dow">{dowLetter(c.dow)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.length === 0 ? (
              <tr>
                <td colSpan={colCount + 7} style={{ textAlign: "center", padding: "8px" }}>
                  Belum ada data presensi untuk periode ini
                </td>
              </tr>
            ) : matrix.map((s, i) => {
              const pct = studentPct(s, effectiveDays);
              const warn = isBelowThreshold(s, effectiveDays);
              return (
                <tr key={s.studentId}>
                  <td className="col-no sticky-no">{i + 1}</td>
                  <td className="col-nis sticky-nis">{s.nis || s.nisn || ""}</td>
                  <td className="col-name sticky-name" style={{ cursor: onStudentClick ? "pointer" : "default" }} onClick={() => onStudentClick?.({ id: s.studentId, name: s.studentName, nis: s.nis, className: s.className || className })}>
                    {s.studentName}
                  </td>
                  {columns.map((c) => {
                    if (!c.effective) return <td key={c.day} className="col-day day-off" title="Hari libur / akhir pekan" />;
                    const status = s.dailyStatus[c.day];
                    const cls = status === "H" ? "status-h" : status === "S" ? "status-s" : status === "I" ? "status-i" : status === "A" ? "status-a" : "status-none";
                    return <td key={c.day} className={`col-day ${cls}`}>{status || "–"}</td>;
                  })}
                  <td className="col-sum col-hadir">{s.totalHadir}</td>
                  <td className="col-sum">{s.totalSakit}</td>
                  <td className="col-sum">{s.totalIzin}</td>
                  <td className="col-sum">{s.totalAlpha}</td>
                  <td className={`col-pct${warn ? " pct-warn" : ""}`}>{pct === null ? "–" : `${pct}%`}</td>
                </tr>
              );
            })}
          </tbody>
          {matrix.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: "left" }}>Jumlah ({totalSiswa} siswa)</td>
                {columns.map((c, idx) => (
                  <td key={c.day} className={`col-day${c.effective ? "" : " day-off"}`}>
                    {dailyHadir[idx] === null ? "" : dailyHadir[idx]}
                  </td>
                ))}
                <td className="col-sum col-hadir">
                  {matrix.reduce((n, s) => n + s.totalHadir, 0)}
                </td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalSakit, 0)}</td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalIzin, 0)}</td>
                <td className="col-sum">{matrix.reduce((n, s) => n + s.totalAlpha, 0)}</td>
                <td className="col-pct">{persentaseKelas === null ? "–" : `${persentaseKelas}%`}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {matrix.length > 0 && (
        <div>
          <p className="report-legend">
            <strong>Keterangan:</strong> H = Hadir, S = Sakit, I = Izin, A = Alpha, – = Belum tercatat,
            kolom berwarna = hari libur / akhir pekan (tidak dihitung).
          </p>
          <p className="report-note">
            Hari efektif {effectiveDays} hari dari {colCount} tanggal • Persentase = Hadir ÷ Hari Efektif × 100
            {holidayReasons.length > 0 && (
              <> • Libur: {holidayReasons.map(([d, r]) => `${parseInt(d.split("-")[2], 10)} ${monthName} (${r})`).join(", ")}</>
            )}
          </p>
          {belowThreshold > 0 && (
            <p className="report-note" style={{ color: "#b45309" }}>
              Perhatian: {belowThreshold} siswa dengan kehadiran di bawah 75%.
            </p>
          )}
        </div>
      )}

      <div className="signature-block" style={{ display: "flex", justifyContent: "space-between", marginTop: "0.8rem", fontSize: "calc(var(--pf) * 1.2)" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>Mengetahui,</p>
          <p style={{ margin: "1px 0" }}>Kepala Sekolah</p>
          <p style={{ marginTop: "1.6rem" }}>{principalName ? principalName : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{principalNIP ? `NIP. ${principalNIP}` : "NIP. ……………………………"}</p>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <p style={{ margin: 0 }}>{signPlace ? `${signPlace}, ` : ""}{signDate}</p>
          <p style={{ margin: "1px 0" }}>{waliTitle || "Wali Kelas"}</p>
          <p style={{ marginTop: "1.6rem" }}>{waliKelas ? waliKelas : "________________________"}</p>
          <p style={{ margin: "1px 0" }}>{waliNIP ? `NIP. ${waliNIP}` : "NIP. ……………………………"}</p>
        </div>
      </div>
    </div>
  );
}
