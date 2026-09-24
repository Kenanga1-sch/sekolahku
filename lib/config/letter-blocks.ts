/**
 * letter-blocks.ts — Skema blok modular pembentuk surat.
 *
 * Setiap blok adalah "modul" yang bisa ditambah/dihapus/diurutkan di editor
 * surat modular. Blok menyimpan data terstruktur (bukan HTML bebas), sehingga
 * renderer PDF di klien dapat menyusun tata letak yang konsisten.
 *
 * Prinsip:
 *  - Definisi blok = DATA (id, label, field, kemampuan).
 *  - Nilai blok disimpan di state editor sebagai LetterBlockValue[].
 *  - Renderer (PDF) memetakan id blok → komponen visual.
 */

// ─────────────────────────────────────────────
// Tipe nilai blok
// ─────────────────────────────────────────────

export type LetterBlockValue = string | number | boolean | null | undefined;

/** Nilai blok: dokumen nilai per-field (key = id field). */
export type LetterBlockData = Record<string, LetterBlockValue>;

/** Satu blok konkret dalam dokumen surat. */
export interface LetterBlockInstance {
  /** Instance id unik (untuk reorder/hapus). */
  instanceId: string;
  /** Id definisi blok (mis. "kop_surat"). */
  blockId: string;
  /** Apakah blok aktif ditampilkan. */
  enabled: boolean;
  /** Data field blok. */
  data: LetterBlockData;
}

/** Definisi jenis field di dalam blok. */
export interface LetterBlockField {
  key: string;
  label: string;
  /**
   * Jenis input:
   *  - text/textarea : teks biasa
   *  - richtext      : isi kaya (bold/italic/bullet/tabel) disimpan sebagai JSON TipTap
   *  - date/number   : tanggal / angka
   *  - select        : pilihan dari `options`
   *  - variable      : nilai tunggal berupa variabel {{...}}
   *  - table         : data tabel visual (kolom + baris)
   *  - checkbox      : boolean
   */
  type:
    | "text"
    | "textarea"
    | "richtext"
    | "date"
    | "number"
    | "select"
    | "variable"
    | "table"
    | "checkbox";
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Nilai awal. */
  defaultValue?: LetterBlockValue;
  /** Wajib diisi? */
  required?: boolean;
  /** Boleh menyisipkan variabel {{...}} (untuk type text/textarea/richtext). */
  allowVariables?: boolean;
  /** Untuk type "table": definisi kolom awal. */
  columns?: { key: string; label: string; width?: number }[];
}

/** Group untuk pengelompokan di panel "tambah blok". */
export type LetterBlockGroup =
  | "kop"
  | "identitas"
  | "isi"
  | "acara"
  | "penutup"
  | "tanda_tangan"
  | "tabel"
  | "navigasi"
  | "meta"
  | "lampiran";

/** Definisi sebuah blok modular. */
export interface LetterBlockDefinition {
  id: string;
  label: string;
  description: string;
  /** Group untuk pengelompokan di panel "tambah blok". */
  group: LetterBlockGroup;
  fields: LetterBlockField[];
  /** true = blok bisa ditambahkan lebih dari sekali (mis. tabel penugasan). */
  repeatable?: boolean;
  /** true = tidak boleh dihapus (mis. isi surat). */
  required?: boolean;
  /**
   * Kategori standar yang otomatis menambahkan blok ini (di luar defaultBlocks).
   * Berguna untuk blok yang hanya relevan pada jenis surat tertentu.
   */
  defaultForCategories?: string[];
}

// ─────────────────────────────────────────────
// Daftar definisi blok
// ─────────────────────────────────────────────

