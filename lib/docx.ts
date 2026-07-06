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

export const mergeDocxFiles = (files: ArrayBuffer[]): Blob => {
  if (files.length === 0) {
    throw new Error("Tidak ada berkas untuk digabungkan.");
  }
  if (files.length === 1) {
    const zip = new PizZip(files[0]);
    return zip.generate({
      type: "blob",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  // Load first document
  const mainZip = new PizZip(files[0]);
  const mainFile = mainZip.file("word/document.xml");
  if (!mainFile) {
    throw new Error("Berkas word/document.xml tidak ditemukan pada dokumen dasar.");
  }
  const mainXmlText = mainFile.asText();

  if (typeof window === "undefined") {
    throw new Error("Penggabungan dokumen hanya didukung di lingkungan browser.");
  }

  const parser = new DOMParser();
  const mainDoc = parser.parseFromString(mainXmlText, "application/xml");
  const mainBody = mainDoc.getElementsByTagName("w:body")[0];
  if (!mainBody) {
    throw new Error("Format dokumen dasar tidak valid: w:body tidak ditemukan.");
  }

  // Find the last sectPr element in mainBody (page margins, layout size settings)
  const mainSectPr = mainBody.getElementsByTagName("w:sectPr")[0];

  for (let i = 1; i < files.length; i++) {
    const zip = new PizZip(files[i]);
    const docFile = zip.file("word/document.xml");
    if (!docFile) continue;
    const xmlText = docFile.asText();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const body = doc.getElementsByTagName("w:body")[0];
    if (!body) continue;

    // Create a page break element
    // <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    const pBreak = mainDoc.createElementNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "w:p"
    );
    const rBreak = mainDoc.createElementNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "w:r"
    );
    const brBreak = mainDoc.createElementNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "w:br"
    );
    brBreak.setAttributeNS(
      "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "w:type",
      "page"
    );
    rBreak.appendChild(brBreak);
    pBreak.appendChild(rBreak);

    // Insert page break before mainSectPr
    if (mainSectPr) {
      mainBody.insertBefore(pBreak, mainSectPr);
    } else {
      mainBody.appendChild(pBreak);
    }

    // Append all child nodes of body (except the final w:sectPr)
    const childNodes = Array.from(body.childNodes);
    for (let j = 0; j < childNodes.length; j++) {
      const child = childNodes[j] as Element;
      // Skip the last w:sectPr (keep only body content paragraphs and tables)
      if (child.nodeName === "w:sectPr") {
        continue;
      }

      const importedNode = mainDoc.importNode(child, true);
      if (mainSectPr) {
        mainBody.insertBefore(importedNode, mainSectPr);
      } else {
        mainBody.appendChild(importedNode);
      }
    }
  }

  // Serialize the main document back to XML
  const serializer = new XMLSerializer();
  const serializedXml = serializer.serializeToString(mainDoc);

  // Write back to the main zip
  mainZip.file("word/document.xml", serializedXml);

  // Generate output blob
  return mainZip.generate({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
};

