import { ReactNode } from "react";

// Satu baris field: label + ":" + nilai, disusun grid 3 kolom agar ":" sejajar vertikal.
// Tanpa garis pandu; field kosong dibiarkan kosong (dapat diisi manual setelah cetak).
export interface FieldItem {
    /** Label field */
    label: ReactNode;
    /** Nilai; kosong -> kosong (atau placeholder pola-baku bila diberikan) */
    value?: ReactNode;
    /** Placeholder pola-baku (mis. "WNI/WNA*)") — hanya untuk pilihan coret, bukan isian */
    placeholder?: string;
    /** Lebar penuh (span seluruh kolom grid) */
    full?: boolean;
}

function FieldValue({ value, placeholder }: { value?: ReactNode; placeholder?: string }) {
    const empty = value === null || value === undefined || value === "";
    if (empty) {
        return <span className="field-value field-empty">{placeholder ?? ""}</span>;
    }
    return <span className="field-value">{value}</span>;
}

/**
 * Kolom data per-orang (Ayah | Ibu | Wali) untuk seksi KETERANGAN ORANG TUA / WALI.
 *
 * Tujuan: field yang berkaitan dengan satu orang dikelompokkan secara vertikal
 * di dalam satu kolom, sehingga urutan baca menjadi "Nama Ayah → NIK Ayah",
 * bukan melompat menyamping seperti grid biasa.
 */
export interface ParentColumn {
    /** Judul kolom, mis. "Ayah" */
    title: string;
    items: FieldItem[];
}

export function ParentColumns({ columns }: { columns: ParentColumn[] }) {
    return (
        <div className="parent-cols">
            {columns.map((col) => (
                <div key={col.title} className="parent-col">
                    <p className="parent-col-title">{col.title}</p>
                    <dl className="field-grid parent-grid">
                        {col.items.map((it, i) => (
                            <div key={i} className={`field-row ${it.full ? "field-full" : ""}`}>
                                <dt className="field-label">{it.label}</dt>
                                <span className="field-colon">:</span>
                                <dd className="field-dd">
                                    <FieldValue value={it.value} placeholder={it.placeholder} />
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ))}
        </div>
    );
}

// Grid field; tiap field = [label | : | nilai] sehingga ":" rata.
// `cols` = jumlah kolom field per baris (2 default; 3 untuk field pendek agar hemat ruang).
export function FieldGrid({
    items,
    cols = 2,
    className = "",
}: {
    items: FieldItem[];
    cols?: 2 | 3;
    className?: string;
}) {
    return (
        <dl className={`field-grid ${cols === 3 ? "field-cols-3" : ""} ${className}`}>
            {items.map((it, i) => (
                <div key={i} className={`field-row ${it.full ? "field-full" : ""}`}>
                    <dt className="field-label">{it.label}</dt>
                    <span className="field-colon">:</span>
                    <dd className="field-dd">
                        <FieldValue value={it.value} placeholder={it.placeholder} />
                    </dd>
                </div>
            ))}
        </dl>
    );
}
