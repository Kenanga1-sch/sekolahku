import { ReactNode } from "react";

// Kop dokumen: No. Urut (pojok kiri) · Judul (center) · Foto (kanan).
interface KopHeaderProps {
    /** Nomor urut entri dalam buku induk fisik (diisi manual); "" bila belum ada */
    registerNo?: string | number | null;
    /** Nomor buku/jilid tempat siswa ini tercatat */
    bukuNo?: string | number | null;
    /** Foto besar di kanan kop */
    photo?: ReactNode;
}

export function KopHeader({ registerNo, bukuNo, photo }: KopHeaderProps) {
    return (
        <header className="kop-header">
            <div className="kop-no">
                <span className="kop-no-label">No. Urut</span>
                <span className="kop-no-line">{registerNo ?? ""}</span>
                {bukuNo !== null && bukuNo !== undefined && bukuNo !== "" && (
                    <>
                        <span className="kop-no-label kop-buku-label">Buku</span>
                        <span className="kop-no-line">{bukuNo}</span>
                    </>
                )}
            </div>
            <h1 className="kop-title">BUKU INDUK SISWA</h1>
            {photo && <div className="kop-photo">{photo}</div>}
        </header>
    );
}
