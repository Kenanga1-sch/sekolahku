"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

// ── Types ────────────────────────────────────────────────────────────────────
interface AlumniSummary {
  id: string;
  nisn: string | null;
  nis: string | null;
  nik: string | null;
  fullName: string;
  nickname: string | null;
  gender: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  religion: string | null;
  citizenship: string | null;
  address: string | null;
  childOrder: number | null;
  siblingKandung: number;
  siblingTiri: number;
  siblingAngkat: number;
  siblingCount: number | null;
  dailyLanguage: string | null;
  livingWith: string | null;
  enrolledYear: string | null;
  previousSchool: string | null;
  previousSchoolAddress: string | null;
  previousSchoolCertNo: string | null;
  previousSchoolCertDate: string | null;
  fatherName: string | null;
  fatherNik: string | null;
  fatherEducation: string | null;
  fatherJob: string | null;
  fatherIncome: string | null;
  motherName: string | null;
  motherNik: string | null;
  motherEducation: string | null;
  motherJob: string | null;
  motherIncome: string | null;
  guardianName: string | null;
  guardianNik: string | null;
  guardianRelation: string | null;
  guardianJob: string | null;
  guardianPhone: string | null;
  guardianEducation: string | null;
  guardianIncome: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  height: number | null;
  weight: number | null;
  bloodType: string | null;
  medicalNotes: string | null;
  specialNeeds: string | null;
  scholarshipInfo: string | null;
  status: string;
  graduationYear: string;
  graduationDate: string | null;
  finalClass: string | null;
  finalGradeAvg: number | null;
  nextSchool: string | null;
  ijazahNo: string | null;
  ijazahDate: string | null;
  skhunNo: string | null;
  skhunDate: string | null;
}

const STATUS_LABEL: Record<string, string> = { active: "Aktif", graduated: "Lulus", transferred: "Pindah/Mutasi", dropped: "DO" };
const GENDER_LABEL: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

const val = (v: any, fallback = "-") => (v == null || v === "" ? fallback : String(v));

const fmtDate = (d: string | null) => {
  if (!d) return "-";
  try {
    const parts = d.split(/[-T]/);
    if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  } catch { return d; }
};