export const LETTER_BLOCK_DEFINITIONS: LetterBlockDefinition[] = [
  {
    id: "kop_surat",
    label: "Kop Surat",
    description: "Kepala surat instansi (otomatis dari Pengaturan Sekolah).",
    group: "kop",
    fields: [
      {
        key: "variant",
        label: "Gaya Kop",
        type: "select",
        defaultValue: "pemerintah",
        options: [
          { value: "pemerintah", label: "Pemerintah Daerah (2 baris, logo kiri)" },
          { value: "sekolah", label: "Nama Sekolah Saja" },
          { value: "lengkap", label: "Lengkap (Pemda → Dinas → Sekolah, garis ganda, logo kiri)" },
          { value: "logo_kanan", label: "Logo di Kanan" },
          { value: "garis_ganda", label: "Garis Tunggal + Garis Ganda" },
        ],
      },
    ],
  },
  {
    id: "judul",
    label: "Judul Surat",
    description: "Judul/heading surat (mis. SURAT KETERANGAN).",
    group: "identitas",
    fields: [
      { key: "text", label: "Judul", type: "text", placeholder: "SURAT KETERANGAN", required: true },
    ],
  },
  {
    id: "judul_memo",
    label: "Judul Memo",
    description: "Header memo internal (MEMO / NOTA DINAS).",
    group: "identitas",
    fields: [
      { key: "text", label: "Judul", type: "text", defaultValue: "MEMO INTERNAL" },
    ],
  },
  {
    id: "tanggal",
    label: "Tanggal (atas)",
    description: "Tempat & tanggal surat di bagian atas (opsional).",
    group: "identitas",
    fields: [
      { key: "tempat", label: "Tempat", type: "text", placeholder: "Indramayu" },
      { key: "tanggal", label: "Tanggal", type: "date", allowVariables: false },
    ],
  },
  {
    id: "nomor_perihal_lampiran",
    label: "Nomor / Perihal / Lampiran",
    description: "Blok nomor surat, perihal, dan lampiran.",
    group: "identitas",
    required: true,
    fields: [
      { key: "nomor", label: "Nomor Surat", type: "text", allowVariables: true },
      { key: "perihal", label: "Perihal", type: "text", required: true },
      { key: "lampiran", label: "Lampiran", type: "text", placeholder: "1 (satu) lembar" },
    ],
  },
  {
    id: "tujuan",
    label: "Tujuan (Kepada Yth)",
    description: "Penerima surat dan alamatnya.",
    group: "identitas",
    fields: [
      { key: "kepada", label: "Kepada", type: "text", placeholder: "Orang Tua/Wali Murid", required: true, allowVariables: true },
      { key: "di_tempat", label: "Keterangan Tempat", type: "text", placeholder: "di -" },
    ],
  },
  {
    id: "salam_pembuka",
    label: "Salam Pembuka",
    description: "Kalimat pembuka surat (Dengan hormat, ...). Mendukung teks kaya.",
    group: "isi",
    fields: [
      { key: "text", label: "Teks", type: "richtext", defaultValue: "Dengan hormat,", allowVariables: true },
    ],
  },
  {
    id: "isi",
    label: "Isi Surat",
    description: "Badan surat (teks kaya: tebal, miring, daftar). Boleh menyisipkan variabel.",
    group: "isi",
    required: true,
    fields: [
      {
        key: "text",
        label: "Isi",
        type: "richtext",
        placeholder: "Yang bertanda tangan di bawah ini...",
        allowVariables: true,
        required: true,
      },
    ],
  },
  {
    id: "pelaksanaan_acara",
    label: "Pelaksanaan Acara",
    description: "Rincian hari/tanggal/waktu/tempat acara.",
    group: "acara",
    fields: [
      { key: "hari", label: "Hari", type: "text", placeholder: "Senin" },
      { key: "tanggal", label: "Tanggal", type: "date" },
      { key: "waktu", label: "Waktu", type: "text", placeholder: "09.00 WIB s.d. selesai" },
      { key: "tempat", label: "Tempat", type: "text", placeholder: "Aula Sekolah" },
      { key: "agenda", label: "Agenda", type: "text", placeholder: "Rapat Komite" },
    ],
  },
  {
    id: "tabel_penugasan",
    label: "Tabel Penugasan",
    description: "Tabel rincian penugasan (nama, NIP, jabatan, uraian).",
    group: "tabel",
    repeatable: true,
    fields: [
      {
        key: "table",
        label: "Data Tabel",
        type: "table",
        columns: [
          { key: "no", label: "No", width: 30 },
          { key: "nama", label: "Nama" },
          { key: "nip", label: "NIP" },
          { key: "jabatan", label: "Jabatan" },
          { key: "uraian", label: "Uraian" },
        ],
      },
    ],
  },
  {
    id: "tabel_generik",
    label: "Tabel Bebas",
    description: "Tabel dengan kolom & baris yang bisa diatur bebas.",
    group: "tabel",
    repeatable: true,
    fields: [
      {
        key: "table",
        label: "Data Tabel",
        type: "table",
        columns: [
          { key: "k1", label: "Kolom 1" },
          { key: "k2", label: "Kolom 2" },
          { key: "k3", label: "Kolom 3" },
        ],
      },
    ],
  },
  {
    id: "tabel_data_siswa",
    label: "Tabel Data Siswa",
    description: "Tabel identitas siswa (Nama, NISN, Kelas, dll.).",
    group: "tabel",
    fields: [
      { key: "nama", label: "Nama", type: "variable" },
      { key: "nisn", label: "NISN", type: "variable" },
      { key: "kelas", label: "Kelas", type: "variable" },
      { key: "tempat_tanggal_lahir", label: "Tempat/Tgl Lahir", type: "text", allowVariables: true },
      { key: "alamat", label: "Alamat", type: "text", allowVariables: true },
    ],
  },
  {
    id: "penutup",
    label: "Penutup",
    description: "Kalimat penutup surat. Mendukung teks kaya.",
    group: "penutup",
    fields: [
      {
        key: "text",
        label: "Teks",
        type: "richtext",
        defaultValue:
          "Demikian surat ini kami sampaikan, atas perhatian dan kerja samanya kami ucapkan terima kasih.",
        allowVariables: true,
      },
    ],
  },
  {
    id: "tanggal_bawah",
    label: "Tanggal (bawah)",
    description: "Tempat & tanggal di atas tanda tangan.",
    group: "tanda_tangan",
    fields: [
      { key: "tempat", label: "Tempat", type: "text", placeholder: "Indramayu" },
      { key: "tanggal", label: "Tanggal", type: "date" },
    ],
  },
  {
    id: "tanda_tangan",
    label: "Tanda Tangan (tunggal)",
    description: "Blok tanda tangan satu pihak (biasanya Kepala Sekolah).",
    group: "tanda_tangan",
    fields: [
      { key: "jabatan", label: "Jabatan", type: "text", defaultValue: "Kepala Sekolah" },
      { key: "nama", label: "Nama", type: "text", allowVariables: true },
      { key: "nip", label: "NIP", type: "text", allowVariables: true },
      { key: "show_stamp", label: "Tampilkan Stempel", type: "select", defaultValue: "false", options: [
        { value: "false", label: "Tidak" },
        { value: "true", label: "Ya" },
      ] },
    ],
  },
  {
    id: "tanda_tangan_ganda",
    label: "Tanda Tangan (ganda)",
    description: "Dua pihak penanda tangan berdampingan (mis. pihak A & B).",
    group: "tanda_tangan",
    fields: [
      { key: "kiri_jabatan", label: "Jabatan Kiri", type: "text", placeholder: "Ketua Komite" },
      { key: "kiri_nama", label: "Nama Kiri", type: "text", allowVariables: true },
      { key: "kiri_nip", label: "NIP Kiri", type: "text" },
      { key: "kanan_jabatan", label: "Jabatan Kanan", type: "text", defaultValue: "Kepala Sekolah" },
      { key: "kanan_nama", label: "Nama Kanan", type: "text", allowVariables: true },
      { key: "kanan_nip", label: "NIP Kanan", type: "text", allowVariables: true },
      { key: "show_stamp", label: "Stempel di Kanan", type: "select", defaultValue: "false", options: [
        { value: "false", label: "Tidak" },
        { value: "true", label: "Ya" },
      ] },
    ],
  },
  {
    id: "ttd_tiga",
    label: "Tanda Tangan (tiga pihak)",
    description: "Tiga pihak penanda tangan berdampingan (mis. panitia + kepala sekolah).",
    group: "tanda_tangan",
    fields: [
      { key: "kiri_jabatan", label: "Jabatan Kiri", type: "text" },
      { key: "kiri_nama", label: "Nama Kiri", type: "text", allowVariables: true },
      { key: "kiri_nip", label: "NIP Kiri", type: "text" },
      { key: "tengah_jabatan", label: "Jabatan Tengah", type: "text" },
      { key: "tengah_nama", label: "Nama Tengah", type: "text", allowVariables: true },
      { key: "tengah_nip", label: "NIP Tengah", type: "text" },
      { key: "kanan_jabatan", label: "Jabatan Kanan", type: "text", defaultValue: "Kepala Sekolah" },
      { key: "kanan_nama", label: "Nama Kanan", type: "text", allowVariables: true },
      { key: "kanan_nip", label: "NIP Kanan", type: "text", allowVariables: true },
    ],
  },
  {
    id: "tembusan",
    label: "Tembusan",
    description: "Daftar penerima tindasan/tembusan surat.",
    group: "meta",
    fields: [
      { key: "judul", label: "Judul", type: "text", defaultValue: "Tembusan:" },
      {
        key: "daftar",
        label: "Penerima (satu per baris)",
        type: "textarea",
        placeholder: "Kepala Dinas Pendidikan\nPengawas Sekolah",
      },
    ],
  },
  {
    id: "catatan_kaki",
    label: "Catatan Kaki",
    description: "Catatan kecil di bagian bawah surat.",
    group: "meta",
    fields: [
      { key: "text", label: "Catatan", type: "textarea", allowVariables: true },
    ],
  },
  {
    id: "qr_verifikasi",
    label: "QR Verifikasi",
    description: "Kode QR untuk verifikasi surat (isi URL gambar QR).",
    group: "meta",
    fields: [
      { key: "url", label: "URL Gambar QR", type: "text", placeholder: "/api/qr?text=..." },
      { key: "caption", label: "Keterangan", type: "text", defaultValue: "Pindai untuk verifikasi" },
    ],
  },
  {
    id: "gambar",
    label: "Gambar / Logo",
    description: "Menyisipkan gambar (logo, foto) dari URL.",
    group: "isi",
    repeatable: true,
    fields: [
      { key: "url", label: "URL Gambar", type: "text", placeholder: "/uploads/..." },
      { key: "caption", label: "Keterangan", type: "text" },
    ],
  },
  {
    id: "daftar_lampiran",
    label: "Halaman Lampiran",
    description: "Blok lampiran (judul + isi kaya). Cocok untuk halaman lampiran terpisah.",
    group: "lampiran",
    repeatable: true,
    fields: [
      { key: "judul", label: "Judul Lampiran", type: "text", placeholder: "LAMPIRAN" },
      { key: "isi", label: "Isi Lampiran", type: "richtext", allowVariables: true },
    ],
  },
  {
    id: "page_break",
    label: "Pindah Halaman",
    description: "Penanda pindah ke halaman berikutnya.",
    group: "navigasi",
    repeatable: true,
    fields: [],
  },
];

