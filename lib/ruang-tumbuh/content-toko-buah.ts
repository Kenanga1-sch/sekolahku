// Item bank game Toko Buah (domain: numerasi).
// Level: Number Sense → Penjumlahan → Pengurangan → Perkalian
//        → Pembagian → Soal Cerita.
// Server menghitung errorBreakpoint = level pertama tempat kesalahan
// mulai meningkat (analisis titik kesulitan, §16).

export interface NumeracyItem {
  id: string;
  level: number;
  levelName: string;
  prompt: string;
  options: string[];
  answer: string;
}

export const TOKO_BUAH_LEVELS = ["Number Sense", "Penjumlahan", "Pengurangan", "Perkalian", "Pembagian", "Soal Cerita"];

export const TOKO_BUAH_ITEMS: NumeracyItem[] = [
  // ── Level 1: Number Sense ──
  { id: "tb-1-1", level: 1, levelName: "Number Sense", prompt: "Angka mana yang paling besar?", options: ["7", "4", "9"], answer: "9" },
  { id: "tb-1-2", level: 1, levelName: "Number Sense", prompt: "Hitung apel ini: 🍎🍎🍎🍎🍎 ada berapa?", options: ["4", "5", "6"], answer: "5" },
  { id: "tb-1-3", level: 1, levelName: "Number Sense", prompt: "Angka yang ada di antara 5 dan 7 adalah …", options: ["6", "8", "4"], answer: "6" },
  { id: "tb-1-4", level: 1, levelName: "Number Sense", prompt: "Angka mana yang paling kecil?", options: ["3", "8", "5"], answer: "3" },
  { id: "tb-1-5", level: 1, levelName: "Number Sense", prompt: "Berapa jumlah jeruk ini? 🍊🍊🍊", options: ["2", "3", "4"], answer: "3" },

  // ── Level 2: Penjumlahan ──
  { id: "tb-2-1", level: 2, levelName: "Penjumlahan", prompt: "Budi punya 4 apel. Ia membeli 3 apel lagi. Berapa apel Budi sekarang?", options: ["6", "7", "8"], answer: "7" },
  { id: "tb-2-2", level: 2, levelName: "Penjumlahan", prompt: "Ada 6 ikan di akuarium. Datang 2 ikan lagi. Berapa ikannya sekarang?", options: ["8", "4", "9"], answer: "8" },
  { id: "tb-2-3", level: 2, levelName: "Penjumlahan", prompt: "Sari punya 5 permen. Diberi 2 permen oleh ibu. Berapa permennya?", options: ["3", "6", "7"], answer: "7" },
  { id: "tb-2-4", level: 2, levelName: "Penjumlahan", prompt: "Di kelas ada 10 anak. Masuk 5 anak lagi. Berapa anak di kelas?", options: ["5", "12", "15"], answer: "15" },
  { id: "tb-2-5", level: 2, levelName: "Penjumlahan", prompt: "Pohon pertama ada 3 mangga, pohon kedua ada 4 mangga. Berapa total mangga?", options: ["1", "7", "12"], answer: "7" },

  // ── Level 3: Pengurangan ──
  { id: "tb-3-1", level: 3, levelName: "Pengurangan", prompt: "Andi punya 8 kelereng. Kehilangan 3 kelereng. Berapa sisanya?", options: ["5", "6", "11"], answer: "5" },
  { id: "tb-3-2", level: 3, levelName: "Pengurangan", prompt: "Ada 10 ayam. 4 ayam dijual. Berapa ayam tersisa?", options: ["6", "5", "14"], answer: "6" },
  { id: "tb-3-3", level: 3, levelName: "Pengurangan", prompt: "Ibu membeli 12 jeruk. Dimakan 5 jeruk. Berapa jeruk tersisa?", options: ["7", "8", "17"], answer: "7" },
  { id: "tb-3-4", level: 3, levelName: "Pengurangan", prompt: "Sari punya 9 pensil. Memberi 2 pensil ke teman. Berapa pensilnya?", options: ["7", "8", "11"], answer: "7" },
  { id: "tb-3-5", level: 3, levelName: "Pengurangan", prompt: "Toko punya 15 roti. Terjual 7 roti. Berapa roti tersisa?", options: ["8", "9", "22"], answer: "8" },

  // ── Level 4: Perkalian ──
  { id: "tb-4-1", level: 4, levelName: "Perkalian", prompt: "Satu papan tulis ada 4 kapur. Ada 3 papan tulis. Berapa kapur seluruhnya?", options: ["7", "12", "8"], answer: "12" },
  { id: "tb-4-2", level: 4, levelName: "Perkalian", prompt: "Satu kotak berisi 5 permen. Ada 4 kotak. Berapa permen seluruhnya?", options: ["9", "20", "25"], answer: "20" },
  { id: "tb-4-3", level: 4, levelName: "Perkalian", prompt: "Anak-anak berbaris 3 baris. Tiap baris 6 anak. Berapa anak seluruhnya?", options: ["9", "18", "24"], answer: "18" },
  { id: "tb-4-4", level: 4, levelName: "Perkalian", prompt: "Satu tas berisi 4 buku. Ada 5 tas. Berapa buku seluruhnya?", options: ["9", "20", "15"], answer: "20" },
  { id: "tb-4-5", level: 4, levelName: "Perkalian", prompt: "Harga satu es krim Rp2.000. Budi membeli 3 es krim. Berapa totalnya?", options: ["Rp5.000", "Rp6.000", "Rp2.000"], answer: "Rp6.000" },

  // ── Level 5: Pembagian ──
  { id: "tb-5-1", level: 5, levelName: "Pembagian", prompt: "12 permen dibagi rata kepada 3 anak. Berapa permen tiap anak?", options: ["4", "9", "36"], answer: "4" },
  { id: "tb-5-2", level: 5, levelName: "Pembagian", prompt: "10 apel dibagi rata ke 2 keranjang. Berapa apel tiap keranjang?", options: ["5", "8", "12"], answer: "5" },
  { id: "tb-5-3", level: 5, levelName: "Pembagian", prompt: "15 buku dibagi rata ke 5 meja. Berapa buku tiap meja?", options: ["3", "10", "20"], answer: "3" },
  { id: "tb-5-4", level: 5, levelName: "Pembagian", prompt: "20 kelereng dibagi rata ke 4 anak. Berapa kelereng tiap anak?", options: ["5", "16", "24"], answer: "5" },
  { id: "tb-5-5", level: 5, levelName: "Pembagian", prompt: "18 roti dibagi rata ke 6 anak. Berapa roti tiap anak?", options: ["3", "12", "24"], answer: "3" },

  // ── Level 6: Soal Cerita (multi-langkah) ──
  { id: "tb-6-1", level: 6, levelName: "Soal Cerita", prompt: "Budi punya 10 apel. Ia makan 2 apel, lalu membeli 4 apel. Berapa apel Budi sekarang?", options: ["8", "12", "14"], answer: "12" },
  { id: "tb-6-2", level: 6, levelName: "Soal Cerita", prompt: "Sari ada 5 permen. Diberi 3 permen, lalu memberi 2 permen ke adik. Berapa permennya?", options: ["4", "6", "10"], answer: "6" },
  { id: "tb-6-3", level: 6, levelName: "Soal Cerita", prompt: "Toko ada 15 roti. Terjual 6, lalu dibuat 6 roti lagi. Berapa roti tokonya?", options: ["3", "15", "21"], answer: "15" },
  { id: "tb-6-4", level: 6, levelName: "Soal Cerita", prompt: "Kelas ada 20 anak. 5 anak sakit, lalu 3 anak datang. Berapa anak di kelas?", options: ["12", "18", "22"], answer: "18" },
  { id: "tb-6-5", level: 6, levelName: "Soal Cerita", prompt: "Andi punya uang Rp10.000. Beli es krim Rp3.000, lalu diberi Rp2.000 oleh ibu. Berapa uang Andi?", options: ["Rp5.000", "Rp9.000", "Rp15.000"], answer: "Rp9.000" },
];
