"use client";

import { QRCodeSVG } from "qrcode.react";

export interface StatementMutation {
  date: string;
  refId: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  category: string;
}

export interface StatementData {
  student: {
    id: string;
    nama: string;
    nisn: string;
    kelas: string | null;
  };
  period: {
    start: string;
    end: string;
  };
  openingBalance: number;
  mutations: StatementMutation[];
  summary: {
    totalCredit: number;
    totalDebit: number;
    closingBalance: number;
  };
  verificationHash: string;
  generatedAt: string;
}

export interface StatementDocumentProps {
  statement: StatementData;
  schoolName: string;
  schoolAddress?: string;
}

const formatRupiah = (num: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

const formatDateTime = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function getVerificationUrl(hash: string) {
  return `${typeof window !== "undefined" ? window.location.origin : ""}/tabungan/rekening-koran/verify/detail?hash=${encodeURIComponent(hash)}`;
}

export function StatementDocument({ statement, schoolName, schoolAddress }: StatementDocumentProps) {
  return (
    <div
      className="bg-white text-black print:text-black rounded-lg shadow-lg overflow-hidden relative"
      style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none print:opacity-[0.05]"
        style={{ zIndex: 0 }}
      >
        <div className="text-[120px] font-bold text-gray-500 rotate-[-30deg] select-none whitespace-nowrap">
          BANK SEKOLAH
        </div>
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 print:bg-emerald-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">🏫</span>
              </div>
              <div>
                <h1 className="text-xl font-bold">REKENING KORAN TABUNGAN SISWA</h1>
                <p className="text-emerald-100">{schoolName}</p>
                {schoolAddress ? <p className="text-xs text-emerald-200">{schoolAddress}</p> : null}
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-emerald-100">No. Rekening:</p>
              <p className="font-mono font-bold">{statement.student.nisn}</p>
            </div>
          </div>
        </div>

        <div className="p-6 border-b bg-gray-50 print:bg-gray-100">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Nama Pemilik</p>
              <p className="font-semibold">{statement.student.nama}</p>
            </div>
            <div>
              <p className="text-gray-500">NISN</p>
              <p className="font-mono">{statement.student.nisn}</p>
            </div>
            <div>
              <p className="text-gray-500">Kelas</p>
              <p className="font-semibold">{statement.student.kelas || "-"}</p>
            </div>
            <div>
              <p className="text-gray-500">Periode Mutasi</p>
              <p className="font-semibold">
                {formatDate(statement.period.start)} - {formatDate(statement.period.end)}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-b">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-xs text-blue-600 uppercase font-medium">Saldo Awal</p>
              <p className="text-xl font-bold text-blue-700">{formatRupiah(statement.openingBalance)}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <p className="text-xs text-green-600 uppercase font-medium">Total Masuk (Kredit)</p>
              <p className="text-xl font-bold text-green-700">+{formatRupiah(statement.summary.totalCredit)}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-100">
              <p className="text-xs text-red-600 uppercase font-medium">Total Keluar (Debit)</p>
              <p className="text-xl font-bold text-red-700">-{formatRupiah(statement.summary.totalDebit)}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
              <p className="text-xs text-emerald-600 uppercase font-medium">Saldo Akhir</p>
              <p className="text-xl font-bold text-emerald-700">{formatRupiah(statement.summary.closingBalance)}</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h3 className="font-semibold mb-4 text-gray-700">MUTASI REKENING</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left p-3 font-semibold">Tanggal</th>
                  <th className="text-left p-3 font-semibold">Ref</th>
                  <th className="text-left p-3 font-semibold">Keterangan</th>
                  <th className="text-right p-3 font-semibold text-red-600">Debit</th>
                  <th className="text-right p-3 font-semibold text-green-600">Kredit</th>
                  <th className="text-right p-3 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b bg-gray-50">
                  <td className="p-3 text-gray-500" colSpan={5}>
                    <em>Saldo Awal Periode</em>
                  </td>
                  <td className="p-3 text-right font-mono font-semibold">{formatRupiah(statement.openingBalance)}</td>
                </tr>

                {statement.mutations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Tidak ada transaksi dalam periode ini
                    </td>
                  </tr>
                ) : (
                  statement.mutations.map((m, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-gray-600">{formatDateTime(m.date)}</td>
                      <td className="p-3 font-mono text-xs text-gray-500">{m.refId}</td>
                      <td className="p-3">
                        <span className={m.category === "debt_settlement" ? "text-orange-600" : ""}>
                          {m.description}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-red-600">
                        {m.debit > 0 ? formatRupiah(m.debit) : "-"}
                      </td>
                      <td className="p-3 text-right font-mono text-green-600">
                        {m.credit > 0 ? formatRupiah(m.credit) : "-"}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold">{formatRupiah(m.balance)}</td>
                    </tr>
                  ))
                )}

                <tr className="bg-emerald-50 font-semibold">
                  <td className="p-3" colSpan={5}>
                    Saldo Akhir per {formatDate(statement.period.end)}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 text-lg">
                    {formatRupiah(statement.summary.closingBalance)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-lg shadow-sm">
                <QRCodeSVG value={getVerificationUrl(statement.verificationHash)} size={80} level="M" />
              </div>
              <div className="text-xs text-gray-500 max-w-xs">
                <p className="font-semibold text-gray-700 mb-1">Verifikasi Dokumen</p>
                <p>Scan QR Code untuk memverifikasi keaslian dokumen ini.</p>
                <p className="mt-2 text-[10px] italic">
                  Dokumen ini adalah cetakan komputer dan sah tanpa tanda tangan basah jika terdapat QR Code valid.
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Dicetak: {formatDateTime(statement.generatedAt)}</p>
              <p className="font-mono text-[10px]">Hash: {statement.verificationHash}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