/** Peta id → definisi untuk lookup cepat. */
export const LETTER_BLOCK_MAP: Record<string, LetterBlockDefinition> =
  Object.fromEntries(LETTER_BLOCK_DEFINITIONS.map((b) => [b.id, b]));

export function getBlockDefinition(id: string): LetterBlockDefinition | undefined {
  return LETTER_BLOCK_MAP[id];
}

/** Label grup untuk panel UI. */
export const LETTER_BLOCK_GROUPS: { id: LetterBlockGroup; label: string }[] = [
  { id: "kop", label: "Kop & Kepala" },
  { id: "identitas", label: "Identitas Surat" },
  { id: "isi", label: "Isi" },
  { id: "acara", label: "Acara" },
  { id: "tabel", label: "Tabel" },
  { id: "lampiran", label: "Lampiran" },
  { id: "penutup", label: "Penutup" },
  { id: "tanda_tangan", label: "Tanda Tangan" },
  { id: "navigasi", label: "Navigasi Halaman" },
  { id: "meta", label: "Meta & Lainnya" },
];

let instanceCounter = 0;

/** Membuat id instance unik. */
export function newInstanceId(blockId: string): string {
  instanceCounter += 1;
  return `${blockId}-${Date.now().toString(36)}-${instanceCounter}`;
}