export default function CetakBatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<AlumniSummary[]>([]);

  const statusFilter = searchParams.get("status") || "all";
  const yearFilter = searchParams.get("graduationYear") || "";

  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set("limit", "500");
        params.set("page", "1");
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (yearFilter) params.set("graduationYear", yearFilter);

        const data: any = await goGet(`/api/alumni?${params}`);
        setStudents(data.items || data.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [statusFilter, yearFilter]);

  useEffect(() => {
    if (!loading && students.length > 0) {
      const t = setTimeout(() => window.print(), 800);
      return () => clearTimeout(t);
    }
  }, [loading, students]);

  const schoolName = settings?.school_name || "UPTD SDN 1 KENANGA";
  const schoolAddress = settings?.school_address || "Jl. Pendidikan No. 1";
  const schoolLogo = settings?.school_logo
    ? settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") ? settings.school_logo : `/uploads/${settings.school_logo}`
    : null;

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  if (students.length === 0) {
    return <div className="flex items-center justify-center min-h-screen"><p>Tidak ada data untuk dicetak.</p></div>;
  }

  const siblingTotal = (s: AlumniSummary) => s.siblingCount ?? (s.siblingKandung + s.siblingTiri + s.siblingAngkat);

  return (
    <>
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => router.back()}>Kembali</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Cetak Semua ({students.length})</Button>
      </div>

      <div className="print-content max-w-[210mm] mx-auto bg-white text-black text-[10px] leading-tight font-sans">
        {students.map((a, idx) => (
          <div key={a.id}>
            {idx > 0 && <div className="page-break" />}
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-2 mb-2">
              <div className="flex items-center justify-center gap-2">
                {schoolLogo && <img src={schoolLogo} alt="Logo" className="h-10 object-contain" />}
                <div>
                  <h1 className="text-xs font-bold uppercase">{schoolName}</h1>
                  <p className="text-[8px]">{schoolAddress}</p>
                </div>
              </div>
              <h2 className="text-xs font-bold mt-2 uppercase border-b border-black inline-block px-4 pb-0.5">Buku Induk Siswa</h2>
            </div>

            {/* Data Pribadi */}
            <M section="A. Data Pribadi">
              <R label="Nama" val={a.fullName} />
              <R label="NISN" val={val(a.nisn)} />
              <R label="NIS" val={val(a.nis)} />
              <R label="NIK" val={val(a.nik)} />
              <R label="JK" val={GENDER_LABEL[a.gender || ""] || val(a.gender)} />
              <R label="TTL" val={`${val(a.birthPlace)}, ${fmtDate(a.birthDate)}`} />
              <R label="Agama" val={val(a.religion)} />
              <R label="Alamat" val={val(a.address)} />
              <R label="Anak ke" val={val(a.childOrder)} />
              <R label="Saudara (K/T/A)" val={`${siblingTotal(a)} (K:${a.siblingKandung}, T:${a.siblingTiri}, A:${a.siblingAngkat})`} />
            </M>

            {/* Orang Tua */}
            <M section="B. Orang Tua / Wali">
              <div className="grid grid-cols-3 gap-x-2 text-[9px] mb-1">
                <div>
                  <strong>Ayah:</strong> {val(a.fatherName)}<br />
                  NIK: {val(a.fatherNik)} | Pend: {val(a.fatherEducation)}<br />
                  Kerja: {val(a.fatherJob)} | {val(a.fatherIncome)}
                </div>
                <div>
                  <strong>Ibu:</strong> {val(a.motherName)}<br />
                  NIK: {val(a.motherNik)} | Pend: {val(a.motherEducation)}<br />
                  Kerja: {val(a.motherJob)} | {val(a.motherIncome)}
                </div>
                <div>
                  <strong>Wali:</strong> {val(a.guardianName)}<br />
                  Hub: {val(a.guardianRelation)} | Telp: {val(a.guardianPhone)}<br />
                  Kerja: {val(a.guardianJob)} | {val(a.guardianIncome)}
                </div>
              </div>
              <R label="Alamat Ortu" val={val(a.parentAddress)} />
            </M>

            {/* Riwayat Masuk */}
            <M section="C. Riwayat Masuk">
              <R label="Tahun Masuk" val={val(a.enrolledYear)} />
              <R label="Asal TK" val={val(a.previousSchool)} />
            </M>

            {/* Riwayat Pendidikan */}
            <M section="D. Riwayat Pendidikan 6 Tahun">
              <table className="w-full border border-black text-[9px] mb-1">
                <thead><tr className="bg-gray-100">
                  {["I","II","III","IV","V","VI"].map(k => <th key={k} className="border px-0.5">{k}</th>)}
                </tr></thead>
                <tbody><tr>
                  {["I","II","III","IV","V","VI"].map(k => <td key={k} className="border px-0.5 h-10 text-center"></td>)}
                </tr></tbody>
              </table>
            </M>

            {/* Kesehatan & Status */}
            <M section="E. Kesehatan & Status">
              <R label="TB/BB" val={a.height ? `${a.height}cm / ${a.weight}kg` : "-"} />
              <R label="Gol. Darah" val={val(a.bloodType)} />
              <R label="Kebutuhan Khusus" val={val(a.specialNeeds)} />
              <R label="Status" val={STATUS_LABEL[a.status] || a.status} />
              {a.status === "graduated" && (
                <>
                  <R label="Lulus" val={`${val(a.graduationYear)} (${val(a.finalClass)})`} />
                  <R label="Ijazah" val={`${val(a.ijazahNo)} / ${fmtDate(a.ijazahDate)}`} />
                  <R label="SKHUN" val={`${val(a.skhunNo)} / ${fmtDate(a.skhunDate)}`} />
                  <R label="SMP Tujuan" val={val(a.nextSchool)} />
                </>
              )}
            </M>

            {/* Tanda tangan di akhir halaman */}
            <div className="mt-2 flex justify-between text-[9px]">
              <div className="text-center"><p>Kepala Sekolah</p><p className="mt-5">....................</p></div>
              <div className="text-center"><p>Guru Kelas</p><p className="mt-5">....................</p></div>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @page { size: A4 portrait; margin: 8mm 8mm 8mm 8mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .print-content { max-width: none !important; } }
        .page-break { page-break-before: always; }
        .print-content { font-family: "Times New Roman", Times, serif; }
      `}</style>
    </>
  );
}

function M({ section, children }: { section: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <h3 className="text-[10px] font-bold border-b border-black pb-0.5 mb-1 bg-gray-100 px-1">{section}</h3>
      {children}
    </div>
  );
}
function R({ label, val: v }: { label: string; val: string }) {
  return <div className="flex text-[9px]"><span className="font-semibold w-24">{label}</span><span>: {v}</span></div>;
}
