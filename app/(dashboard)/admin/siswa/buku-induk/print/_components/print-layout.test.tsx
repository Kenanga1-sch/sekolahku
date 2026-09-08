import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KopHeader } from "./kop-header";
import { Section } from "./section";
import { FieldGrid, ParentColumns } from "./field-grid";
import { PhotoBox } from "./photo-box";
import { TranscriptTable } from "./transcript-table";
import { AttendanceTable } from "./attendance-table";

// Rakit satu halaman portrait + landscape dengan data tiruan,
// memastikan seluruh komponen merender tanpa error & memuat label kunci.
describe("Print layout components render", () => {
    const grid = {
        I: { Matematika: { "1": 85, "2": 88 }, "Bahasa Indonesia": { "1": 80 } },
        II: { Matematika: { "1": 90 } },
    };
    const yearLabels = { I: "2020/2021", II: "2021/2022" };

    const html = renderToStaticMarkup(
        React.createElement(
            "div",
            { className: "print-root" },
            React.createElement(
                "div",
                { className: "page portrait-page" },
                React.createElement(KopHeader, {
                    registerNo: "12",
                    photo: React.createElement(PhotoBox, { photo: null, name: "Ahmad", label: "Kelas I" }),
                }),
                React.createElement(
                    Section,
                    { marker: "A", title: "KETERANGAN SISWA" },
                    React.createElement(FieldGrid, {
                        items: [
                            { label: "Nama Lengkap", value: "Ahmad Fauzi", full: true },
                            { label: "NIS", value: "N0001" },
                            { label: "NISN", value: "0010000000" },
                            { label: "NIK", value: "3204000000000001" },
                            { label: "Anak Ke-", value: 2 },
                            { label: "Tahun Masuk", value: "2020" },
                            { label: "Jenis Kelamin", value: "Laki-laki" },
                            { label: "Kelas Terakhir", value: "VI" },
                            { label: "No. SKHUN", value: "SKHUN-001" },
                            { label: "Pekerjaan Saat Ini", value: "" },
                            { label: "KIP (Kartu Indonesia Pintar)", value: "" },
                            { label: "Agama", value: "" },
                            { label: "Golongan Darah", value: "O" },
                        ],
                    })
                ),
                React.createElement(
                    Section,
                    { marker: "B", title: "KETERANGAN ORANG TUA / WALI SISWA" },
                    [
                        React.createElement(ParentColumns, {
                            key: "pc",
                            columns: [
                                {
                                    title: "Ayah",
                                    items: [
                                        { label: "Nama", value: "Sukarno" },
                                        { label: "NIK", value: "3204000000000011" },
                                        { label: "Pendidikan", value: "SMA" },
                                        { label: "Pekerjaan", value: "Petani" },
                                        { label: "Penghasilan", value: "2500000" },
                                    ],
                                },
                                {
                                    title: "Ibu",
                                    items: [
                                        { label: "Nama", value: "Siti" },
                                        { label: "NIK", value: "3204000000000012" },
                                        { label: "Pendidikan", value: "S1" },
                                        { label: "Pekerjaan", value: "IRT" },
                                        { label: "Penghasilan", value: "1500000" },
                                    ],
                                },
                                {
                                    title: "Wali",
                                    items: [
                                        { label: "Nama", value: "" },
                                        { label: "NIK", value: "" },
                                        { label: "Pendidikan", value: "D3" },
                                        { label: "Pekerjaan", value: "Wiraswasta" },
                                        { label: "Penghasilan", value: "" },
                                    ],
                                },
                            ],
                        }),
                        React.createElement(FieldGrid, {
                            key: "bawah",
                            cols: 3,
                            className: "parent-bawah",
                            items: [
                                { label: "Nama Orang Tua", value: "Sukarno" },
                                { label: "Hubungan Wali", value: "Paman" },
                                { label: "Telepon Orang Tua", value: "08123456789" },
                                { label: "Telepon Wali", value: "" },
                                { label: "Alamat Orang Tua", value: "Jl. Melati 1", full: true },
                            ],
                        }),
                    ]
                ),
                React.createElement(
                    Section,
                    { marker: "F", title: "LAIN-LAIN" },
                    React.createElement(
                        "div",
                        { className: "lain-lain" },
                        React.createElement(
                            "p",
                            { className: "lain-lain-head" },
                            React.createElement("span", { className: "lain-lain-label" }, "Catatan yang penting"),
                            React.createElement("span", { className: "field-colon" }, ":"),
                            React.createElement("span", { className: "lain-lain-text" }, "")
                        ),
                        React.createElement("div", { className: "lain-space" }),
                        React.createElement("div", { className: "lain-space" })
                    )
                ),
                React.createElement(
                    "div",
                    { className: "portrait-footer" },
                    React.createElement(
                        "div",
                        { className: "footer-photo" },
                        React.createElement(PhotoBox, { photo: null, name: "Ahmad", label: "Mutasi" })
                    ),
                    React.createElement(
                        "div",
                        { className: "footer-photo" },
                        React.createElement(PhotoBox, { photo: null, name: "Ahmad", label: "Kelas VI" })
                    )
                )
            ),
            React.createElement(
                "div",
                { className: "page landscape-page" },
                React.createElement(TranscriptTable, {
                    grid,
                    yearLabels,
                    promotions: { I: "Naik ke kelas II", II: "Tidak naik kelas" },
                }),
                React.createElement(AttendanceTable, {
                    records: [
                        { academicYear: "2020/2021", semester: "Ganjil", present: 118, sick: 3, permission: 2, absent: 0, totalDays: 123 },
                    ],
                })
            )
        )
    );

    it("memuat kop dengan judul & No. Urut", () => {
        expect(html).toContain("BUKU INDUK SISWA");
        expect(html).toContain("No. Urut");
        expect(html).toContain("12");
    });

    it("NIS/NISN/Tahun Masuk berada di dalam seksi A (bukan kop)", () => {
        expect(html).toContain("NIS");
        expect(html).toContain("NISN");
        expect(html).toContain("Tahun Masuk");
        expect(html).toContain("N0001");
        expect(html).toContain("0010000000");
    });

    it("memuat seksi & field", () => {
        expect(html).toContain("KETERANGAN SISWA");
        expect(html).toContain("Nama Lengkap");
        expect(html).toContain("Ahmad Fauzi");
        expect(html).toContain("Agama");
    });

    it("field kosong tidak diberi placeholder dash", () => {
        // Field "Agama" dibuat kosong pada fixture → nilainya harus kosong,
        // bukan diisi tanda "—". Deteksi sel kosong hasil FieldValue.
        expect(html).toMatch(/field-value field-empty"><\/span>/);
    });

    it("field tanpa nomor awalan", () => {
        expect(html).not.toContain("field-no");
    });

    it("label & nilai dipisah kolom ':' yang sejajar", () => {
        expect(html).toContain("field-colon");
    });

    it("tidak memuat blok tanda tangan / tempat-tanggal", () => {
        expect(html).not.toContain("Kepala Sekolah");
        expect(html).not.toContain("Wali Kelas");
        expect(html).not.toContain("Orang Tua/Wali");
    });

    it("Lain-lain menyediakan baris isian kosong untuk catatan manual", () => {
        expect(html).toContain("lain-space");
    });

    it("Lain-lain memiliki label 'Catatan yang penting'", () => {
        expect(html).toContain("Catatan yang penting");
        expect(html).toContain("lain-lain-label");
        expect(html).toContain("field-colon");
    });

    it("data orang tua dikelompokkan per-orang: Ayah | Ibu | Wali", () => {
        expect(html).toContain("parent-cols");
        expect(html).toContain("parent-col-title");
        expect(html).toContain("Sukarno");
        expect(html).toContain("Siti");
        // Urutan kolom: Ayah mendahului Ibu, Ibu mendahului Wali
        expect(html.indexOf(">Ayah<")).toBeLessThan(html.indexOf(">Ibu<"));
        expect(html.indexOf(">Ibu<")).toBeLessThan(html.indexOf(">Wali<"));
    });

    it("ketiga kolom per-orang seragam (tinggi tidak ditentukan kolom terpanjang)", () => {
        // Ambil hanya blok parent-cols, tanpa baris bawah (parent-bawah).
        const block = html.slice(
            html.indexOf('class="parent-cols">'),
            html.indexOf("parent-bawah")
        );
        const cols = block.split('class="parent-col-title">').slice(1);
        expect(cols.length).toBe(3);
        const nRows = cols.map((c) => c.split('class="field-row').length - 1);
        expect(nRows).toEqual([5, 5, 5]);
    });

    it("pendidikan/pekerjaan/penghasilan ortu+wali dicetak (format super lengkap)", () => {
        expect(html).toContain("Pendidikan");
        expect(html).toContain("Pekerjaan");
        expect(html).toContain("Penghasilan");
        expect(html).toContain("Petani");
        expect(html).toContain("IRT");
        expect(html).toContain("Wiraswasta");
        expect(html).toContain("SMA");
    });

    it("data silang antar-orang berada di baris bawah penuh lebar", () => {
        expect(html).toContain("parent-bawah");
        expect(html).toContain("Nama Orang Tua");
        expect(html).toContain("Hubungan Wali");
        expect(html).toContain("Telepon Orang Tua");
        expect(html).toContain("Telepon Wali");
        expect(html).toContain("Alamat Orang Tua");
        expect(html).toContain("08123456789");
    });

    it("footer foto: Mutasi lalu Kelas VI (Kelas VI paling luar)", () => {
        const iMutasi = html.indexOf(">Mutasi<");
        const iKelasVI = html.indexOf(">Kelas VI<");
        expect(iMutasi).toBeGreaterThan(-1);
        expect(iKelasVI).toBeGreaterThan(-1);
        expect(iMutasi).toBeLessThan(iKelasVI); // Mutasi mendahului Kelas VI
    });

    it("memuat matriks nilai & agregat", () => {
        expect(html).toContain("MATA PELAJARAN");
        expect(html).toContain("KELAS I");
        expect(html).toContain("2020/2021");
        expect(html).toContain("Matematika");
        expect(html).toContain("JUMLAH NILAI");
        expect(html).toContain("NILAI RATA-RATA");
        expect(html).toContain("PERINGKAT KELAS");
        expect(html).toContain("NAIK / TIDAK NAIK");
    });

    it("memuat rekap kehadiran dengan data (dibelah dua kolom)", () => {
        expect(html).toContain("REKAP KEHADIRAN");
        expect(html).toContain("TAHUN");
        expect(html).toContain("2020/2021");
        expect(html).toContain("118");
        expect(html).toContain("attendance-cols"); // dua tabel berdampingan
    });

    it("rekap kehadiran memakai penomoran C.4 (format 3 halaman)", () => {
        expect(html).toContain("C.4. REKAP KEHADIRAN");
        expect(html).not.toContain("G. REKAP KEHADIRAN");
    });

    it("kolom TAHUN dan SMT memiliki pemisah (tidak menyambung)", () => {
        // colgroup <col> khusus + kelas at-sep memberi garis batas vertikal.
        expect(html).toContain("at-col-sep");
        expect(html).toContain("at-sep");
        // Sel SMT tidak lagi digabung (colSpan=2) karena itu yang menghilangkan
        // garis pemisah antara tahun dan semester.
        expect(html).not.toMatch(/<td class="at-td" colspan="2">/);
    });

    it("baris naik/tidak naik terisi dari classHistory", () => {
        expect(html).toContain("Naik ke kelas II");
        expect(html).toContain("Tidak naik kelas");
    });

    it("field baru buku induk ikut dirender", () => {
        expect(html).toContain("NIK");
        expect(html).toContain("Anak Ke-");
        expect(html).toContain("Kelas Terakhir");
        expect(html).toContain("No. SKHUN");
        expect(html).toContain("Pekerjaan Saat Ini");
        expect(html).toContain("KIP (Kartu Indonesia Pintar)");
    });

    it("menghitung agregat jumlah & rata-rata dengan benar", () => {
        // Kelas I sem1: 85+80=165 ; rata2 = 82.5
        expect(html).toContain("165");
        expect(html).toContain("82.5");
    });

    it("memuat placeholder pas foto bila tidak ada foto", () => {
        expect(html).toContain("Pas foto");
    });
});
