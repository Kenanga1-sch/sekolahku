import { describe, it, expect } from "vitest";
import {
  createDocumentFromBlocks,
  migrateContentBlocksToDocument,
  serializeDocument,
} from "@/lib/config/letter-document";

describe("letter-document: round-trip template", () => {
  it("serialize → migrate menghasilkan dokumen yang setara", () => {
    const doc = createDocumentFromBlocks(["kop_surat", "judul", "isi"], {
      letterTypeId: 3,
      jenisSurat: "Surat Undangan",
      standardCategory: "undangan",
    });
    const json = serializeDocument(doc);
    const restored = migrateContentBlocksToDocument(json);

    expect(restored.letterTypeId).toBe(3);
    expect(restored.jenisSurat).toBe("Surat Undangan");
    expect(restored.standardCategory).toBe("undangan");
    expect(restored.pages.length).toBe(doc.pages.length);
    // Jumlah blok terjaga pada halaman pertama.
    expect(restored.pages[0].blocks.length).toBe(doc.pages[0].blocks.length);
  });

  it("menerima struktur lama { blocks } dan membungkusnya jadi berhalaman", () => {
    const legacy = JSON.stringify({
      letterTypeId: 1,
      blocks: [
        { blockId: "kop_surat", enabled: true, data: {} },
        { blockId: "isi", enabled: true, data: { text: "Halo" } },
      ],
    });
    const restored = migrateContentBlocksToDocument(legacy);
    expect(restored.pages.length).toBeGreaterThanOrEqual(1);
    const ids = restored.pages.flatMap((p) => p.blocks.map((b) => b.blockId));
    expect(ids).toContain("kop_surat");
    expect(ids).toContain("isi");
  });

  it("mengembalikan dokumen kosong untuk input null", () => {
    const restored = migrateContentBlocksToDocument(null);
    expect(restored.pages).toHaveLength(1);
    expect(restored.pages[0].blocks).toHaveLength(0);
  });
});
