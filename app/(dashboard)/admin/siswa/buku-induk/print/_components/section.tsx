import { ReactNode } from "react";

// Heading seksi dokumen (A./B./C. ...) — garis atas tipis + judul kecil tebal kapital.
interface SectionProps {
    /** Huruf/label seksi, mis. "A" */
    marker?: string;
    title: string;
    children: ReactNode;
    className?: string;
    /** Seksi lanjutan di awal halaman: tanpa jarak atas ekstra */
    noMarginTop?: boolean;
}

export function Section({ marker, title, children, className = "", noMarginTop }: SectionProps) {
    return (
        <section className={`print-section ${noMarginTop ? "section-cont" : ""} ${className}`}>
            <h2 className="section-heading">
                {marker && <span className="section-marker">{marker}.</span>}
                <span>{title}</span>
            </h2>
            <div className="section-body">{children}</div>
        </section>
    );
}
