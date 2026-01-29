import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";

interface DocxData {
  nomor_surat?: string;
  kepsek_nama?: string;
  kepsek_nip?: string;
  siswa_nama?: string;
  siswa_kelas?: string;
  siswa_jk?: string;
  siswa_nisn?: string;
  siswa_tmp_lahir?: string;
  siswa_tgl_lahir?: string;
  siswa_wali?: string;
  tgl_surat?: string;
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
