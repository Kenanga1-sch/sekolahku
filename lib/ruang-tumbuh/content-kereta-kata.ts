// Item bank game Kereta Kata (domain: literasi).
// Level: Huruf → Suku Kata → Kata → Kata Kompleks → Kalimat → Pemahaman.
// Tugas berbasis visual yang auto-grade (§15). Pengukuran kelancaran
// membaca suara dilakukan guru melalui form observasi (§26).

export interface LiteracyItem {
  id: string;
  level: number;
  levelName: string;
  passage?: string;
  prompt: string;
  options: string[];
  answer: string;
}

export const KERETA_KATA_LEVELS = ["Huruf", "Suku Kata", "Kata", "Kata Panjang", "Kalimat", "Cerita"];

export const KERETA_KATA_ITEMS: LiteracyItem[] = [
  // ── Level 1: Huruf (huruf awal kata) ──
  { id: "kk-1-1", level: 1, levelName: "Huruf", prompt: "Kata yang dimulai dengan huruf B adalah …", options: ["Bola", "Meja", "Kucing"], answer: "Bola" },
  { id: "kk-1-2", level: 1, levelName: "Huruf", prompt: "Kata yang dimulai dengan huruf M adalah …", options: ["Sapu", "Meja", "Bola"], answer: "Meja" },
  { id: "kk-1-3", level: 1, levelName: "Huruf", prompt: "Kata yang dimulai dengan huruf S adalah …", options: ["Sapu", "Meja", "Kucing"], answer: "Sapu" },
  { id: "kk-1-4", level: 1, levelName: "Huruf", prompt: "Kata yang dimulai dengan huruf K adalah …", options: ["Bola", "Kucing", "Meja"], answer: "Kucing" },
  { id: "kk-1-5", level: 1, levelName: "Huruf", prompt: "Kata yang dimulai dengan huruf P adalah …", options: ["Pohon", "Bola", "Kucing"], answer: "Pohon" },

  // ── Level 2: Suku Kata (menyusun kata) ──
  { id: "kk-2-1", level: 2, levelName: "Suku Kata", prompt: "Lengkapi kata: Ma + … = Macan", options: ["ca", "kan", "ni"], answer: "ca" },
  { id: "kk-2-2", level: 2, levelName: "Suku Kata", prompt: "Lengkapi kata: Su + … = Susu", options: ["ka", "su", "me"], answer: "su" },
  { id: "kk-2-3", level: 2, levelName: "Suku Kata", prompt: "Lengkapi kata: Bi + … = Buku", options: ["la", "ku", "ni"], answer: "ku" },
  { id: "kk-2-4", level: 2, levelName: "Suku Kata", prompt: "Lengkapi kata: To + … = Topi", options: ["pi", "ka", "la"], answer: "pi" },
  { id: "kk-2-5", level: 2, levelName: "Suku Kata", prompt: "Lengkapi kata: Se + … = Sepatu", options: ["pa", "ka", "la"], answer: "pa" },

  // ── Level 3: Kata (menyebutkan gambar) ──
  { id: "kk-3-1", level: 3, levelName: "Kata", prompt: "Ini 🐱. Nama hewannya adalah …", options: ["Kucing", "Anjing", "Kelinci"], answer: "Kucing" },
  { id: "kk-3-2", level: 3, levelName: "Kata", prompt: "Ini 🐟. Nama hewannya adalah …", options: ["Burung", "Ikan", "Kucing"], answer: "Ikan" },
  { id: "kk-3-3", level: 3, levelName: "Kata", prompt: "Ini 🍎. Nama buahnya adalah …", options: ["Jeruk", "Pisang", "Apel"], answer: "Apel" },
  { id: "kk-3-4", level: 3, levelName: "Kata", prompt: "Ini 🚗. Nama kendaraannya adalah …", options: ["Bus", "Mobil", "Sepeda"], answer: "Mobil" },
  { id: "kk-3-5", level: 3, levelName: "Kata", prompt: "Ini 🏠. Nama bendanya adalah …", options: ["Sekolah", "Rumah", "Toko"], answer: "Rumah" },

  // ── Level 4: Kata Kompleks (ejaan yang benar) ──
  { id: "kk-4-1", level: 4, levelName: "Kata Panjang", prompt: "Kata yang ditulis dengan benar adalah …", options: ["Belajaar", "Balajar", "Belajar"], answer: "Belajar" },
  { id: "kk-4-2", level: 4, levelName: "Kata Panjang", prompt: "Kata yang ditulis dengan benar adalah …", options: ["Sepatu", "Sapatu", "Sepato"], answer: "Sepatu" },
  { id: "kk-4-3", level: 4, levelName: "Kata Panjang", prompt: "Kata yang ditulis dengan benar adalah …", options: ["Bukku", "Buku", "Bubu"], answer: "Buku" },
  { id: "kk-4-4", level: 4, levelName: "Kata Panjang", prompt: "Kata yang ditulis dengan benar adalah …", options: ["Mejaa", "Maja", "Meja"], answer: "Meja" },
  { id: "kk-4-5", level: 4, levelName: "Kata Panjang", prompt: "Kata yang ditulis dengan benar adalah …", options: ["Sakoloh", "Sekolah", "Sekolahh"], answer: "Sekolah" },

  // ── Level 5: Kalimat (melengkapi kalimat) ──
  { id: "kk-5-1", level: 5, levelName: "Kalimat", prompt: "Saya … ke sekolah setiap hari.", options: ["pergi", "makan", "tidur"], answer: "pergi" },
  { id: "kk-5-2", level: 5, levelName: "Kalimat", prompt: "Ibu memasak … di dapur.", options: ["buku", "nasi", "sepatu"], answer: "nasi" },
  { id: "kk-5-3", level: 5, levelName: "Kalimat", prompt: "Bunga mawar itu berwarna …", options: ["merah", "bulat", "keras"], answer: "merah" },
  { id: "kk-5-4", level: 5, levelName: "Kalimat", prompt: "Anak itu … buku di perpustakaan.", options: ["memasak", "membaca", "mandi"], answer: "membaca" },
  { id: "kk-5-5", level: 5, levelName: "Kalimat", prompt: "Hari ini cuaca sangat …", options: ["panas", "kotak", "manis"], answer: "panas" },

  // ── Level 6: Pemahaman (bacaan pendek) ──
  { id: "kk-6-1", level: 6, levelName: "Cerita", passage: "Andi suka bermain bola. Setiap sore Andi bermain bola di lapangan.", prompt: "Apa kesukaan Andi?", options: ["Bermain bola", "Membaca buku", "Memasak"], answer: "Bermain bola" },
  { id: "kk-6-2", level: 6, levelName: "Cerita", passage: "Sari pergi ke pasar. Ibu membeli sayur dan buah.", prompt: "Ke mana Sari pergi?", options: ["Pasar", "Sekolah", "Lapangan"], answer: "Pasar" },
  { id: "kk-6-3", level: 6, levelName: "Cerita", passage: "Kucing Milo makan ikan. Milo tidur di kursi.", prompt: "Apa yang dimakan Milo?", options: ["Sayur", "Ikan", "Roti"], answer: "Ikan" },
  { id: "kk-6-4", level: 6, levelName: "Cerita", passage: "Hujan turun sore hari. Anak-anak tidak bisa bermain di luar.", prompt: "Mengapa anak-anak tidak bermain di luar?", options: ["Karena hujan", "Karena malam", "Karena lapangan penuh"], answer: "Karena hujan" },
  { id: "kk-6-5", level: 6, levelName: "Cerita", passage: "Budi membawa 5 buku. 2 buku diberikan kepada adik.", prompt: "Berapa buku Budi sekarang?", options: ["3", "7", "2"], answer: "3" },
];
