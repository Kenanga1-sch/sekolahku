"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { goGet } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// ── Types ────────────────────────────────────────────────────────────────────
interface AlumniHealthRecord {
  id: string;
  year: string;
  weight: number | null;
  height: number | null;
  illness: string | null;
  abnormality: string | null;
}

interface AlumniTranscript {
  id: string;
  academicYear: string;
  semester: string;
  subjectName: string;
  subjectCode: string | null;
  score: number;
  scoreLetter: string | null;
}

interface AlumniAchievement {
  id: string;
  type: string;
  title: string;
  level: string;
  ranking: string | null;
  year: string;
  organizer: string | null;
}

interface AlumniExtracurricular {
  id: string;
  activityName: string;
  role: string | null;
  yearStart: string | null;
  yearEnd: string | null;
}

interface AlumniAttendanceSummary {
  id: string;
  academicYear: string;
  semester: string;
  present: number;
  sick: number;
  permission: number;
  absent: number;
  totalDays: number;
}

interface ClassHistoryEntry {
  id: string;
  studentId: string;
  classId: string | null;
  className: string | null;
  academicYear: string | null;
  status: string | null;
  recordDate: number | null;
}

interface AlumniDetail {
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
  currentAddress: string | null;
  dailyLanguage: string | null;
  livingWith: string | null;
  childOrder: number | null;
  siblingKandung: number;
  siblingTiri: number;
  siblingAngkat: number;
  siblingCount: number | null;
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
  mutationOutClass: string | null;
  mutationOutToSchool: string | null;
  mutationOutDate: string | null;
  droppedOutDate: string | null;
  droppedOutReason: string | null;
  ijazahNo: string | null;
  ijazahDate: string | null;
  skhunNo: string | null;
  skhunDate: string | null;
  scholarshipInfo: string | null;
  mutasiMasukAsalSekolah: string | null;
  mutasiMasukDariKelas: string | null;
  mutasiMasukDiterimaTanggal: string | null;
  mutasiMasukDiKelas: string | null;
  healthRecords: AlumniHealthRecord[];
  classHistory: ClassHistoryEntry[];
  transcripts: AlumniTranscript[];
  achievements: AlumniAchievement[];
  extracurriculars: AlumniExtracurricular[];
  attendanceSummaries: AlumniAttendanceSummary[];
}

// ── Status mapping ───────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  graduated: "Lulus",
  transferred: "Pindah/Mutasi",
  dropped: "DO",
};

const GENDER_LABEL: Record<string, string> = { L: "Laki-laki", P: "Perempuan" };

const RELIGION_LIST = ["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu"];

// ── Helper ───────────────────────────────────────────────────────────────────
const val = (v: any, fallback = "-") => (v == null || v === "" ? fallback : String(v));

const fmtDate = (d: string | null) => {
  if (!d) return "-";
  try {
    return format(new Date(d), "dd/MM/yyyy");
  } catch {
    return d;
  }
};

// Group transcripts by academic year and sort semesters
interface GroupedTranscript {
  academicYear: string;
  semesters: { semester: string; subjects: AlumniTranscript[] }[];
}

