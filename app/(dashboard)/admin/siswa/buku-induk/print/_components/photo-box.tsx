// Kotak pas foto untuk dokumen cetak Buku Induk.
// Semua foto satu ukuran 3x4 cm agar konsisten saat ditempel foto fisik.

interface PhotoBoxProps {
    photo?: string | null;
    name?: string;
    /** Label di bawah placeholder (mis. "Kelas I", "Kelas VI", "Mutasi") */
    label?: string;
    className?: string;
}

export function PhotoBox({ photo, name, label, className = "" }: PhotoBoxProps) {
    return (
        <div
            className={`photo-frame w-[3cm] h-[4cm] border border-black bg-white flex flex-col items-center justify-center text-[8pt] leading-tight overflow-hidden shrink-0 ${className}`}
        >
            {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={name || "Pas foto"} className="w-full h-full object-cover" />
            ) : (
                <>
                    <span className="mb-1">Pas foto</span>
                    <span>(3x4)</span>
                    {label && <span className="mt-1 font-semibold">{label}</span>}
                </>
            )}
        </div>
    );
}
