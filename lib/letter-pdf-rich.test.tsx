// Tes jaring pengaman untuk renderer rich-text → React-PDF (letter-pdf-rich).
// Mengunci perilaku paragraf, bullet/ordered list, heading, dan substitusi {{var}}.
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { renderRich, renderInlineChildren } from "./letter-pdf-rich";
import { buildStyles } from "./letter-pdf-styles";
import type { BlockRenderCtx } from "./letter-pdf-rich";
import type { LetterStandard } from "@/lib/config/letter-standards";

const standard = {
  typography: { fontFamily: "Arial", fontSize: 12, headerFontSize: 16, lineHeight: 1.5, paragraphSpacing: 6 },
  margins: { top: 20, right: 20, bottom: 20, left: 20 },
} as unknown as LetterStandard;

function ctx(): BlockRenderCtx {
  return {
    styles: buildStyles(standard),
    school: { schoolName: "S", npsn: "1", address: "A" },
    vars: { nama: "Budi" },
    standard,
  };
}

function tiptapDoc(content: unknown[], type = "doc") {
  return JSON.stringify({ type, content });
}

describe("renderRich", () => {
  it("mengembalikan null untuk json kosong / tak valid", () => {
    expect(renderRich("", ctx(), "k")).toBeNull();
    expect(renderRich("bukan-json", ctx(), "k")).toBeNull();
    expect(renderRich(JSON.stringify({ type: "doc", content: [] }), ctx(), "k")).toBeNull();
  });

  it("merender paragraf dengan substitusi variabel", () => {
    const json = tiptapDoc([
      { type: "paragraph", content: [{ type: "text", text: "Halo {{nama}}" }] },
    ]);
    const el = renderRich(json, ctx(), "k")!;
    const { container } = render(<>{el}</>);
    expect(container.textContent).toContain("Halo Budi");
  });

  it("merender ordered list dengan penomoran", () => {
    const json = tiptapDoc([
      {
        type: "orderedList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "satu" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "dua" }] }] },
        ],
      },
    ]);
    const { container } = render(<>{renderRich(json, ctx(), "k")!}</>);
    expect(container.textContent).toContain("1.");
    expect(container.textContent).toContain("2.");
    expect(container.textContent).toContain("satu");
    expect(container.textContent).toContain("dua");
  });

  it("merender bullet list dengan penanda •", () => {
    const json = tiptapDoc([
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] },
        ],
      },
    ]);
    const { container } = render(<>{renderRich(json, ctx(), "k")!}</>);
    expect(container.textContent).toContain("•");
    expect(container.textContent).toContain("item");
  });

  it("merender heading", () => {
    const json = tiptapDoc([{ type: "heading", content: [{ type: "text", text: "Judul" }] }]);
    const { container } = render(<>{renderRich(json, ctx(), "k")!}</>);
    expect(container.textContent).toContain("Judul");
  });
});

describe("renderInlineChildren", () => {
  it("mengembalikan array kosong untuk undefined", () => {
    expect(renderInlineChildren(undefined, ctx(), "k")).toEqual([]);
  });

  it("mempertahankan teks tanpa variabel apa adanya", () => {
    const nodes = [{ type: "text", text: "teks biasa" }] as any;
    const nodes2 = renderInlineChildren(nodes, ctx(), "k");
    const { container } = render(<>{nodes2}</>);
    expect(container.textContent).toContain("teks biasa");
  });
});
