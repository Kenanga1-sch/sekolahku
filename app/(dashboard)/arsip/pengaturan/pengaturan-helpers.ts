export const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

export function previewLetterNumber(formatPattern: string, sequence: number, classificationCode: string, date = new Date()) {
    const padded3 = String(sequence).padStart(3, "0");
    const padded2 = String(sequence).padStart(2, "0");
    const padded4 = String(sequence).padStart(4, "0");
    const rawSeq = String(sequence);
    const year = String(date.getFullYear());
    const month = romanMonths[date.getMonth()];
    const monthNumeric = String(date.getMonth() + 1).padStart(2, "0");

    return (formatPattern || "{nomor}/{kode_klasifikasi}/SDN1-KNG/{bulan}/{tahun}")
        .replaceAll("{kode_klasifikasi}", classificationCode || "400.3.5.02")
        .replaceAll("{nomor_urut_raw}", rawSeq)
        .replaceAll("{nomor_raw}", rawSeq)
        .replaceAll("{no_raw}", rawSeq)
        .replaceAll("{nomor_urut_2}", padded2)
        .replaceAll("{nomor_urut_3}", padded3)
        .replaceAll("{nomor_urut_4}", padded4)
        .replaceAll("{nomor_urut}", padded3)
        .replaceAll("{nomor}", padded3)
        .replaceAll("{no}", padded3)
        .replaceAll("{bulan_angka}", monthNumeric)
        .replaceAll("{bulan}", month)
        .replaceAll("{bulan_romawi}", month)
        .replaceAll("{tahun}", year);
}

export function extractSequenceNumber(mailNumber: string, classCode: string): number {
    if (!mailNumber) return 1;
    const clean = mailNumber.trim();
    const slashIdx = clean.indexOf("/");
    if (slashIdx > 0) {
        const first = clean.substring(0, slashIdx);
        const val = parseInt(first);
        if (!isNaN(val) && val > 0 && first !== classCode) {
            return val;
        }
    }
    const parts = clean.split("/");
    for (const p of parts) {
        if (p === classCode || p.startsWith("400.3") || p.startsWith("421")) continue;
        const num = parseInt(p);
        if (!isNaN(num) && num > 0) return num;
    }
    return 1;
}
