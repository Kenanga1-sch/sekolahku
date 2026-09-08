"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { goGet } from "@/lib/api-client";
import {
    buildTranscriptGrid,
    buildPrintMeta,
    fmtTanggalID,
    yearSortKey,
    buildPromotionMap,
} from "./_lib/transcript";
import { KopHeader } from "./_components/kop-header";
import { Section } from "./_components/section";
import { FieldGrid, FieldItem, ParentColumns, ParentColumn } from "./_components/field-grid";
import { PhotoBox } from "./_components/photo-box";
import { TranscriptTable } from "./_components/transcript-table";
import { AttendanceTable } from "./_components/attendance-table";

export default function BukuIndukGabunganPrintPage() {
    const searchParams = useSearchParams();
    const studentId = searchParams.get("id");
    const studentIdsParam = searchParams.get("ids");
    const typeParam = searchParams.get("type");

    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ids = studentIdsParam ? studentIdsParam.split(",") : studentId ? [studentId] : [];
        if (ids.length === 0) {
            setLoading(false);
            return;
        }

        const fetchAll = async () => {
            try {
                const results = await Promise.all(
                    ids.map((id) => {
                        const endpoint =
                            typeParam === "alumni" ? `/api/alumni/${id}` : `/api/master/students/${id}`;
                        return goGet(endpoint).catch(() => null);
                    })
                );

                const validStudents = results
                    .filter((s) => s && s.data)
                    .map((s) => {
                        const student = s.data;
                        // Untuk siswa aktif, backend mengembalikan relasi Buku Induk sebagai
                        // field terpisah di sebelah `data`; satukan agar shape sama dengan alumni.
                        const transcripts = student.transcripts || s.transcripts || [];
                        const healthRecords = student.healthRecords || s.healthRecords || [];
                        const attendanceSummaries = student.attendanceSummaries || s.attendanceSummaries || [];
                        const classHistory = student.classHistory || s.classHistory || [];
                        let meta = {};
                        if (student.metaData) {
                            try {
                                meta = JSON.parse(student.metaData);
                            } catch (e) {
                                /* abaikan */
                            }
                        }
                        return { ...student, meta, transcripts, healthRecords, attendanceSummaries, classHistory };
                    });

                setStudents(validStudents);

                if (validStudents.length > 0) {
                    setTimeout(() => window.print(), 1000);
                }
            } catch (error) {
                console.error("Gagal mengambil data siswa", error);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [studentId, studentIdsParam, typeParam]);

    if (loading) return <div className="p-8 text-center font-sans">Memuat dokumen cetak...</div>;
    if (students.length === 0) return <div className="p-8 text-center font-sans">Data tidak ditemukan.</div>;

    // Jenis kelamin: tulis satu kata saja (tanpa pola coret).
    const genderLabel = (g?: string | null) =>
        g === "L" ? "Laki-laki" : g === "P" ? "Perempuan" : "";

    // Status buku induk → label Indonesia yang rapi.
    const statusLabel = (s?: string | null) => {
        switch ((s || "").toLowerCase()) {
            case "active": return "Aktif";
            case "graduated": return "Lulus";
            case "transferred": return "Pindah / Mutasi Keluar";
            case "dropped": return "Keluar / Putus Sekolah";
            default: return s || "";
        }
    };

    return (
        <div className="print-root">
            {students.map((student, index) => {
                const meta = buildPrintMeta(student);
                const { grid, yearLabels } = buildTranscriptGrid(student);

                // Perkembangan jasmani: sumber utama adalah tab Kesehatan (healthRecords).
                // Fallback ke kolom statis bila riwayat belum diisi.
                const healthRecords: any[] = student.healthRecords || [];

                // Riwayat naik kelas (sumber: student_class_history) untuk baris Naik/Tidak.
                const promotions = buildPromotionMap(student, student.classHistory);

                // ── A. KETERANGAN SISWA ──
                // Berat/Tinggi/Penyakit/Kelainan sengaja TIDAK dicetak di sini:
                // keempatnya sudah tercakup di tabel "3. Perkembangan Jasmani & Kesehatan".
                const fieldsA: FieldItem[] = [
                    { label: "Nama Lengkap", value: student.fullName, full: true },
                    { label: "NIS", value: student.nis },
                    { label: "NISN", value: student.nisn },
                    { label: "NIK", value: student.nik },
                    { label: "Tahun Masuk", value: meta.tahunMasuk },
                    { label: "Kelas", value: student.className || student.finalClass },
                    { label: "Status", value: statusLabel(student.status) },
                    { label: "Nama Panggilan", value: meta.namaPanggilan },
                    { label: "Jenis Kelamin", value: genderLabel(student.gender) },
                    { label: "Tanggal Lahir", value: fmtTanggalID(student.birthDate) },
                    { label: "Tempat Lahir", value: student.birthPlace },
                    { label: "Agama", value: student.religion },
                    { label: "Kewarganegaraan", value: meta.kewarganegaraan },
                    { label: "Anak Ke-", value: student.childOrder },
                    { label: "Jumlah Saudara", value: student.siblingCount },
                    { label: "Saudara Kandung", value: meta.jumlahSaudaraKandung },
                    { label: "Saudara Tiri", value: meta.jumlahSaudaraTiri },
                    { label: "Saudara Angkat", value: meta.jumlahSaudaraAngkat },
                    { label: "Bahasa Sehari-hari", value: meta.bahasaSehariHari },
                    { label: "Golongan Darah", value: meta.golDarah },
                    { label: "Alamat", value: student.address, full: true },
                    { label: "No. Telepon", value: student.parentPhone },
                    { label: "Bertempat Tinggal Pada", value: meta.jenisTinggal },
                ];

                // ── B. ORANG TUA / WALI ──
                // Dikelompokkan per-orang (Ayah | Ibu | Wali) agar urutan baca vertikal
                // per orang, bukan melompat menyamping. Ketiga kolom dibuat SERAGAM
                // (lima field yang sama) supaya tidak ada ruang vertikal terbuang akibat
                // kolom terpanjang. Data silang-antarmuka (nama ortu, hubungan wali,
                // telepon, alamat ortu) diletakkan pada baris penuh di bawahnya.
                const parentColumns: ParentColumn[] = [
                    {
                        title: "Ayah",
                        items: [
                            { label: "Nama", value: student.fatherName },
                            { label: "NIK", value: student.fatherNik },
                            { label: "Pendidikan", value: meta.fatherEducation },
                            { label: "Pekerjaan", value: meta.fatherJob },
                            { label: "Penghasilan", value: student.fatherIncome },
                        ],
                    },
                    {
                        title: "Ibu",
                        items: [
                            { label: "Nama", value: student.motherName },
                            { label: "NIK", value: student.motherNik },
                            { label: "Pendidikan", value: meta.motherEducation },
                            { label: "Pekerjaan", value: meta.motherJob },
                            { label: "Penghasilan", value: student.motherIncome },
                        ],
                    },
                    {
                        title: "Wali",
                        items: [
                            { label: "Nama", value: student.guardianName },
                            { label: "NIK", value: student.guardianNik },
                            { label: "Pendidikan", value: meta.guardianEducation },
                            { label: "Pekerjaan", value: meta.guardianJob },
                            { label: "Penghasilan", value: student.guardianIncome },
                        ],
                    },
                ];

                const fieldsBawah: FieldItem[] = [
                    { label: "Nama Orang Tua", value: student.parentName },
                    { label: "Hubungan Wali", value: meta.guardianRelation },
                    { label: "Telepon Orang Tua", value: student.parentPhone },
                    { label: "Telepon Wali", value: student.guardianPhone },
                    { label: "Alamat Orang Tua", value: student.parentAddress, full: true },
                ];

                // ── C. PERKEMBANGAN ──
                // Isian teks-panjang dibuat full-width agar ada ruang menulis.
                const fieldsC1: FieldItem[] = [
                    { label: "Asal Siswa", value: meta.asalSiswa },
                    { label: "Nama TK", value: meta.namaTk },
                    { label: "Alamat TK", value: meta.alamatTk, full: true },
                    { label: "No. SK/STTB TK", value: meta.skTk, full: true },
                    { label: "Tgl. SK/STTB TK", value: fmtTanggalID(student.previousSchoolCertDate), full: true },
                ];
                const fieldsC2: FieldItem[] = [
                    { label: "Asal Sekolah", value: meta.mutasiAsalSekolah, full: true },
                    { label: "Dari Kelas", value: meta.mutasiDariKelas },
                    { label: "Diterima Tanggal", value: fmtTanggalID(meta.mutasiDiterimaTanggal) },
                    { label: "Di Kelas", value: meta.mutasiDiKelas },
                ];

                // ── E. MENINGGALKAN SEKOLAH ──
                const fieldsE: FieldItem[] = [
                    { label: "Tamat Tahun", value: meta.tamatTahun },
                    { label: "Tgl. Lulus", value: fmtTanggalID(student.graduationDate) },
                    { label: "Kelas Terakhir", value: student.finalClass },
                    { label: "Nilai Rata-rata Akhir", value: student.finalGradeAvg },
                    { label: "No. Ijazah", value: meta.tamatNoIjazah },
                    { label: "Tgl. Ijazah", value: fmtTanggalID(student.ijazahDate) },
                    { label: "No. SKHUN", value: student.skhunNo, full: true },
                    { label: "Tgl. SKHUN", value: fmtTanggalID(student.skhunDate), full: true },
                    { label: "Melanjutkan Ke", value: meta.melanjutkanKe, full: true },
                    { label: "Pindah Dari Kelas", value: meta.pindahDariKelas },
                    { label: "Pindah Ke Kelas", value: meta.pindahKeKelas },
                    { label: "Pindah Ke Sekolah", value: meta.pindahKeSekolah, full: true },
                    { label: "Pindah Tanggal", value: fmtTanggalID(meta.pindahTanggal) },
                    { label: "Keluar Tanggal", value: fmtTanggalID(meta.keluarTanggal) },
                    { label: "Alasan Keluar", value: meta.keluarAlasan, full: true },
                ];

                // ── F. LAIN-LAIN (penelusuran alumni) ──
                const fieldsF: FieldItem[] = [
                    { label: "Alamat Saat Ini", value: student.currentAddress, full: true },
                    { label: "Telepon Saat Ini", value: student.currentPhone },
                    { label: "Email", value: student.currentEmail },
                    { label: "Pendidikan Terakhir", value: student.lastEducationLevel },
                    { label: "Institusi Saat Ini", value: student.currentInstitution },
                    { label: "Pekerjaan Saat Ini", value: student.currentOccupation, full: true },
                ];

                return (
                    <div key={student.id || index} className="student-print-set">
                        {/* ============ HALAMAN 1 — PORTRAIT ============ */}
                        <div className="page portrait-page">
                            <KopHeader
                                registerNo={student.registerNo}
                                bukuNo={student.bukuFisikNo}
                                photo={<PhotoBox photo={student.photo} name={student.fullName} label="Kelas I" />}
                            />

                            <Section marker="A" title="KETERANGAN SISWA">
                                <FieldGrid items={fieldsA} cols={3} />
                            </Section>

                            <Section marker="B" title="KETERANGAN ORANG TUA / WALI SISWA">
                                <ParentColumns columns={parentColumns} />
                                <FieldGrid items={fieldsBawah} cols={3} className="parent-bawah" />
                            </Section>

                            <Section marker="C" title="PERKEMBANGAN SISWA">
                                <div className="subsection">
                                    <h3 className="subsection-title">1. Pendidikan Sebelumnya</h3>
                                    <div className="subsection-splitted">
                                        <div className="subsection-block">
                                            <p className="subsection-sub">a. Masuk menjadi siswa baru kelas I</p>
                                            <FieldGrid items={fieldsC1} />
                                        </div>
                                        <div className="subsection-block">
                                            <p className="subsection-sub">b. Pindahan dari sekolah lain</p>
                                            <FieldGrid items={fieldsC2} />
                                        </div>
                                    </div>
                                </div>
                            </Section>
                        </div>

                        {/* ============ HALAMAN 2 — PORTRAIT ============
                            Lanjutan seksi C (nomor 3) tanpa mengulang heading "C. PERKEMBANGAN
                            SISWA (lanjutan)": nomor 2 memang berada di lembar landscape
                            (C.2 Prestasi Belajar), jadi penomoran 1 → 3 tetap konsisten. */}
                        <div className="page portrait-page">
                            <div className="subsection subsection-top">
                                <h3 className="subsection-title">3. Perkembangan Jasmani &amp; Kesehatan</h3>
                                <JasmaniTable records={healthRecords} />
                            </div>

                            <Section marker="D" title="BEA SISWA">
                                <FieldGrid
                                    items={[
                                        { label: "Jenis Bea Siswa", value: meta.jenisBeasiswa, full: true },
                                        { label: "KIP (Kartu Indonesia Pintar)", value: student.kip, full: true },
                                    ]}
                                />
                            </Section>

                            <Section marker="E" title="MENINGGALKAN SEKOLAH">
                                <FieldGrid items={fieldsE} cols={3} />
                            </Section>

                            <Section marker="F" title="LAIN-LAIN">
                                <FieldGrid items={fieldsF} />
                                <div className="lain-lain">
                                    <p className="lain-lain-head">
                                        <span className="lain-lain-label">Catatan yang penting</span>
                                        <span className="field-colon">:</span>
                                        <span className="lain-lain-text">{meta.catatanLain || ""}</span>
                                    </p>
                                    <div className="lain-space" />
                                    <div className="lain-space" />
                                    <div className="lain-space" />
                                    <div className="lain-space" />
                                </div>
                            </Section>

                            <div className="portrait-footer">
                                {/* Foto dikelompokkan di tepi terluar (kanan): Mutasi lalu Kelas VI paling luar */}
                                <div className="footer-photo">
                                    <PhotoBox photo={student.photo} name={student.fullName} label="Mutasi" />
                                </div>
                                <div className="footer-photo">
                                    <PhotoBox photo={student.photo} name={student.fullName} label="Kelas VI" />
                                </div>
                            </div>
                        </div>

                        {/* ============ HALAMAN 3 — LANDSCAPE ============ */}
                        <div className="page landscape-page">
                            <div className="landscape-head">
                                <h2 className="landscape-title">C.2. PRESTASI BELAJAR</h2>
                            </div>
                            <TranscriptTable grid={grid} yearLabels={yearLabels} promotions={promotions} />
                            <AttendanceTable records={student.attendanceSummaries} />
                        </div>
                    </div>
                );
            })}

            <style jsx global>{PRINT_CSS}</style>
        </div>
    );
}

// ─── Tabel Perkembangan Jasmani ───
// Kolom = tahun dari `alumni_health_records` (yang sudah bisa diisi lewat tab Kesehatan).
// Baris: a) Tahun · b) Berat badan · c) Tinggi badan · d) Penyakit · e) Kelainan jasmani.
// Bila belum ada data, tetap disediakan kolom kosong untuk isian manual.
const JASMANI_MIN_COLS = 6;

function JasmaniTable({ records }: { records?: any[] }) {
    const list = (records || [])
        .filter((r) => r && (r.year || r.weight || r.height || r.illness || r.abnormality))
        .slice()
        .sort((a, b) => yearSortKey(a.year) - yearSortKey(b.year)); // urut menaik: Kelas I → VI

    const colCount = Math.max(JASMANI_MIN_COLS, list.length);

    const rows: [string, string, ((r: any) => string), string?][] = [
        ["a", "Tahun", (r) => r.year ?? ""],
        ["b", "Berat badan", (r) => (r.weight ? String(r.weight) : ""), "kg"],
        ["c", "Tinggi badan", (r) => (r.height ? String(r.height) : ""), "cm"],
        ["d", "Penyakit", (r) => r.illness ?? ""],
        ["e", "Kelainan jasmani", (r) => r.abnormality ?? ""],
    ];

    return (
        <table className="jasmani-table">
            <tbody>
                {rows.map(([no, label, get, unit]) => (
                    <tr key={no}>
                        <td className="jas-no">{no}</td>
                        <td className="jas-label">{label}</td>
                        {Array.from({ length: colCount }).map((_, i) => {
                            const rec = list[i];
                            const val = rec ? get(rec) : "";
                            return (
                                <td key={i} className="jas-cell">
                                    <span className="jas-value">{val}</span>
                                    {unit && <span className="jas-unit">{unit}</span>}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ═══════════════════════ CSS CETAK ═══════════════════════
const PRINT_CSS = `
    :root {
        --ink: #111;
        --ink-soft: #444;
        --ink-faint: #777;
        --line: #999;
        --line-soft: #c9c9c9;
        --gap: 6px;
    }

    body { background: #ececec; }

    .print-root {
        color: var(--ink);
        font-family: Georgia, "Times New Roman", serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .student-print-set { display: block; }

    .page {
        background: #fff;
        margin: 18px auto;
        box-shadow: 0 1px 8px rgba(0,0,0,.18);
        position: relative;
    }
    .portrait-page  { width: 21cm;   min-height: 29.7cm; padding: 1.1cm 1.3cm 1.1cm 2.2cm; }
    .landscape-page { width: 29.7cm; min-height: 21cm;   padding: 0.9cm 1cm; }

    /* ── Kop: No. Urut (kiri) · Judul (center) · Foto (kanan) ── */
    .kop-header {
        display: grid; grid-template-columns: 1fr auto 1fr;
        align-items: start; gap: 12px; margin-bottom: 10px;
    }
    .kop-no { justify-self: start; display: flex; align-items: baseline; gap: 4px; margin-top: 4px; }
    .kop-no-label { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt; color: var(--ink-soft); }
    .kop-no-label::after { content: ":"; }
    .kop-no-line { display: inline-block; min-width: 1.6cm; border-bottom: 1px solid var(--ink-soft); font-size: 10pt; text-align: center; }
    .kop-buku-label { margin-left: 10px; }
    .kop-title {
        justify-self: center; text-align: center;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 20pt; font-weight: 700; letter-spacing: .5px; margin: 0;
    }
    .kop-photo { justify-self: end; }

    /* ── Seksi ── */
    .print-section { margin-bottom: 13px; break-inside: avoid; }
    .section-heading {
        display: flex; align-items: baseline; gap: 4px;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 10pt; font-weight: 700; letter-spacing: .6px;
        text-transform: uppercase; margin: 0 0 6px;
    }
    .section-marker { color: var(--ink); }
    .section-cont { margin-top: 0; }

    /* ── Kolom per-orang: Ayah | Ibu | Wali (ketiganya seragam) ── */
    .parent-cols { display: grid; grid-template-columns: 1fr 1fr 1fr; column-gap: 12px; }
    .parent-col { min-width: 0; }
    .parent-col-title {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt; font-weight: 700;
        text-transform: uppercase; letter-spacing: .4px;
        margin: 0 0 3px; padding-bottom: 1px; border-bottom: 1px solid var(--line-soft);
    }
    .parent-grid { grid-template-columns: 1fr; row-gap: 2px; }
    .parent-grid .field-row { grid-template-columns: 1.9cm auto 1fr; }
    .parent-grid .field-label { font-size: 8pt; }
    .parent-grid .field-value { font-size: 9pt; }
    /* Baris penuh di bawah kolom: data silang antar-orang (nama/hubungan/telepon/alamat). */
    .parent-bawah { margin-top: 5px; }
    .parent-bawah .field-label { font-size: 8.5pt; }

    /* ── Field grid: [label | : | nilai] per baris → ":" sejajar ── */
    .field-grid {
        display: grid; grid-template-columns: 1fr 1fr;
        column-gap: 18px; row-gap: 2px; margin: 0;
    }
    .field-row {
        display: grid; grid-template-columns: 3.6cm auto 1fr;
        align-items: baseline; column-gap: 5px; min-width: 0;
    }
    .field-full { grid-column: 1 / -1; grid-template-columns: 3.6cm auto 1fr; }
    /* Varian 3 kolom untuk field bernilai pendek → hemat ±35% ruang vertikal */
    .field-cols-3 { grid-template-columns: 1fr 1fr 1fr; column-gap: 14px; }
    .field-cols-3 .field-row { grid-template-columns: 2.9cm auto 1fr; }
    .field-cols-3 .field-full { grid-column: 1 / -1; grid-template-columns: 2.9cm auto 1fr; }
    .field-cols-3 .field-label { font-size: 8.5pt; }
    .field-cols-3 .field-value { font-size: 9.5pt; }
    .field-label {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt;
        color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .field-colon { font-size: 9pt; color: var(--ink-soft); }
    .field-dd { margin: 0; min-width: 0; }
    .field-value {
        display: block; font-size: 10pt; min-height: 1.1em;
        word-break: break-word;
    }
    .field-empty { color: var(--ink-faint); }

    /* ── Subseksi (Perkembangan) — judul & isi bertingkat + spasi ── */
    .subsection { margin-bottom: 12px; }
    /* Subseksi pertama di awal halaman: tidak perlu jarak atas ekstra. */
    .subsection-top { margin-top: 0; }
    .subsection-title {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9.5pt; font-weight: 700;
        margin: 10px 0 5px; padding-left: 4px;
    }
    .subsection-top .subsection-title { margin-top: 0; }
    .subsection-sub {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8.5pt; font-style: italic;
        color: var(--ink-faint); margin: 0 0 3px; padding-left: 0;
    }
    .subsection-block { margin-bottom: 8px; padding-left: 12px; }
    .subsection-block .field-grid { grid-template-columns: 1fr 1fr; }
    .subsection-block .field-row { grid-template-columns: 3.2cm auto 1fr; }
    .subsection-block .field-full { grid-template-columns: 3.2cm auto 1fr; }

    /* C.1: sub-bagian a & b disusun berdampingan (hemat tinggi ±16mm) */
    .subsection-splitted { display: grid; grid-template-columns: 1fr 1fr; column-gap: 12px; }
    .subsection-splitted .subsection-block { margin-bottom: 0; }
    .subsection-splitted .subsection-block .field-grid { grid-template-columns: 1fr; }

    /* ── Tabel jasmani ── */
    .jasmani-table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .jasmani-table td { border: 1px solid var(--line); padding: 4px 6px; }
    .jas-no { width: 22px; text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; color: var(--ink-faint); }
    .jas-label { width: 34%; font-family: ui-sans-serif, system-ui, sans-serif; }
    .jas-cell { position: relative; }
    .jas-value { display: inline-block; min-height: 1em; font-size: 9pt; }
    .jas-unit { position: absolute; right: 6px; bottom: 4px; font-size: 8pt; color: var(--ink-faint); }

    .prestasi-note { display: none; } /* tidak dipakai lagi */

    /* ── Lain-lain ── */
    .lain-lain-head { display: flex; align-items: baseline; gap: 6px; margin: 0 0 4px; }
    .lain-lain-label {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt;
        color: var(--ink-soft); white-space: nowrap;
    }
    .lain-lain-text { font-size: 10pt; min-height: 1.2em; word-break: break-word; }
    .lain-space { height: 1.5em; }

    /* ── Footer portrait (foto dikelompokkan di tepi terluar/kanan) ── */
    .portrait-footer {
        display: flex; align-items: flex-end; justify-content: flex-end;
        gap: 12px; margin-top: 18px;
    }
    .footer-photo { flex: none; }

    /* ── Landscape (Prestasi + Kehadiran) ── */
    .landscape-head { margin-bottom: 8px; }
    .landscape-title { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 12pt; font-weight: 700; letter-spacing: .5px; margin: 0; }

    .transcript-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; table-layout: fixed; }
    .transcript-table th, .transcript-table td { border: 1px solid var(--ink); }
    .col-subject { width: 15%; }
    .col-score { width: 7.08%; }
    .th-subject { padding: 4px 6px; text-align: left; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8.5pt; vertical-align: middle; }
    .th-class { padding: 3px 4px; text-align: center; }
    .th-year { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8pt; font-weight: 400; color: var(--ink-soft); }
    .th-kelas { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 9pt; font-weight: 700; }
    .th-sem { text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8pt; padding: 2px; background: #f3f3f3; }
    /* Baris mapel diseragamkan tingginya: muat 2 baris teks mapel. */
    .transcript-table tbody tr { height: 0.55cm; }
    .td-subject { padding: 3px 6px; text-align: left; text-transform: uppercase; font-size: 8pt; line-height: 1.15; word-break: break-word; vertical-align: middle; }
    .td-agg { font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 700; font-size: 8pt; vertical-align: middle; }
    .td-score { text-align: center; padding: 3px 2px; font-variant-numeric: tabular-nums; vertical-align: middle; }
    .td-naik { text-align: center; font-size: 7.5pt; color: var(--ink-soft); vertical-align: middle; }

    /* ── Rekap Kehadiran (dua tabel berdampingan, hemat tinggi) ── */
    .attendance-block { margin-top: 8px; break-inside: avoid; }
    .attendance-title {
        font-family: ui-sans-serif, system-ui, sans-serif; font-size: 10pt;
        font-weight: 700; letter-spacing: .5px; margin: 0 0 4px;
    }
    .attendance-cols { display: flex; gap: 14px; }
    .attendance-table { flex: 1; width: 50%; border-collapse: collapse; font-size: 8pt; table-layout: fixed; }
    .attendance-table th, .attendance-table td { border: 1px solid var(--ink); }
    .at-th {
        padding: 2px 3px; text-align: center; font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 7.5pt; background: #f3f3f3;
    }
    /* Garis pemisah tegas antara kolom TAHUN dan SMT (tanpa ini border-collapse
       menyatukan kedua sel sehingga tahun & semester tampak menyambung). */
    .at-col-sep { border-right: 1px solid var(--ink); }
    .at-sep { border-right: 1px solid var(--ink); }
    .attendance-table tr { height: 0.45cm; }
    .at-td { text-align: center; padding: 2px 3px; font-variant-numeric: tabular-nums; vertical-align: middle; }
    .at-left { text-align: left; }

    /* ── Cetak ── */
    @page portrait-page  { size: A4 portrait;  margin: 1.1cm 1.3cm 1.1cm 2.2cm; }
    @page landscape-page { size: A4 landscape; margin: 0.9cm 1cm; }

    @media print {
        body { background: #fff; }

        /* Chrome hanya menghormati named pages (@page portrait-page / landscape-page)
           bila seluruh konten berada dalam aliran normal. Karena itu:
           1) chrome dashboard disembunyikan lewat display:none (bukan visibility:hidden,
              yang tetap menyisakan ruang layout dan memaksa position:absolute),
           2) kunci tinggi/overflow pada rantai wrapper dashboard dilepas. */
        body > div[class*="fixed"], body > next-route-announcer, body > a[class*="sr-only"],
        /* Route announcer Next.js (body>section) tingginya 0 tetapi tetap menempati
           aliran dokumen SETELAH .print-root — pada dokumen yang berakhir break
           landscape, ia jatuh ke halaman kosong ekstra. Sembunyikan total. */
        body > section {
            display: none !important;
        }
        html, body { height: auto !important; overflow: visible !important; }
        body > div:not([class*="print:hidden"]),
        body > div > div:not([class*="print:hidden"]),
        body > div > div > div:not([class*="print:hidden"]),
        main {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
        }

        .print-root { position: static !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }

        /* Saat cetak, margin kertas sudah diatur oleh @page. Jika elemen .page juga
           memakai padding + min-height setinggi kertas, totalnya MELAMPAUI area cetak
           (mis. 29.7cm + 2×1.1cm padding > 29.7cm) sehingga Chrome membelahnya ke
           halaman baru — inilah penyebab halaman kosong ekstra. Nol-kan padding dan
           min-height khusus mode cetak. */
        .page { margin: 0; box-shadow: none; padding: 0 !important; min-height: 0 !important; }
        /* Pemecahan halaman memakai break-before (bukan break-after):
           break-after pada halaman TERAKHIR selalu menyisakan satu halaman
           kosong di akhir dokumen, yang ikut orientasi halaman sebelumnya. */
        .page + .page { break-before: page; page-break-before: always; }
        .student-print-set + .student-print-set .page:first-child { break-before: page; page-break-before: always; }

        /* Lebar = area cetak persis (kertas − margin @page). Jika dibiarkan 21cm penuh
           atau auto (lebar viewport), konten tumpah horizontal dan Chrome membelah
           dokumen menjadi halaman-halaman ekstra. */
        .portrait-page  { page: portrait-page;  width: 17.5cm !important; }
        .landscape-page { page: landscape-page; width: 27.7cm !important; }
        table, .print-section, .subsection { page-break-inside: avoid; }
    }
`;