/** Membuat instance blok baru dengan nilai default. */
export function createBlockInstance(blockId: string): LetterBlockInstance | null {
  const def = getBlockDefinition(blockId);
  if (!def) return null;
  const data: LetterBlockData = {};
  for (const f of def.fields) {
    if (f.type === "richtext") {
      const text = typeof f.defaultValue === "string" ? f.defaultValue : "";
      data[f.key] = JSON.stringify({
        type: "doc",
        content: [
          text
            ? { type: "paragraph", content: [{ type: "text", text }] }
            : { type: "paragraph" },
        ],
      });
    } else if (f.type === "table") {
      data[f.key] = JSON.stringify({ columns: f.columns || [], rows: [] });
    } else if (f.defaultValue !== undefined) {
      data[f.key] = f.defaultValue;
    } else {
      data[f.key] = "";
    }
  }
  // Nilai awal cerdas untuk tabel data siswa.
  if (blockId === "tabel_data_siswa") {
    data.nama = "{{siswa_nama}}";
    data.nisn = "{{siswa_nisn}}";
    data.kelas = "{{siswa_kelas}}";
    data.tempat_tanggal_lahir = "{{siswa_tempat_lahir}}, {{siswa_tanggal_lahir_indo}}";
    data.alamat = "{{siswa_alamat}}";
  }
  return { instanceId: newInstanceId(blockId), blockId, enabled: true, data };
}

