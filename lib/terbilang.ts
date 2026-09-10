/**
 * Terbilang: angka menjadi kata Bahasa Indonesia.
 *
 * Dipakai laporan akhir tahun tabungan (settlement) supaya jumlah uang
 * terbaca tanpa salah tafsir digit. Backend sengaja tidak menyimpan
 * daftar kata — satu sumber kebenaran di sini.
 */

const SATUAN = [
    "",
    "satu",
    "dua",
    "tiga",
    "empat",
    "lima",
    "enam",
    "tujuh",
    "delapan",
    "sembilan",
    "sepuluh",
    "sebelas",
];

const MILIAR_SATU = 1_000_000_000;

/** Terbilang untuk 0..999.999.999 (di bawah miliar). */
function terbilangKecil(n: number): string {
    if (n === 0) return "";
    if (n < 12) return SATUAN[n];
    if (n < 20) return terbilangKecil(n - 10) + " belas";
    if (n < 100) return SATUAN[Math.floor(n / 10)] + " puluh " + terbilangKecil(n % 10);
    if (n < 200) return "seratus " + terbilangKecil(n - 100);
    if (n < 1000) return SATUAN[Math.floor(n / 100)] + " ratus " + terbilangKecil(n % 100);
    if (n < 2000) return "seribu " + terbilangKecil(n - 1000);
    // Ribuan/jutaan di atas 2.000 memakai terbilang jumlahnya (mis. "dua puluh
    // ribu"), bukan indeks SATUAN tunggal — itu hanya benar untuk 1..9.
    if (n < 1_000_000)
        return terbilangKecil(Math.floor(n / 1000)) + " ribu " + terbilangKecil(n % 1000);
    return terbilangKecil(Math.floor(n / 1_000_000)) + " juta " + terbilangKecil(n % 1_000_000);
}

/**
 * Ubah angka bulat (positif atau negatif) menjadi terbilang dengan akhiran.
 *
 * Contoh:
 *   terbilang(1500)            -> "seribu lima ratus rupiah"
 *   terbilang(-1000, " rupiah") -> "negatif seribu rupiah"
 *   terbilang(0)                -> "nol"
 */
export function terbilang(n: number, suffix = ""): string {
    n = Math.trunc(n);
    if (n === 0) return "nol" + suffix;
    const negatif = n < 0;
    let sisa = Math.abs(n);

    const bagian: string[] = [];
    if (sisa >= MILIAR_SATU) {
        bagian.push(terbilangKecil(Math.floor(sisa / MILIAR_SATU)) + " miliar");
        sisa %= MILIAR_SATU;
    }
    const kecil = terbilangKecil(sisa);
    if (kecil) bagian.push(kecil);

    const hasil = bagian.join(" ").replace(/\s+/g, " ").trim();
    return (negatif ? "negatif " : "") + hasil + suffix;
}

/** Terbilang dengan format dokumen resmi: kapital dan akhiran " rupiah". */
export function terbilangRupiah(n: number): string {
    return terbilang(n, " rupiah").toUpperCase();
}
