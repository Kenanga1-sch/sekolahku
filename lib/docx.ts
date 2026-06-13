import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

interface DocxData {
  // Siswa
  siswa_nama?: string;
  siswa_nis?: string;
  siswa_nisn?: string;
  siswa_kelas?: string;
  siswa_jenis_kelamin?: string;
  siswa_tempat_lahir?: string;
  siswa_tanggal_lahir?: string;
  siswa_tanggal_lahir_indo?: string;
  siswa_alamat?: string;
  siswa_nama_wali?: string;
  siswa_no_hp_wali?: string;
  // Guru
  guru_nama?: string;
  guru_nip?: string;
  guru_jabatan?: string;
  // Penerima (STAFF fallback)
  penerima_nama?: string;
  penerima_nip?: string;
  penerima_jabatan?: string;
  // Sekolah
  sekolah_nama?: string;
  sekolah_npsn?: string;
  sekolah_alamat?: string;
  sekolah_kota?: string;
  sekolah_telepon?: string;
  sekolah_email?: string;
  sekolah_website?: string;
  kepala_sekolah_nama?: string;
  kepala_sekolah_nip?: string;
  // Umum
  tanggal_hari_ini?: string;
  tanggal_surat?: string;
  nomor_surat_otomatis?: string;
  nomor_surat?: string;
  tahun_ajaran?: string;
  // Manual
  perihal_surat?: string;
  keperluan?: string;
  hari_acara?: string;
  waktu_acara?: string;
  tempat_acara?: string;
  [key: string]: string | undefined;
}

export const createDocumentBlob = async (
  templateUrl: string,
  data: DocxData
): Promise<Blob> => {
  try {
    // 1. Load the template file
    const response = await fetch(templateUrl);
    if (!response.ok) {
        throw new Error(`Gagal memuat template: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();

    // 2. Initialize PizZip with the content
    const zip = new PizZip(arrayBuffer);

    // 3. Initialize Docxtemplater with double curly braces
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' }
    });

    // 4. Render the document (replace variables)
    // Careful with null/undefined logic from Docxtemplater, but simple replacement should work
    doc.render(data);

    // 5. Generate output blob
    const out = doc.getZip().generate({
        type: "blob",
        mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    return out;

  } catch (error) {
    console.error("Error generating document blob:", error);
    
    // More specific error handling for docxtemplater
    if ((error as any).properties && (error as any).properties.errors) {
        const e = (error as any);
        console.error("Docxtemplater Errors:", e.properties.errors);
        throw new Error("Terdapat kesalahan pada format template Word.");
    }
    
    throw error;
  }
};

export const generateDocument = async (
  templateUrl: string,
  data: DocxData,
  outputName: string = "Dokumen.docx"
) => {
    const blob = await createDocumentBlob(templateUrl, data);
    saveAs(blob, outputName);
    return true;
};