/** Membangun susunan blok default dari daftar id blok standar. */
export function buildDefaultBlocks(blockIds: string[]): LetterBlockInstance[] {
  return blockIds
    .map((id) => createBlockInstance(id))
    .filter((b): b is LetterBlockInstance => b !== null);
}

/**
 * Membangun blok default untuk sebuah kategori standar: defaultBlocks dari
 * standar ditambah blok yang ditandai `defaultForCategories`.
 */
export function buildDefaultBlocksForCategory(
  defaultBlockIds: string[],
  category: string
): LetterBlockInstance[] {
  const extras = LETTER_BLOCK_DEFINITIONS.filter((d) =>
    d.defaultForCategories?.includes(category)
  )
    .map((d) => d.id)
    .filter((id) => !defaultBlockIds.includes(id));
  return buildDefaultBlocks([...defaultBlockIds, ...extras]);
}

/** Apakah nilai sebuah field dianggap kosong (teks / rich text / HTML). */
export function isFieldValueEmpty(v: LetterBlockValue): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (!s) return true;
  // Rich text JSON kadang hanya berisi paragraf kosong.
  if (s.startsWith("{")) return !/"text"\s*:\s*"[^"]+"/.test(s);
  // HTML tanpa teks.
  if (/^<[^>]*>$/.test(s)) return true;
  return s.replace(/<[^>]*>/g, "").trim() === "";
}

/** Satu masalah validasi: blok dengan field wajib yang masih kosong. */
export interface MissingRequired {
  instanceId: string;
  blockId: string;
  blockLabel: string;
  fieldKey: string;
  fieldLabel: string;
}

/**
 * Memindai sebuah daftar blok dan mengembalikan field wajib yang masih kosong
 * (hanya blok yang aktif). Dipakai bersama oleh editor (indikator merah) dan
 * halaman simpan (memblokir simpan bila ada yang kosong).
 */
export function findMissingRequired(blocks: LetterBlockInstance[]): MissingRequired[] {
  const out: MissingRequired[] = [];
  for (const b of blocks) {
    if (!b.enabled) continue;
    const def = getBlockDefinition(b.blockId);
    if (!def) continue;
    for (const f of def.fields) {
      if (!f.required) continue;
      if (isFieldValueEmpty(b.data[f.key])) {
        out.push({
          instanceId: b.instanceId,
          blockId: b.blockId,
          blockLabel: def.label,
          fieldKey: f.key,
          fieldLabel: f.label,
        });
      }
    }
  }
  return out;
}

/** Memindai seluruh halaman dokumen untuk field wajib yang kosong. */
export function findMissingRequiredInDocument(
  pages: { blocks: LetterBlockInstance[] }[]
): MissingRequired[] {
  return pages.flatMap((p) => findMissingRequired(p.blocks));
}
