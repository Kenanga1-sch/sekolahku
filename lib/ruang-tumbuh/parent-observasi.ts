// Item pengamatan orang tua di rumah (§24). Paralel dengan domain game
// skrining; bahasa kemampuan yang teramati — bukan diagnosis.

export interface ParentObservationDomain {
  domain: string;
  label: string;
  prompt: string;
  items: string[];
}

export const PARENT_OBSERVATION_ITEMS: Record<string, ParentObservationDomain> = {
  perhatian: {
    domain: "perhatian",
    label: "Perhatian",
    prompt: "Saat mengerjakan tugas atau aktivitas di rumah, anak:",
    items: [
      "Mampu mempertahankan perhatian hingga tugas selesai",
      "Mudah teralihkan oleh suara atau gangguan di sekitarnya",
      "Membutuhkan pengulangan instruksi",
      "Sering meninggalkan tugas sebelum selesai",
      "Mampu mengerjakan tugas secara mandiri",
    ],
  },
  inhibitory: {
    domain: "inhibitory",
    label: "Pengendalian Respons",
    prompt: "Dalam kegiatan sehari-hari di rumah, anak:",
    items: [
      "Mampu menunggu gilirannya",
      "Sering memberikan respons impulsif (mendesak/memotong pembicaraan)",
      "Mampu mengikuti aturan yang disepakati keluarga",
      "Sulit menahan keinginan untuk hal yang dilarang",
      "Mampu memperbaiki kesalahan setelah ditunjukkan",
    ],
  },
  working_memory: {
    domain: "working_memory",
    label: "Ingatan Jangka Pendek",
    prompt: "Saat diberi instruksi atau hal baru, anak:",
    items: [
      "Mampu mengingat 2-3 instruksi sekaligus",
      "Hanya mengingat instruksi pertama",
      "Membutuhkan pengulangan instruksi secara bertahap",
      "Mampu mengingat hal yang baru saja dibicarakan",
      "Sering lupa bagian dari rutinitas harian",
    ],
  },
  literasi: {
    domain: "literasi",
    label: "Literasi",
    prompt: "Saat membaca atau menulis di rumah, anak:",
    items: [
      "Membaca sesuai tuntutan kelasnya",
      "Mengalami kesulitan membaca kata tertentu",
      "Sering melakukan kesalahan ejaan saat menulis",
      "Membaca sangat lambat",
      "Mampu menceritakan kembali isi bacaan",
    ],
  },
  numerasi: {
    domain: "numerasi",
    label: "Numerasi",
    prompt: "Saat berhubungan dengan angka/berhitung, anak:",
    items: [
      "Memahami konsep bilangan dalam kehidupan sehari-hari",
      "Mengalami kesulitan operasi dasar berhitung",
      "Mengalami kesulitan memahami soal cerita",
      "Membutuhkan benda konkret untuk berhitung",
      "Sering melakukan kesalahan prosedur",
    ],
  },
};
