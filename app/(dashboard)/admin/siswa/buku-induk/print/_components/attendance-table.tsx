// Rekap Kehadiran per tahun pelajaran & semester (sumber: alumni_attendance_summary).
// Ditempatkan di bawah tabel Prestasi Belajar pada halaman landscape.
export interface AttendanceRow {
    academicYear?: string | null;
    semester?: string | null;
    present?: number | null;
    sick?: number | null;
    permission?: number | null;
    absent?: number | null;
    totalDays?: number | null;
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));

// Dibelah menjadi dua kolom berdampingan agar hemat tinggi halaman landscape.
function AttendanceHalf({ rows, offset }: { rows: AttendanceRow[]; offset: number }) {
    return (
        <table className="attendance-table">
            {/* colgroup + border-right pada <col> memberi garis pemisah tegas
                antar-TAHUN dan SMT (tanpa ini, border-collapse menyatukan
                kedua sel sehingga "2020/2021" tampil menyambung dengan "Ganjil"). */}
            <colgroup>
                <col className="at-col-year" />
                <col className="at-col-sep" />
                <col />
                <col />
                <col />
                <col />
                <col />
            </colgroup>
            <thead>
                <tr>
                    <th className="at-th at-year">TAHUN</th>
                    <th className="at-th at-sep">SMT</th>
                    <th className="at-th">H</th>
                    <th className="at-th">S</th>
                    <th className="at-th">I</th>
                    <th className="at-th">A</th>
                    <th className="at-th">TOTAL</th>
                </tr>
            </thead>
            <tbody>
                {rows.length === 0 ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <tr key={`e-${i}`}>
                            <td className="at-td">&nbsp;</td>
                            <td className="at-td at-sep">&nbsp;</td>
                            <td className="at-td" />
                            <td className="at-td" />
                            <td className="at-td" />
                            <td className="at-td" />
                            <td className="at-td" />
                        </tr>
                    ))
                ) : (
                        rows.map((r, i) => (
                            <tr key={i}>
                                <td className="at-td at-left">{n(r.academicYear)}</td>
                                <td className="at-td at-sep">{n(r.semester)}</td>
                            <td className="at-td">{n(r.present)}</td>
                            <td className="at-td">{n(r.sick)}</td>
                            <td className="at-td">{n(r.permission)}</td>
                            <td className="at-td">{n(r.absent)}</td>
                            <td className="at-td">{n(r.totalDays)}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}

export function AttendanceTable({ records }: { records?: AttendanceRow[] }) {
    const list = (records || []).filter((r) => r && (r.academicYear || r.semester));
    const half = Math.ceil(Math.max(list.length, 6) / 2);
    const left = list.slice(0, half);
    const right = list.slice(half);

    return (
        <div className="attendance-block">
            <h3 className="attendance-title">C.4. REKAP KEHADIRAN</h3>
            <div className="attendance-cols">
                <AttendanceHalf rows={left} offset={0} />
                <AttendanceHalf rows={right} offset={half} />
            </div>
        </div>
    );
}
