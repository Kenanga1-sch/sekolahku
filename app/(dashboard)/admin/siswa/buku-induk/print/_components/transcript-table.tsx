import { CLASSES, matchSubject, TranscriptGrid } from "../_lib/transcript";

// Daftar mapel baku SD + muatan lokal (tetap sama seperti versi lama).
export const SUBJECTS = [
    "Pendidikan Agama Budi Pekerti",
    "Pendidikan Pancasila",
    "Matematika",
    "Bahasa Indonesia",
    "IPAS",
    "PJOK",
    "Bahasa Inggris",
    "Seni Budaya",
    "Bahasa Indramayu",
    "Budi Pekerti",
    "Tari",
    "Mangrove",
];

const fmt = (v: number | undefined) => (v !== undefined ? String(Math.round(v * 100) / 100) : "");

// Tabel matriks Prestasi Belajar (landscape).
// Header 2 lapis: [Tahun Pelajaran + Kelas] -> [Semester 1 | 2].
// Nilai per mapel per kelas per semester; baris agregat: Jumlah, Rata-rata, Peringkat, Naik/Tidak.
export function TranscriptTable({ grid, yearLabels, promotions }: TranscriptGrid & { promotions?: Record<string, string> }) {
    const num = (c: string, sub: string, sem: "1" | "2"): number | undefined => {
        const kd = grid[c] || {};
        const m = matchSubject(Object.keys(kd), sub);
        return m ? kd[m]?.[sem] : undefined;
    };

    const collect = (c: string, sem: "1" | "2"): number[] => {
        const kd = grid[c] || {};
        return Object.values(kd)
            .map((s) => s[sem])
            .filter((v): v is number => typeof v === "number");
    };

    const sumVal = (c: string, sem: "1" | "2") => {
        const vals = collect(c, sem);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
    };
    const avgVal = (c: string, sem: "1" | "2") => {
        const vals = collect(c, sem);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
    };

    return (
        <table className="transcript-table">
            <colgroup>
                <col className="col-subject" />
                {CLASSES.map((c) => (
                    <ScoreCols key={`col-${c}`} />
                ))}
            </colgroup>
            <thead>
                <tr>
                    <th className="th-subject" rowSpan={2}>MATA PELAJARAN</th>
                    {CLASSES.map((c) => (
                        <th key={`kls-${c}`} className="th-class" colSpan={2}>
                            <div className="th-year">{yearLabels[c] || "…/…"}</div>
                            <div className="th-kelas">KELAS {c}</div>
                        </th>
                    ))}
                </tr>
                <tr>
                    {CLASSES.map((c) => (
                        <SemHeader key={`sem-${c}`} />
                    ))}
                </tr>
            </thead>
            <tbody>
                {SUBJECTS.map((sub, idx) => (
                    <tr key={idx}>
                        <td className="td-subject">{sub}</td>
                        {CLASSES.map((c) => (
                            <ScoreCells key={`${c}-${idx}`} s1={num(c, sub, "1")} s2={num(c, sub, "2")} />
                        ))}
                    </tr>
                ))}

                {/* Jumlah */}
                <tr>
                    <td className="td-subject td-agg">JUMLAH NILAI</td>
                    {CLASSES.map((c) => (
                        <ScoreCells key={`jml-${c}`} s1={sumVal(c, "1")} s2={sumVal(c, "2")} />
                    ))}
                </tr>
                {/* Rata-rata */}
                <tr>
                    <td className="td-subject td-agg">NILAI RATA-RATA</td>
                    {CLASSES.map((c) => (
                        <FmtCells key={`avg-${c}`} s1={fmt(avgVal(c, "1"))} s2={fmt(avgVal(c, "2"))} />
                    ))}
                </tr>
                {/* Peringkat (slot manual) */}
                <tr>
                    <td className="td-subject td-agg">PERINGKAT KELAS</td>
                    {CLASSES.map((c) => (
                        <ScoreCells key={`rank-${c}`} s1={undefined} s2={undefined} />
                    ))}
                </tr>
                {/* Naik/Tidak — terisi dari classHistory bila ada */}
                <tr>
                    <td className="td-subject td-agg">NAIK / TIDAK NAIK TINGKAT</td>
                    {CLASSES.map((c) => (
                        <td key={`naik-${c}`} className="td-score td-naik" colSpan={2}>
                            {promotions?.[c] || "—"}
                        </td>
                    ))}
                </tr>
            </tbody>
        </table>
    );
}

function SemHeader() {
    return (
        <>
            <th className="th-sem">1</th>
            <th className="th-sem">2</th>
        </>
    );
}

function ScoreCols() {
    return (
        <>
            <col className="col-score" />
            <col className="col-score" />
        </>
    );
}

function ScoreCells({ s1, s2 }: { s1?: number; s2?: number }) {
    return (
        <>
            <td className="td-score">{s1 ?? ""}</td>
            <td className="td-score">{s2 ?? ""}</td>
        </>
    );
}

function FmtCells({ s1, s2 }: { s1: string; s2: string }) {
    return (
        <>
            <td className="td-score">{s1}</td>
            <td className="td-score">{s2}</td>
        </>
    );
}