function groupTranscripts(transcripts: AlumniTranscript[]): GroupedTranscript[] {
  const map = new Map<string, Map<string, AlumniTranscript[]>>();
  for (const t of transcripts) {
    const yr = t.academicYear || "-";
    const sm = t.semester || "1";
    if (!map.has(yr)) map.set(yr, new Map());
    const smMap = map.get(yr)!;
    if (!smMap.has(sm)) smMap.set(sm, []);
    smMap.get(sm)!.push(t);
  }
  const result: GroupedTranscript[] = [];
  for (const [academicYear, smMap] of map) {
    const semesters = Array.from(smMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semester, subjects]) => ({
        semester,
        subjects: subjects.sort((a, b) => (a.subjectName || "").localeCompare(b.subjectName || "")),
      }));
    result.push({ academicYear, semesters });
  }
  return result.sort((a, b) => a.academicYear.localeCompare(b.academicYear));
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CetakBukuIndukPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useSchoolSettings();
  const [loading, setLoading] = useState(true);
  const [alumni, setAlumni] = useState<AlumniDetail | null>(null);

  const id = searchParams.get("id");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data: any = await goGet(`/api/alumni/${id}`);
        setAlumni(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Auto-print after data loads
  useEffect(() => {
    if (!loading && alumni) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, alumni]);

  const schoolName = settings?.school_name || "UPTD SDN 1 KENANGA";
  const schoolAddress = settings?.school_address || "Jl. Pendidikan No. 1";
  const schoolLogo = settings?.school_logo
    ? settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/")
      ? settings.school_logo
      : `/uploads/${settings.school_logo}`
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!alumni) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Data tidak ditemukan.</p>
      </div>
    );
  }

  const groupedTranscripts = groupTranscripts(alumni.transcripts || []);
  const siblingTotal = alumni.siblingCount ?? (alumni.siblingKandung + alumni.siblingTiri + alumni.siblingAngkat);

  return (
    <>
      {/* ── Non-print toolbar ────────────────────── */}
      <div className="print:hidden fixed top-4 right-4 z-50 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => router.back()}>
          Kembali
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Cetak
        </Button>
      </div>

      {/* ── Print content ─────────────────────────── */}
      <div className="print-content max-w-[210mm] mx-auto bg-white text-black text-[11px] leading-tight font-sans">

        {/* ── Page 1: Header ──────────────────────── */}
        <div className="text-center border-b-2 border-black pb-2 mb-3">
          <div className="flex items-center justify-center gap-3">
            {schoolLogo && (
              <img src={schoolLogo} alt="Logo" className="h-12 object-contain" />
            )}
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wide">{schoolName}</h1>
              <p className="text-[9px]">{schoolAddress}</p>
            </div>
          </div>
          <h2 className="text-sm font-bold mt-3 uppercase border-b border-black inline-block px-8 pb-1">
            Buku Induk Siswa
          </h2>
        </div>

        {/* ── SECTION A: DATA PRIBADI ───────────────── */}
        <Section title="A. Data Pribadi Siswa">
          <div className="flex gap-4 mb-2">
            {/* Photo placeholder */}
            <div className="w-[80px] h-[100px] border border-black flex items-center justify-center text-[8px] text-center text-gray-400 flex-shrink-0">
              foto 3x4
            </div>
            <div className="flex-1">
              <Row label="1. Nama Lengkap" value={alumni.fullName} />
              <Row label="2. Nama Panggilan" value={val(alumni.nickname)} />
              <Row label="3. NISN" value={val(alumni.nisn)} />
              <Row label="4. NIS / No. Induk" value={val(alumni.nis)} />
              <Row label="5. NIK" value={val(alumni.nik)} />
            </div>
          </div>
          <Row label="6. Jenis Kelamin" value={GENDER_LABEL[alumni.gender || ""] || val(alumni.gender)} />
          <Row label="7. Tempat, Tanggal Lahir" value={`${val(alumni.birthPlace)}, ${fmtDate(alumni.birthDate)}`} />
          <Row label="8. Agama" value={val(alumni.religion)} />
          <Row label="9. Kewarganegaraan" value={val(alumni.citizenship, "WNI")} />
          <Row label="10. Anak ke-" value={val(alumni.childOrder)} />
          <Row label="11. Jumlah Saudara (Kandung/Tiri/Angkat)" value={`${siblingTotal} (K:${alumni.siblingKandung}, T:${alumni.siblingTiri}, A:${alumni.siblingAngkat})`} />
          <Row label="12. Bahasa Sehari-hari" value={val(alumni.dailyLanguage)} />
          <Row label="13. Tinggal Bersama" value={val(alumni.livingWith)} />
          <Row label="14. Alamat Lengkap" value={val(alumni.address)} full />
          <Row label="15. Alamat Saat Ini" value={val(alumni.currentAddress)} full />
        </Section>

        {/* ── SECTION B: DATA ORANG TUA / WALI ──────── */}
        <Section title="B. Data Orang Tua / Wali">
          <div className="grid grid-cols-3 gap-x-3 mb-2">
            <div className="font-bold text-[10px] border-b border-black pb-1 mb-1">Ayah</div>
            <div className="font-bold text-[10px] border-b border-black pb-1 mb-1">Ibu</div>
            <div className="font-bold text-[10px] border-b border-black pb-1 mb-1">Wali</div>
            <div className="text-[10px]">
              <div>Nama: {val(alumni.fatherName)}</div>
              <div>NIK: {val(alumni.fatherNik)}</div>
              <div>Pendidikan: {val(alumni.fatherEducation)}</div>
              <div>Pekerjaan: {val(alumni.fatherJob)}</div>
              <div>Penghasilan: {val(alumni.fatherIncome)}</div>
            </div>
            <div className="text-[10px]">
              <div>Nama: {val(alumni.motherName)}</div>
              <div>NIK: {val(alumni.motherNik)}</div>
              <div>Pendidikan: {val(alumni.motherEducation)}</div>
              <div>Pekerjaan: {val(alumni.motherJob)}</div>
              <div>Penghasilan: {val(alumni.motherIncome)}</div>
            </div>
            <div className="text-[10px]">
              <div>Nama: {val(alumni.guardianName)}</div>
              <div>NIK: {val(alumni.guardianNik)}</div>
              <div>Hubungan: {val(alumni.guardianRelation)}</div>
              <div>Pekerjaan: {val(alumni.guardianJob)}</div>
              <div>Pendidikan: {val(alumni.guardianEducation)}</div>
              <div>Telp: {val(alumni.guardianPhone)}</div>
              <div>Penghasilan: {val(alumni.guardianIncome)}</div>
            </div>
          </div>
          <Row label="Nama Orang Tua (Kontak)" value={val(alumni.parentName)} />
          <Row label="No. Telepon Orang Tua" value={val(alumni.parentPhone)} />
          <Row label="Alamat Orang Tua/Wali" value={val(alumni.parentAddress)} full />
        </Section>

        {/* ── SECTION C: RIWAYAT MASUK ──────────────── */}
        <Section title="C. Riwayat Masuk">
          <Row label="1. Tahun Masuk" value={val(alumni.enrolledYear)} />
          <Row label="2. Asal TK/PAUD" value={val(alumni.previousSchool)} full />
          <Row label="3. Alamat TK" value={val(alumni.previousSchoolAddress)} full />
          <Row label="4. No. Surat Keterangan TK" value={val(alumni.previousSchoolCertNo)} />
          <Row label="5. Tanggal STTB/Surat Keterangan TK" value={fmtDate(alumni.previousSchoolCertDate)} />
          {alumni.mutasiMasukAsalSekolah && (
            <>
              <div className="font-bold text-[10px] mt-1 border-b border-black">Mutasi Masuk</div>
              <Row label="Asal Sekolah" value={val(alumni.mutasiMasukAsalSekolah)} full />
              <Row label="Dari Kelas" value={val(alumni.mutasiMasukDariKelas)} />
              <Row label="Diterima Tanggal" value={fmtDate(alumni.mutasiMasukDiterimaTanggal)} />
              <Row label="Diterima di Kelas" value={val(alumni.mutasiMasukDiKelas)} />
            </>
          )}
        </Section>

        {/* ── SECTION D: RIWAYAT PENDIDIKAN ─────────── */}
        <Section title="D. Riwayat Pendidikan">
          <table className="w-full border border-black text-[10px] mb-2">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-1 py-0.5">Kelas</th>
                <th className="border border-black px-1 py-0.5">Tahun Ajaran</th>
                <th className="border border-black px-1 py-0.5">Naik/Tidak</th>
                <th className="border border-black px-1 py-0.5">Wali Kelas</th>
              </tr>
            </thead>
            <tbody>
              {alumni.classHistory && alumni.classHistory.length > 0 ? (
                alumni.classHistory
                  .filter((h) => h.className)
                  .map((h) => (
                    <tr key={h.id}>
                      <td className="border border-black px-1 py-0.5 text-center">{val(h.className)}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{val(h.academicYear)}</td>
                      <td className="border border-black px-1 py-0.5 text-center">
                        {h.status === "promoted" ? "Naik" : h.status === "graduated" ? "Lulus" : val(h.status, "...................................")}
                      </td>
                      <td className="border border-black px-1 py-0.5">...................................</td>
                    </tr>
                  ))
              ) : (
                ["I", "II", "III", "IV", "V", "VI"].map((kelas, i) => {
                  const year = alumni.enrolledYear ? parseInt(alumni.enrolledYear) + i : i + 1;
                  return (
                    <tr key={kelas}>
                      <td className="border border-black px-1 py-0.5 text-center">{kelas}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{year}/{year + 1}</td>
                      <td className="border border-black px-1 py-0.5 text-center">...................................</td>
                      <td className="border border-black px-1 py-0.5">...................................</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <Row label="Lama Belajar" value={`${alumni.classHistory ? Math.min(alumni.classHistory.filter(h => h.className).length, 6) : 6} tahun`} />
        </Section>

        {/* ── SECTION E: KESEHATAN ──────────────────── */}
        <Section title="E. Kesehatan">
          <Row label="1. Golongan Darah" value={val(alumni.bloodType)} />
          <Row label="2. Tinggi Badan (masuk)" value={alumni.height ? `${alumni.height} cm` : "-"} />
          <Row label="3. Berat Badan (masuk)" value={alumni.weight ? `${alumni.weight} kg` : "-"} />
          <Row label="4. Riwayat Penyakit" value={val(alumni.medicalNotes)} full />
          <Row label="5. Kebutuhan Khusus" value={val(alumni.specialNeeds)} full />

          {/* Health records per class */}
          {alumni.healthRecords && alumni.healthRecords.length > 0 && (
            <div className="mt-2">
              <div className="font-bold text-[10px] mb-1 border-b border-black">Catatan Kesehatan Per Kelas</div>
              <table className="w-full border border-black text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black px-1 py-0.5">Kelas</th>
                    <th className="border border-black px-1 py-0.5">TB (cm)</th>
                    <th className="border border-black px-1 py-0.5">BB (kg)</th>
                    <th className="border border-black px-1 py-0.5">Penyakit</th>
                    <th className="border border-black px-1 py-0.5">Kelainan</th>
                  </tr>
                </thead>
                <tbody>
                  {alumni.healthRecords.map((h) => (
                    <tr key={h.id}>
                      <td className="border border-black px-1 py-0.5 text-center">{val(h.year)}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{val(h.height, "-")}</td>
                      <td className="border border-black px-1 py-0.5 text-center">{val(h.weight, "-")}</td>
                      <td className="border border-black px-1 py-0.5">{val(h.illness, "-")}</td>
                      <td className="border border-black px-1 py-0.5">{val(h.abnormality, "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* ── PAGE BREAK ───────────────────────────── */}
        <div className="page-break" />

        {/* ── SECTION F: PRESTASI ───────────────────── */}
        <Section title="F. Prestasi">
          {alumni.achievements && alumni.achievements.length > 0 ? (
            <table className="w-full border border-black text-[10px] mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-1 py-0.5">No</th>
                  <th className="border border-black px-1 py-0.5">Jenis</th>
                  <th className="border border-black px-1 py-0.5">Nama Prestasi</th>
                  <th className="border border-black px-1 py-0.5">Tingkat</th>
                  <th className="border border-black px-1 py-0.5">Peringkat</th>
                  <th className="border border-black px-1 py-0.5">Tahun</th>
                  <th className="border border-black px-1 py-0.5">Penyelenggara</th>
                </tr>
              </thead>
              <tbody>
                {alumni.achievements.map((a, i) => (
                  <tr key={a.id}>
                    <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.type === "academic" ? "Akademik" : "Non-Akademik"}</td>
                    <td className="border border-black px-1 py-0.5">{a.title}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.level}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{val(a.ranking, "-")}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.year}</td>
                    <td className="border border-black px-1 py-0.5">{val(a.organizer, "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] italic text-gray-500">Tidak ada data prestasi.</p>
          )}
        </Section>

        {/* ── SECTION G: EKSTRAKURIKULER ────────────── */}
        <Section title="G. Ekstrakurikuler">
          {alumni.extracurriculars && alumni.extracurriculars.length > 0 ? (
            <table className="w-full border border-black text-[10px] mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-1 py-0.5">No</th>
                  <th className="border border-black px-1 py-0.5">Nama Kegiatan</th>
                  <th className="border border-black px-1 py-0.5">Peran</th>
                  <th className="border border-black px-1 py-0.5">Tahun Mulai</th>
                  <th className="border border-black px-1 py-0.5">Tahun Selesai</th>
                </tr>
              </thead>
              <tbody>
                {alumni.extracurriculars.map((e, i) => (
                  <tr key={e.id}>
                    <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                    <td className="border border-black px-1 py-0.5">{e.activityName}</td>
                    <td className="border border-black px-1 py-0.5">{val(e.role, "-")}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{val(e.yearStart, "-")}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{val(e.yearEnd, "-")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] italic text-gray-500">Tidak ada data ekstrakurikuler.</p>
          )}
        </Section>

        {/* ── SECTION H: KEHADIRAN ──────────────────── */}
        <Section title="H. Ringkasan Kehadiran">
          {alumni.attendanceSummaries && alumni.attendanceSummaries.length > 0 ? (
            <table className="w-full border border-black text-[10px] mb-2">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-black px-1 py-0.5">Tahun</th>
                  <th className="border border-black px-1 py-0.5">Smtr</th>
                  <th className="border border-black px-1 py-0.5">Hadir</th>
                  <th className="border border-black px-1 py-0.5">Sakit</th>
                  <th className="border border-black px-1 py-0.5">Izin</th>
                  <th className="border border-black px-1 py-0.5">Alpha</th>
                  <th className="border border-black px-1 py-0.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {alumni.attendanceSummaries.map((a) => (
                  <tr key={a.id}>
                    <td className="border border-black px-1 py-0.5 text-center">{a.academicYear}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.semester}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.present}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.sick}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.permission}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.absent}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{a.totalDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[10px] italic text-gray-500">Tidak ada data kehadiran.</p>
          )}
        </Section>

        {/* ── SECTION I: NILAI ──────────────────────── */}
        <Section title="I. Transkrip Nilai">
          {groupedTranscripts.length > 0 ? (
            <div className="space-y-2">
              {groupedTranscripts.map((group) => (
                <div key={group.academicYear}>
                  <div className="font-bold text-[10px] bg-gray-100 border border-black px-1 py-0.5">
                    Tahun Ajaran: {group.academicYear}
                  </div>
                  {group.semesters.map((sm) => (
                    <div key={sm.semester} className="mb-1">
                      <div className="text-[10px] font-semibold px-1">
                        Semester {sm.semester}
                      </div>
                      <table className="w-full border border-black text-[10px]">
                        <thead>
                          <tr>
                            <th className="border border-black px-1 py-0.5 w-6">No</th>
                            <th className="border border-black px-1 py-0.5">Mata Pelajaran</th>
                            <th className="border border-black px-1 py-0.5 w-16">Nilai</th>
                            <th className="border border-black px-1 py-0.5 w-16">Huruf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sm.subjects.map((s, i) => (
                            <tr key={s.id}>
                              <td className="border border-black px-1 py-0.5 text-center">{i + 1}</td>
                              <td className="border border-black px-1 py-0.5">{s.subjectName}</td>
                              <td className="border border-black px-1 py-0.5 text-center">{s.score}</td>
                              <td className="border border-black px-1 py-0.5 text-center">{val(s.scoreLetter, "-")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] italic text-gray-500">Tidak ada data nilai.</p>
          )}
          {alumni.finalGradeAvg !== null && alumni.finalGradeAvg !== undefined && (
            <Row label="Nilai Rata-Rata Akhir" value={alumni.finalGradeAvg.toFixed(2)} />
          )}
        </Section>

        {/* ── SECTION J: STATUS & KELULUSAN ──────────── */}
        <Section title="J. Status & Kelulusan / Mutasi Keluar">
          <Row label="Status Saat Ini" value={STATUS_LABEL[alumni.status] || alumni.status} />
          {alumni.status === "graduated" && (
            <>
              <Row label="Tahun Lulus" value={val(alumni.graduationYear)} />
              <Row label="Tanggal Lulus" value={fmtDate(alumni.graduationDate)} />
              <Row label="Kelas Terakhir" value={val(alumni.finalClass)} />
              <Row label="No. Ijazah" value={val(alumni.ijazahNo)} />
              <Row label="Tanggal Ijazah" value={fmtDate(alumni.ijazahDate)} />
              <Row label="No. SKHUN" value={val(alumni.skhunNo)} />
              <Row label="Tanggal SKHUN" value={fmtDate(alumni.skhunDate)} />
              <Row label="Melanjutkan ke (SMP)" value={val(alumni.nextSchool)} full />
            </>
          )}
          {alumni.status === "transferred" && (
            <>
              <Row label="Tanggal Mutasi Keluar" value={fmtDate(alumni.mutationOutDate)} />
              <Row label="Sekolah Tujuan" value={val(alumni.mutationOutToSchool)} full />
              <Row label="Kelas Tujuan" value={val(alumni.mutationOutToClass)} />
              <Row label="Kelas Saat Keluar" value={val(alumni.mutationOutClass)} />
            </>
          )}
          {alumni.status === "dropped" && (
            <>
              <Row label="Tanggal Keluar (DO)" value={fmtDate(alumni.droppedOutDate)} />
              <Row label="Alasan Keluar" value={val(alumni.droppedOutReason)} full />
            </>
          )}
        </Section>

        {/* ── SECTION K: BEASISWA ───────────────────── */}
        <Section title="K. Beasiswa">
          <Row label="Informasi Beasiswa" value={val(alumni.scholarshipInfo, "Tidak ada informasi beasiswa.")} full />
        </Section>

        {/* ── SECTION L: CATATAN ────────────────────── */}
        <Section title="L. Catatan">
          <Row label="Catatan Khusus" value={val(alumni.scholarshipInfo, "")} full />
          <div className="border border-black p-2 min-h-[60px] text-[10px] text-gray-400">
            ......................................
          </div>
        </Section>

        {/* ── PAGE BREAK BEFORE SIGNATURES ─────────── */}
        <div className="page-break" />

        {/* ── SIGNATURE BLOCK ──────────────────────── */}
        <div className="mt-8 flex justify-between text-center text-[11px]">
          <div className="flex-1">
            <p>Mengetahui,</p>
            <p className="font-bold">Kepala Sekolah</p>
            <p className="mt-16">......................................</p>
            <p>NIP. ......................................</p>
          </div>
          <div className="flex-1">
            <p>{schoolAddress.split(",")[0] || "............"}, .................... 20.....</p>
            <p className="font-bold">Guru Kelas / Wali Kelas</p>
            <p className="mt-16">......................................</p>
            <p>NIP. ......................................</p>
          </div>
        </div>
      </div>

      {/* ── Print styles ────────────────────────────── */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 12mm 10mm 12mm 10mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-content {
            max-width: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
        .print-content {
          font-family: "Times New Roman", Times, serif;
        }
      `}</style>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-[11px] font-bold border-b border-black pb-0.5 mb-2 uppercase bg-gray-100 px-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`flex text-[10px] py-0.5 ${full ? "" : "border-b border-dotted border-gray-300"}`}>
      <span className="font-semibold w-[200px] flex-shrink-0">{label}</span>
      <span className="flex-1 border-b border-dotted border-gray-400 mx-1" />
      <span className="text-right min-w-[120px]">{value}</span>
    </div>
  );
}
