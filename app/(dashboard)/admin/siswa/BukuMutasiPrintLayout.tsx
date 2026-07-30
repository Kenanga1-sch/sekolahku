import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { MutasiLog, ReportRow, RekapRow, SchoolSettings } from "./types-mutasi";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
function toRoman(n: number): string {
  return ROMAN[n] ?? String(n);
}

interface Props {
  reportMonthLabel: string;
  masukRows: ReportRow[];
  monthlyMasukLogs: MutasiLog[];
  keluarRows: ReportRow[];
  monthlyKeluarLogs: MutasiLog[];
  schoolSettings: SchoolSettings;
  rekapRows: RekapRow[];
  isPerClass: boolean;
  selectedClassName: string;
}

export function BukuMutasiPrintLayout({
  reportMonthLabel,
  masukRows,
  monthlyMasukLogs,
  keluarRows,
  monthlyKeluarLogs,
  schoolSettings,
  rekapRows,
  isPerClass,
  selectedClassName,
}: Props) {
  const signatureLabel = isPerClass ? "Kepala Sekolah," : "Pengawas Sekolah,";
  const signatureName = isPerClass
    ? schoolSettings?.principal_name || "................................................"
    : schoolSettings?.supervisor_name || "................................................";
  const signatureNIP = isPerClass
    ? schoolSettings?.principal_nip || "...................................."
    : schoolSettings?.supervisor_nip || "....................................";

  return (
    <div className="mutasi-print-root bg-white p-2 text-black font-sans text-[9px] leading-tight">
      <div className="mx-auto w-full space-y-2">
        <div className="flex justify-between items-baseline mb-2 border-b-2 border-black pb-1">
          <div className="text-[16px] font-bold tracking-wide uppercase">
            BUKU MUTASI MURID
          </div>
          {isPerClass && selectedClassName && (
            <div className="text-[12px] font-bold uppercase">
              {selectedClassName}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold pb-0.5 border-b border-black">
              <span>BULAN : {reportMonthLabel}</span>
              <span className="uppercase tracking-wider">MASUK</span>
            </div>

            <div className="relative">
              <table className="w-full border-collapse border border-black table-fixed text-[8px]">
                <thead>
                  <tr className="bg-slate-50">
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[4%] leading-tight">No.<br />Urut</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Tanggal</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-left w-[20%] leading-tight">Nama Siswa</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[4%] leading-tight">L/P</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">No.<br />Induk</th>
                    <th rowSpan={2} className="border border-black px-0.5 py-0.5 text-center w-[5%] leading-tight">Kelas</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center leading-tight">Berasal dari</th>
                    <th colSpan={2} className="border border-black px-0.5 py-0.5 text-center leading-tight">Persetujuan<br />Kanwil/Kanko</th>
                  </tr>
                  <tr className="bg-slate-50">
                    <th className="border border-black px-0.5 py-0.5 text-left w-[18%] leading-tight">Sekolah</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[8%] leading-tight">No. Induk</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%] leading-tight">Kelas</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Tanggal</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[9%] leading-tight">Nomor</th>
                  </tr>
                </thead>
                <tbody>
                  {masukRows.map((row, index) => (
                    <tr key={`masuk-${index}`} className="h-6">
                      <td className="border border-black px-1 py-1 text-center font-medium">{row.no}</td>
                      <td className="border border-black px-1 py-1 text-center whitespace-nowrap">{row.tanggal}</td>
                      <td className="border border-black px-1 py-1 font-medium break-words whitespace-normal leading-tight">{row.nama}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.lp}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.noInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.kelas}</td>
                      <td className="border border-black px-1 py-1 break-words whitespace-normal leading-tight">{row.sekolah}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.asalNoInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.asalKelas}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.persetujuanTanggal}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.persetujuanNomor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {monthlyMasukLogs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-red-500 border-2 border-red-500 rounded px-6 py-1 text-2xl font-bold tracking-widest uppercase rotate-[-12deg] opacity-30">
                    NIHIL
                  </div>
                </div>
              )}
            </div>

            <div className="pt-8 pl-4 space-y-1 text-[10px]">
              <div className="font-bold">{signatureLabel}</div>
              <div className="h-14" />
              <div className="font-bold border-b border-black inline-block">
                {signatureName}
              </div>
              <div className="text-[9px]">
                NIP. {signatureNIP}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-bold pb-0.5 border-b border-black">
              <span>BULAN : {reportMonthLabel}</span>
              <span className="uppercase tracking-wider">KELUAR</span>
            </div>

            <div className="relative">
              <table className="w-full border-collapse border border-black table-fixed text-[8.5px]">
                <thead>
                  <tr className="bg-slate-50 font-bold">
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[4%] leading-tight">No.<br />Urut</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] leading-tight">Tanggal</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-left w-[23%] leading-tight">Nama Siswa</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] leading-tight">No.<br />Induk</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[4%] leading-tight">L/P</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[7%] leading-tight">Kelas</th>
                    <th className="border border-black px-1 py-1 text-center w-[20%] leading-tight">Nomor Surat Pindah</th>
                    <th className="border border-black px-1 py-1 text-left w-[22%] leading-tight">Keterangan/<br />Pindah ke..</th>
                  </tr>
                </thead>
                <tbody>
                  {keluarRows.map((row, index) => (
                    <tr key={`keluar-${index}`} className="h-6">
                      <td className="border border-black px-1 py-1 text-center font-medium">{row.no}</td>
                      <td className="border border-black px-1 py-1 text-center whitespace-nowrap">{row.tanggal}</td>
                      <td className="border border-black px-1 py-1 font-medium break-words whitespace-normal leading-tight">{row.nama}</td>
                      <td className="border border-black px-1 py-1 text-center font-mono">{row.noInduk}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.lp}</td>
                      <td className="border border-black px-1 py-1 text-center">{row.kelas}</td>
                      <td className="border border-black px-1 py-1 text-center break-words whitespace-normal leading-tight">{row.nomorSurat}</td>
                      <td className="border border-black px-1 py-1 break-words whitespace-normal leading-tight">{row.tujuan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {monthlyKeluarLogs.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-red-500 border-2 border-red-500 rounded px-6 py-1 text-2xl font-bold tracking-widest uppercase rotate-[-12deg] opacity-30">
                    NIHIL
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <div className="text-[10px] font-bold uppercase mb-1">REKAPITULASI</div>
              <table className="w-full border-collapse border border-black table-fixed text-[8.5px]">
                <thead>
                  <tr className="bg-slate-50 font-bold">
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[10%] font-bold">Kelas</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">Awal Bulan</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">MASUK</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">KELUAR</th>
                    <th colSpan={3} className="border border-black px-0.5 py-0.5 text-center">Akhir Bulan</th>
                    <th rowSpan={2} className="border border-black px-1 py-1 text-center w-[18%]">Keterangan</th>
                  </tr>
                  <tr className="bg-slate-50 text-[8px] font-semibold">
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">L</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[5%]">P</th>
                    <th className="border border-black px-0.5 py-0.5 text-center w-[6%] font-bold">JM</th>
                  </tr>
                </thead>
                <tbody>
                  {rekapRows.map((row) => (
                    <tr key={`rekap-${row.grade}`} className={row.grade === "Jumlah" ? "font-bold bg-slate-100 border-t-2 border-black" : "h-5"}>
                      <td className="border border-black px-1 py-0.5 text-center font-bold">
                        {typeof row.grade === "number" ? toRoman(row.grade) : row.grade}
                      </td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.awalL !== "" ? row.awalL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.awalP !== "" ? row.awalP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.awalJM !== "" ? row.awalJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.masukL !== "" ? row.masukL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.masukP !== "" ? row.masukP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.masukJM !== "" ? row.masukJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.keluarL !== "" ? row.keluarL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.keluarP !== "" ? row.keluarP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.keluarJM !== "" ? row.keluarJM : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.akhirL !== "" ? row.akhirL : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center">{row.akhirP !== "" ? row.akhirP : 0}</td>
                      <td className="border border-black px-0.5 py-0.5 text-center font-bold bg-slate-50">{row.akhirJM !== "" ? row.akhirJM : 0}</td>
                      <td className="border border-black px-1 py-0.5 text-center font-medium">{row.keterangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="no-print rounded border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-[8px] text-slate-500 mt-2">
          Format cetak mengikuti standar resmi Buku Mutasi Murid (A4 Landscape). Kolom yang belum terisi otomatis sengaja dibiarkan kosong untuk kelengkapan arsip manual.
        </div>
      </div>
    </div>
  );
}
