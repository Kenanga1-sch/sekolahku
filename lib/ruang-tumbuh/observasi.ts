// Item observasi guru per domain (dokumen §26). Bahasa kemampuan yang
// teramati — bukan diagnosis (prinsip "measure, don't label").

export interface ObservationDomain {
  domain: string;
  label: string;
  prompt: string;
  items: string[];
}

export const OBSERVATION_ITEMS: Record<string, ObservationDomain> = {
  perhatian: {
    domain: "perhatian",
    label: "Perhatian",
    prompt: "Dalam kegiatan pembelajaran, siswa:",
    items: [
      "Mampu mempertahankan perhatian",
      "Mudah terdistraksi",
      "Membutuhkan pengulangan instruksi",
      "Sering meninggalkan tugas sebelum selesai",
      "Membutuhkan bantuan untuk menyelesaikan tugas",
    ],
  },
  inhibitory: {
    domain: "inhibitory",
    label: "Pengendalian Respons",
    prompt: "Dalam kegiatan pembelajaran, siswa:",
    items: [
      "Mampu menahan respons sebelum berpikir",
      "Sering memberikan respons impulsif",
      "Mampu mengikuti aturan yang diberikan",
      "Sulit membedakan target dan distraktor",
      "Mampu memperbaiki respons setelah diberi tahu",
    ],
  },
  working_memory: {
    domain: "working_memory",
    label: "Ingatan Jangka Pendek",
    prompt: "Dalam kegiatan pembelajaran, siswa:",
    items: [
      "Mampu mengingat urutan instruksi singkat",
      "Hanya mampu mengingat instruksi pertama",
      "Membutuhkan pengulangan instruksi bertahap",
      "Mampu mengingat objek yang baru saja dilihat",
      "Sering lupa bagian dari tugas",
    ],
  },
  literasi: {
    domain: "literasi",
    label: "Literasi",
    prompt: "Dalam kegiatan membaca/menulis, siswa:",
    items: [
      "Membaca sesuai tuntutan kelas",
      "Mengalami kesulitan membaca kata tertentu",
      "Sering melakukan kesalahan ejaan",
      "Membaca sangat lambat",
      "Mengalami kesulitan memahami bacaan",
    ],
  },
  numerasi: {
    domain: "numerasi",
    label: "Numerasi",
    prompt: "Dalam kegiatan matematika, siswa:",
    items: [
      "Memahami konsep bilangan",
      "Mengalami kesulitan operasi dasar",
      "Mengalami kesulitan memahami soal cerita",
      "Membutuhkan benda konkret",
      "Sering melakukan kesalahan prosedural",
    ],
  },
};

// Game yang sudah punya implementasi frontend (semua 5 game M2).
export const IMPLEMENTED_GAME_IDS = [
  "game-tangkap-target",
  "game-jangan-terkecoh",
  "game-ingat-urutannya",
  "game-kereta-kata",
  "game-toko-buah",
];

// Label metrik untuk guru (§23: tampilan per dimensi, bukan satu angka).
export function metricDescriptors(m: {
  accuracy: number;
  rtAvg: number;
  missed: number;
  incorrect: number;
  rtVariability: number;
  levelReached: number;
}) {
  const accLabel = m.accuracy >= 85 ? "Tinggi" : m.accuracy >= 65 ? "Sedang" : "Perlu perhatian";
  const speedLabel = m.rtAvg === 0 ? "-" : m.rtAvg <= 900 ? "Cepat" : m.rtAvg <= 1500 ? "Sedang" : "Lambat";
  const consistLabel =
    m.rtVariability === 0 ? "-" : m.rtVariability <= 25000 ? "Stabil" : m.rtVariability <= 60000 ? "Bervariasi" : "Sangat bervariasi";
  const missLabel = m.missed === 0 ? "Tidak ada" : m.missed <= 2 ? "Sedikit" : "Banyak";
  return [
    { label: "Akurasi", value: `${m.accuracy.toFixed(0)}%`, note: accLabel },
    { label: "Kecepatan respons", value: m.rtAvg ? `${(m.rtAvg / 1000).toFixed(2)} dtk` : "-", note: speedLabel },
    { label: "Konsistensi", value: m.rtVariability ? `${(Math.sqrt(m.rtVariability) / 1000).toFixed(2)} dtk` : "-", note: consistLabel },
    { label: "Target terlewat", value: String(m.missed), note: missLabel },
    { label: "Respons salah", value: String(m.incorrect), note: m.incorrect === 0 ? "Tidak ada" : m.incorrect <= 2 ? "Sedikit" : "Banyak" },
    ...(m.levelReached ? [{ label: "Level tertinggi", value: String(m.levelReached), note: "" }] : []),
  ];
}
