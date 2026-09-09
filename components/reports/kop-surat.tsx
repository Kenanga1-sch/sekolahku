"use client";

/**
 * Kop surat bersama untuk dokumen yang dicetak.
 *
 * Sebelumnya blok ini disalin di sedikitnya empat tempat (laporan inventaris,
 * laporan perpustakaan, cetak surat keluar, dan editor surat) dengan susunan
 * yang sedikit berbeda-beda. Menyalin berarti setiap perbaikan — misalnya
 * menambahkan logo atau memperbaiki tata letak — harus diulang empat kali dan
 * mudah ada yang terlewat.
 *
 * Catatan penting: komponen ini merender <div>, BUKAN <header>. Kop Buku Induk
 * memakai elemen <header> (kop-header.tsx) dan sempat terancam tersembunyi
 * oleh aturan global `header { display: none }` saat cetak. Memakai <div>
 * menghindari jebakan itu.
 */

import { getSchoolLogo } from "@/lib/school-logo";
import { siteConfig } from "@/lib/config";

export interface KopSuratProps {
    /** Nama sekolah; jatuh ke konfigurasi bila pengaturan kosong. */
    schoolName?: string | null;
    /** Alamat sekolah. */
    schoolAddress?: string | null;
    /** Nomor telepon sekolah. */
    schoolPhone?: string | null;
    /** NPSN sekolah. */
    schoolNpsn?: string | null;
    /** Nilai mentah logo dari pengaturan, diproses getSchoolLogo. */
    schoolLogo?: string | null;
    /** Baris instansi di atas nama sekolah, mis. "PEMERINTAH KABUPATEN ...". */
    governanceName?: string | null;
    /** Judul dokumen, dicetak tebal di bawah garis. */
    title?: string;
    /** Keterangan periode/posisi, mis. "Posisi per 9 September 2026". */
    subtitle?: string;
    /** Sembunyikan logo bila dokumen tidak memerlukannya. */
    showLogo?: boolean;
}

export function KopSurat({
    schoolName,
    schoolAddress,
    schoolPhone,
    schoolNpsn,
    schoolLogo,
    governanceName,
    title,
    subtitle,
    showLogo = true,
}: KopSuratProps) {
    const name = schoolName || siteConfig.school.name;
    const address = schoolAddress || siteConfig.school.address;
    const phone = schoolPhone || siteConfig.school.phone;
    const npsn = schoolNpsn || siteConfig.school.npsn;
    const logoSrc = getSchoolLogo(schoolLogo);

    return (
        <div className="hidden print:block">
            {showLogo ? (
                <div className="flex items-start justify-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logoSrc}
                        alt=""
                        className="h-16 w-16 object-contain"
                        aria-hidden="true"
                    />
                </div>
            ) : null}

            <div className="text-center">
                {governanceName ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide">
                        {governanceName}
                    </p>
                ) : null}
                <h1 className="text-[15px] font-bold uppercase tracking-wide leading-tight">
                    {name}
                </h1>
                {address ? <p className="text-[10px] leading-snug">{address}</p> : null}
                <p className="text-[10px] leading-snug">
                    {npsn ? `NPSN: ${npsn}` : ""}
                    {npsn && phone ? " | " : ""}
                    {phone ? `Telp: ${phone}` : ""}
                </p>
            </div>

            <hr className="mt-2 border-t-2 border-black" />

            {title ? (
                <div className="mt-3 text-center">
                    <h2 className="text-[13px] font-bold uppercase underline decoration-1 underline-offset-2">
                        {title}
                    </h2>
                    {subtitle ? <p className="text-[10px]">{subtitle}</p> : null}
                </div>
            ) : null}
        </div>
    );
}
