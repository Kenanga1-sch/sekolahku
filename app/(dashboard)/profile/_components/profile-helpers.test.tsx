import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getActionIcon, getFriendlyActionBadge } from "./profile-helpers";

describe("getActionIcon", () => {
  it("mengembalikan elemen svg untuk tiap aksi", () => {
    for (const action of ["LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE", "OTHER"]) {
      const html = renderToStaticMarkup(getActionIcon(action));
      expect(html).toContain("<svg");
    }
  });

  it("tidak case-sensitive", () => {
    expect(renderToStaticMarkup(getActionIcon("login"))).toContain("<svg");
  });
});

describe("getFriendlyActionBadge", () => {
  it("menampilkan label aksi yang dikenal", () => {
    expect(renderToStaticMarkup(getFriendlyActionBadge("LOGIN"))).toContain("LOGIN");
    expect(renderToStaticMarkup(getFriendlyActionBadge("UPDATE"))).toContain("UPDATE");
    expect(renderToStaticMarkup(getFriendlyActionBadge("DELETE"))).toContain("DELETE");
    expect(renderToStaticMarkup(getFriendlyActionBadge("CREATE"))).toContain("CREATE");
  });

  it("menampilkan aksi apa adanya untuk yang tidak dikenal", () => {
    expect(renderToStaticMarkup(getFriendlyActionBadge("CUSTOM"))).toContain("CUSTOM");
  });
});
