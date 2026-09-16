import { saveAs } from "file-saver";

interface QuestionForExport {
  id: string;
  type: string;
  content: string;
  options?: string;
  correctAnswer?: string;
  points: number;
  orderNumber: number;
  mediaUrl?: string;
}

interface ExportOptions {
  title: string;
  subtitle?: string;
  shuffleOptions: boolean;
  shuffleQuestions: boolean;
  showAnswers: boolean;
  schoolName?: string;
  academicYear?: string;
  subjectName?: string;
  className?: string;
  examDate?: string;
}

const TYPE_LABELS: Record<string, string> = {
  pg_single: "PG Tunggal",
  pg_multi: "PG Multi",
  true_false: "Benar/Salah",
  fill_blank: "Isian",
  matching: "Menjodohkan",
  pair_match: "Mencocokkan",
  essay: "Esai",
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Parse options JSON safely; returns [] on any failure. */
function parseOptions(q: QuestionForExport): any[] {
  if (!q.options) return [];
  try {
    const parsed = JSON.parse(q.options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Format the correct answer into a human-readable string per question type. */
function formatAnswer(q: QuestionForExport): string {
  const raw = q.correctAnswer || "";
  const t = q.type;

  if (t === "pg_single" || t === "true_false") {
    return raw || "-";
  }

  if (t === "pg_multi") {
    // Kontrak baru: array teks pilihan benar, mis. ["Jakarta","Bandung"].
    try {
      const arr: string[] = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) return "-";
      const opts = parseOptions(q);
      const letters = arr.map((txt) => {
        const idx = opts.findIndex((o: any) => o?.text === txt);
        return idx >= 0 && idx < LETTERS.length ? `${LETTERS[idx]} (${txt})` : txt;
      });
      return letters.join(", ");
    } catch {
      return raw || "-";
    }
  }

  if (t === "fill_blank") {
    try {
      const arr: string[] = JSON.parse(raw);
      return Array.isArray(arr) && arr.length ? arr.join(" / ") : raw || "-";
    } catch {
      return raw || "-";
    }
  }

  if (t === "matching" || t === "pair_match") {
    // correctAnswer = {"leftId": "rightId"}; options = pasangan {id,left,right,rightId}.
    try {
      const correct: Record<string, string> = JSON.parse(raw);
      const opts = parseOptions(q);
      const rows = Object.entries(correct).map(([leftId, rightId]) => {
        const pair = opts.find((o: any) => String(o?.id) === String(leftId));
        const right = opts.find((o: any) => String(o?.rightId ?? o?.id) === String(rightId));
        return `${pair?.left ?? leftId} → ${right?.right ?? rightId}`;
      });
      return rows.length ? rows.join("; ") : "-";
    } catch {
      return raw || "-";
    }
  }

  if (t === "essay") return "Dikoreksi manual";

  return raw || "-";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function imageFormat(url: string): "PNG" | "JPEG" | null {
  const ext = (url.split(".").pop() || "").split("?")[0].toLowerCase();
  if (ext === "png") return "PNG";
  if (ext === "jpg" || ext === "jpeg") return "JPEG";
  return null;
}

/** Baca dimensi (px) dari PNG/JPEG. */
function imageDimensions(buf: ArrayBuffer, fmt: "PNG" | "JPEG"): { w: number; h: number } | null {
  const bytes = new Uint8Array(buf);
  if (fmt === "PNG" && bytes.length >= 24 && bytes[0] === 0x89) {
    const dv = new DataView(buf, 16, 8);
    return { w: dv.getInt32(0), h: dv.getInt32(4) };
  }
  if (fmt === "JPEG" && bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2 || marker === 0xc3) {
        const dv = new DataView(buf, i + 5, 4);
        return { h: dv.getInt16(0), w: dv.getInt16(2) };
      }
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      i += 2 + len;
    }
  }
  return null;
}

export async function exportToPDF(
  questions: QuestionForExport[],
  options: ExportOptions
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  let currentY = margin;

  // Header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(options.schoolName || "SEKOLAH", pageWidth / 2, currentY, { align: "center" });
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (options.academicYear) {
    doc.text(options.academicYear, pageWidth / 2, currentY, { align: "center" });
    currentY += 6;
  }

  // Baris mata pelajaran / kelas / tanggal
  const metaParts: string[] = [];
  if (options.subjectName) metaParts.push(`Mata Pelajaran: ${options.subjectName}`);
  if (options.className) metaParts.push(`Kelas: ${options.className}`);
  if (metaParts.length) {
    doc.setFontSize(9);
    doc.text(metaParts.join("   |   "), pageWidth / 2, currentY, { align: "center" });
    currentY += 5;
  }
  if (options.examDate) {
    doc.setFontSize(9);
    doc.text(`Tanggal: ${options.examDate}`, pageWidth / 2, currentY, { align: "center" });
    currentY += 6;
  }

  // Title
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, pageWidth / 2, currentY + 4, { align: "center" });
  currentY += 10;

  if (options.subtitle) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(options.subtitle, pageWidth / 2, currentY, { align: "center" });
    currentY += 8;
  }

  // Line separator
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Questions
  let processedQuestions = [...questions];
  if (options.shuffleQuestions) {
    processedQuestions = shuffleArray(processedQuestions);
  }

  for (const [idx, q] of processedQuestions.entries()) {
    const ensureSpace = (needed: number) => {
      if (currentY + needed > pageHeight - 24) {
        doc.addPage();
        currentY = margin;
      }
    };

    ensureSpace(14);

    // Question number and content
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}.`, margin, currentY);

    doc.setFont("helvetica", "normal");
    const contentLines = doc.splitTextToSize(stripHtml(q.content), contentWidth - 10);
    doc.text(contentLines, margin + 8, currentY);
    currentY += contentLines.length * 5;

    // Media (gambar)
    if (q.mediaUrl) {
      const fmt = imageFormat(q.mediaUrl);
      if (fmt) {
        try {
          const res = await fetch(q.mediaUrl);
          if (res.ok) {
            const blob = await res.blob();
            const dataUrl = await blobToDataUrl(blob);
            const props = doc.getImageProperties(dataUrl);
            const maxW = contentWidth - 24;
            const maxH = 70;
            let w = Math.min(maxW, (props.width / props.height) * maxH);
            let h = (props.height / props.width) * w;
            if (h > maxH) { h = maxH; w = (props.width / props.height) * h; }
            ensureSpace(h + 6);
            doc.addImage(dataUrl, fmt, margin + 12, currentY, w, h);
            currentY += h + 5;
          }
        } catch {
          /* lewati gambar yang gagal dimuat */
        }
      }
    }

    // Options (for PG types)
    if (q.type === "pg_single" || q.type === "pg_multi") {
      let opts = parseOptions(q);
      if (options.shuffleOptions) opts = shuffleArray(opts);

      for (const [oIdx, opt] of opts.entries()) {
        ensureSpace(8);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const letter = LETTERS[oIdx] ?? String(oIdx + 1);
        const optLines = doc.splitTextToSize(`${letter}. ${stripHtml(opt.text || "")}`, contentWidth - 24);
        doc.text(optLines, margin + 12, currentY);
        currentY += optLines.length * 5;
      }
    }

    // True/False
    if (q.type === "true_false") {
      ensureSpace(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("(   ) Benar        (   ) Salah", margin + 12, currentY);
      currentY += 6;
    }

    // Fill blank
    if (q.type === "fill_blank") {
      ensureSpace(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Jawaban: _________________________________", margin + 12, currentY);
      currentY += 6;
    }

    // Matching / pair_match: dua kolom (kiri nomor, kanan huruf)
    if (q.type === "matching" || q.type === "pair_match") {
      const pairs = parseOptions(q);
      if (pairs.length) {
        const rightColX = pageWidth / 2;
        let rights = pairs.map((p: any) => ({ ...p }));
        if (options.shuffleOptions) rights = shuffleArray(rights);

        ensureSpace(pairs.length * 6 + 4);
        const startY = currentY;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        pairs.forEach((p: any, i: number) => {
          const lLines = doc.splitTextToSize(`${i + 1}. ${stripHtml(p.left || "")}`, rightColX - margin - 28);
          doc.text(lLines, margin + 12, currentY);
          currentY += Math.max(6, lLines.length * 5);
        });
        let rightY = startY;
        rights.forEach((p: any, i: number) => {
          const rLines = doc.splitTextToSize(`${LETTERS[i] ?? String(i + 1)}. ${stripHtml(p.right || "")}`, pageWidth - margin - rightColX - 8);
          doc.text(rLines, rightColX, rightY);
          rightY += Math.max(6, rLines.length * 5);
        });
        currentY = Math.max(currentY, rightY) + 2;
      }
    }

    // Essay
    if (q.type === "essay") {
      ensureSpace(8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Jawaban:", margin + 12, currentY);
      currentY += 6;
      // Draw lines for essay
      for (let i = 0; i < 4; i++) {
        ensureSpace(8);
        doc.setDrawColor(200);
        doc.setLineWidth(0.2);
        doc.line(margin + 12, currentY, pageWidth - margin, currentY);
        currentY += 6;
      }
    }

    currentY += 4;
  }

  // Nomor halaman
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    doc.setTextColor(0);
  }

  // Answer key (if showAnswers)
  if (options.showAnswers) {
    doc.addPage();
    currentY = margin;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("KUNCI JAWABAN", pageWidth / 2, currentY, { align: "center" });
    currentY += 10;

    // Table for answer key
    const tableData = processedQuestions.map((q, idx) => [
      `${idx + 1}`,
      TYPE_LABELS[q.type] || q.type,
      formatAnswer(q),
      `${q.points}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["No", "Tipe", "Jawaban", "Poin"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: { 2: { cellWidth: 80 } },
      didDrawPage: () => {
        const pageNum = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Halaman ${pageNum} dari ${totalPages + 1}`, pageWidth / 2, pageHeight - 10, { align: "center" });
        doc.setTextColor(0);
      },
    });
  }

  // Save
  const filename = `${options.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
  doc.save(filename);
  return filename;
}

export async function exportToWord(
  questions: QuestionForExport[],
  options: ExportOptions
) {
  const { default: PizZip } = await import("pizzip");

  let processedQuestions = [...questions];
  if (options.shuffleQuestions) {
    processedQuestions = shuffleArray(processedQuestions);
  }

  // Kumpulkan gambar (fetch → part word/media + rels)
  const imageMap = new Map<string, { rid: string; cx: number; cy: number }>();
  const contentDefaults = new Set<string>();
  let ridCounter = 10;
  let mediaCounter = 1;

  for (const q of processedQuestions) {
    if (!q.mediaUrl || imageMap.has(q.mediaUrl)) continue;
    const fmt = imageFormat(q.mediaUrl);
    if (!fmt) continue;
    try {
      const res = await fetch(q.mediaUrl);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const dims = imageDimensions(buf, fmt) || { w: 640, h: 480 };
      const ext = fmt === "PNG" ? "png" : "jpg";
      contentDefaults.add(ext);
      const rid = `rIdImg${ridCounter++}`;
      const maxWemu = 5029200; // ~5.5 inch
      const cx = Math.min(maxWemu, Math.round((dims.w / dims.h) * 3810000));
      let cy = 3810000;
      if (cx === maxWemu) { cy = Math.round((dims.h / dims.w) * maxWemu); }
      imageMap.set(q.mediaUrl, { rid, cx, cy });
      // disimpan nanti setelah zip dibuat
      (imageMap.get(q.mediaUrl) as any)._buf = buf;
      (imageMap.get(q.mediaUrl) as any)._ext = ext;
      (imageMap.get(q.mediaUrl) as any)._name = `word/media/image${mediaCounter++}.${ext}`;
    } catch {
      /* lewati */
    }
  }

  const drawingXml = (q: QuestionForExport): string => {
    const info = q.mediaUrl ? imageMap.get(q.mediaUrl) : null;
    if (!info) return "";
    const picId = info.rid.replace(/\D/g, "");
    return `<w:p><w:pPr><w:ind w:left="720"/><w:spacing w:before="40" w:after="40"/></w:pPr><w:r><w:drawing>
      <wp:inline distT="0" distB="0" distL="0" distR="0">
        <wp:extent cx="${info.cx}" cy="${info.cy}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:docPr id="${picId}" name="Gambar ${picId}"/>
        <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
        <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:nvPicPr><pic:cNvPr id="${picId}" name="Gambar ${picId}"/><pic:cNvPicPr/></pic:nvPicPr>
              <pic:blipFill><a:blip r:embed="${info.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
              <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${info.cx}" cy="${info.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
            </pic:pic>
          </a:graphicData>
        </a:graphic>
      </wp:inline></w:r></w:p>`;
  };

  // Build question XML content
  let questionsXml = "";

  for (const [idx, q] of processedQuestions.entries()) {
    // Question number and content
    questionsXml += `
      <w:p>
        <w:pPr>
          <w:spacing w:before="120" w:after="60"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:b/>
            <w:sz w:val="22"/>
          </w:rPr>
          <w:t xml:space="preserve">${idx + 1}. ${escapeXml(stripHtml(q.content))}</w:t>
        </w:r>
      </w:p>`;

    if (q.mediaUrl) questionsXml += drawingXml(q);

    // Options (PG)
    if (q.type === "pg_single" || q.type === "pg_multi") {
      let opts = parseOptions(q);
      if (options.shuffleOptions) opts = shuffleArray(opts);
      opts.forEach((opt: any, oIdx: number) => {
        const letter = LETTERS[oIdx] ?? String(oIdx + 1);
        questionsXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="720"/>
          <w:spacing w:before="40" w:after="40"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="21"/></w:rPr>
          <w:t xml:space="preserve">${letter}. ${escapeXml(stripHtml(opt.text || ""))}</w:t>
        </w:r>
      </w:p>`;
      });
    }

    // True/False
    if (q.type === "true_false") {
      questionsXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="720"/>
          <w:spacing w:before="40" w:after="40"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="21"/></w:rPr>
          <w:t xml:space="preserve">(   ) Benar        (   ) Salah</w:t>
        </w:r>
      </w:p>`;
    }

    // Fill blank
    if (q.type === "fill_blank") {
      questionsXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="720"/>
          <w:spacing w:before="40" w:after="40"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="21"/></w:rPr>
          <w:t xml:space="preserve">Jawaban: _________________________________</w:t>
        </w:r>
      </w:p>`;
    }

    // Matching / pair_match: tabel dua kolom (kiri nomor, kanan huruf)
    if (q.type === "matching" || q.type === "pair_match") {
      const pairs = parseOptions(q);
      if (pairs.length) {
        let rights = pairs.map((p: any) => ({ ...p }));
        if (options.shuffleOptions) rights = shuffleArray(rights);

        const cell = (txt: string) => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr><w:p><w:pPr><w:spacing w:before="20" w:after="20"/></w:pPr><w:r><w:rPr><w:sz w:val="21"/></w:rPr><w:t xml:space="preserve">${escapeXml(txt)}</w:t></w:r></w:p></w:tc>`;
        // Bangun tabel dua kolom: kiri (nomor) & kanan (huruf, urutannya diacak)
        const maxRows = Math.max(pairs.length, rights.length);
        let trXml = "";
        for (let i = 0; i < maxRows; i++) {
          const l = i < pairs.length ? cell(`${i + 1}. ${stripHtml(pairs[i].left || "")}`) : `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
          const r = i < rights.length ? cell(`${LETTERS[i] ?? String(i + 1)}. ${stripHtml(rights[i].right || "")}`) : `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
          trXml += `<w:tr>${l}${r}</w:tr>`;
        }
        questionsXml += `
      <w:tbl>
        <w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="999999"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="999999"/>
        </w:tblBorders></w:tblPr>
        <w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>
        ${trXml}
      </w:tbl>
      <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr></w:p>`;
      }
    }

    // Essay
    if (q.type === "essay") {
      questionsXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="720"/>
          <w:spacing w:before="40" w:after="40"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="21"/></w:rPr>
          <w:t xml:space="preserve">Jawaban:</w:t>
        </w:r>
      </w:p>`;
      for (let i = 0; i < 4; i++) {
        questionsXml += `
      <w:p>
        <w:pPr>
          <w:ind w:left="720"/>
          <w:pBdr>
            <w:bottom w:val="single" w:sz="4" w:space="1" w:color="CCCCCC"/>
          </w:pBdr>
          <w:spacing w:before="60" w:after="60"/>
        </w:pPr>
      </w:p>`;
      }
    }
  }

  // Answer key
  let answerKeyXml = "";
  if (options.showAnswers) {
    answerKeyXml = `
    <w:p>
      <w:pPr>
        <w:spacing w:before="240" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>KUNCI JAWABAN</w:t>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:shd w:fill="3B82F6"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>No</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:fill="3B82F6"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Tipe</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:fill="3B82F6"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Jawaban</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:fill="3B82F6"/></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Poin</w:t></w:r></w:p></w:tc>
      </w:tr>
      ${processedQuestions.map((q, idx) => `
      <w:tr>
        <w:tc><w:p><w:r><w:t>${idx + 1}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(TYPE_LABELS[q.type] || q.type)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${escapeXml(formatAnswer(q))}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${q.points}</w:t></w:r></w:p></w:tc>
      </w:tr>`).join("")}
    </w:tbl>`;
  }

  // Baris meta (mapel/kelas/tanggal)
  const metaParts: string[] = [];
  if (options.subjectName) metaParts.push(`Mata Pelajaran: ${options.subjectName}`);
  if (options.className) metaParts.push(`Kelas: ${options.className}`);
  const metaXml = metaParts.length
    ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(metaParts.join("   |   "))}</w:t></w:r></w:p>`
    : "";
  const dateXml = options.examDate
    ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>Tanggal: ${escapeXml(options.examDate)}</w:t></w:r></w:p>`
    : "";

  // Footer part (nomor halaman: field PAGE)
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footer xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr><w:jc w:val="center"/></w:pPr>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:r><w:t xml:space="preserve"> dari </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:footer>`;

  // Styles minimal (font dasar Calibri 11pt)
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>`;

  // Full document XML
  const docXml = `
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t>${escapeXml(options.schoolName || "SEKOLAH")}</w:t>
      </w:r>
    </w:p>
    ${options.academicYear ? `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="20"/></w:rPr>
        <w:t>${escapeXml(options.academicYear)}</w:t>
      </w:r>
    </w:p>` : ""}
    ${metaXml}
    ${dateXml}
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="60"/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/>
        </w:pBdr>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>${escapeXml(options.title)}</w:t>
      </w:r>
    </w:p>
    ${options.subtitle ? `
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:sz w:val="18"/></w:rPr>
        <w:t>${escapeXml(options.subtitle)}</w:t>
      </w:r>
    </w:p>` : ""}
    ${questionsXml}
    ${answerKeyXml}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // Create docx from XML
  const zip = new PizZip();

  const defaultExts = ["rels", "xml"];
  contentDefaults.forEach((e) => defaultExts.push(e));

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${[...contentDefaults].map((e) => `<Default Extension="${e}" ContentType="${e === "png" ? "image/png" : "image/jpeg"}"/>`).join("")}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const imageRels = [...imageMap.values()]
    .map((info: any) => `<Relationship Id="${info.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${info._name.replace("word/media/", "")}"/>`)
    .join("");

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  ${imageRels}
</Relationships>`
  );

  zip.file("word/document.xml", docXml);
  zip.file("word/footer1.xml", footerXml);
  zip.file("word/styles.xml", stylesXml);

  // Tulis part gambar
  for (const info of [...imageMap.values()] as any[]) {
    zip.file(info._name, info._buf);
  }

  const blob = zip.generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const filename = `${options.title.replace(/[^a-zA-Z0-9]/g, "_")}.docx`;
  saveAs(blob, filename);
  return filename;
}
