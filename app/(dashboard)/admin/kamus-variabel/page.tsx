"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  REPORT_VARIABLE_MODULES,
  getVariableModule,
} from "@/lib/report-variables";
import {
  FILL_VARIABLE_MODULES,
  type FillVariable,
} from "@/lib/config/report-variables";

/**
 * Kamus variabel laporan — referensi semua token yang bisa dipakai di
 * template, dipisah tab per modul. Dua sistem ditampilkan berdampingan:
 * - Template Excel/Surat (substitusi {{...}} saat fill) — presensi-excel.ts,
 *   letter-*.ts; daftar di lib/config/report-variables.ts.
 * - Report Builder (grid engine: baris {data.field}, rekap {{path}}) —
 *   daftar di lib/report-variables.ts.
 */

interface Entry {
  token: string;
  label: string;
  hint: string;
  system: "fill" | "rb";
  status?: "siap" | "rencana";
}

const FILL_MODULES = FILL_VARIABLE_MODULES;
const FILL_MODULE_KEYS = FILL_MODULES.map((m) => m.module);

/** Token siap-salin dari sistem fill ({{...}}). */
function fillEntries(module: string): Entry[] {
  const mod = FILL_MODULES.find((m) => m.module === module);
  if (!mod) return [];
  const out: Entry[] = [];
  for (const g of mod.groups) {
    for (const v of g.variables as FillVariable[]) {
      out.push({
        token: v.name === "=…" ? "=COUNTIF(...)" : `{{${v.name}}}`,
        label: `${g.label} · ${v.label}`,
        hint: v.description,
        system: "fill",
        status: v.status,
      });
    }
  }
  return out;
}

/** Token siap-salin dari Report Builder ({...} baris / {{...}} rekap). */
function rbEntries(module: string): Entry[] {
  const def = getVariableModule(module);
  const out: Entry[] = [];
  for (const g of def.groups) {
    for (const f of g.fields) {
      const token = g.scope === "row" ? `{${f.token}}` : `{{${f.token}}}`;
      out.push({
        token,
        label: `${g.label} · ${f.label}`,
        hint: f.hint || (g.scope === "row" ? "Baris dataset — dirender per record" : "Nilai tunggal/rekap"),
        system: "rb",
      });
    }
  }
  return out;
}

function allEntries(module: string): Entry[] {
  return [...fillEntries(module), ...rbEntries(module)];
}

function EntryRow({ e }: { e: Entry }) {
  const copy = () => {
    navigator.clipboard.writeText(e.token).then(
      () => toast.success(`Disalin: ${e.token}`),
      () => toast.error("Gagal menyalin")
    );
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted/50"
    >
      <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
        {e.token}
      </code>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{e.label}</span>
        <span className="block text-xs text-muted-foreground">{e.hint}</span>
      </span>
      <span className="mt-0.5 flex shrink-0 items-center gap-1">
        {e.system === "fill" && (
          <Badge variant={e.status === "rencana" ? "outline" : "secondary"} className="text-[10px]">
            {e.status === "rencana" ? "Rencana" : "Excel/Surat"}
          </Badge>
        )}
        {e.system === "rb" && (
          <Badge variant="outline" className="text-[10px]">Builder</Badge>
        )}
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

export default function KamusVariabelPage() {
  const [query, setQuery] = useState("");

  // Daftar tab: modul Report Builder (termasuk "umum") + surat (sistem fill).
  const tabs = useMemo(() => {
    const rb = REPORT_VARIABLE_MODULES.map((m) => ({ key: m.module, label: m.label }));
    if (!rb.some((t) => t.key === "surat")) rb.push({ key: "surat", label: "Surat" });
    return rb;
  }, []);

  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();

  // Hasil pencarian lintas modul & sistem.
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const seen = new Set<string>();
    const out: { module: string; moduleLabel: string; entries: Entry[] }[] = [];
    for (const t of tabs) {
      const entries = allEntries(t.key).filter(
        (e) =>
          e.token.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.hint.toLowerCase().includes(q)
      );
      if (entries.length === 0) continue;
      const key = `${t.key}:${entries.map((e) => e.token).join("|")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ module: t.key, moduleLabel: t.label, entries });
    }
    return out;
  }, [q, searching, tabs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Kamus Variabel Laporan</h1>
          <p className="text-sm text-muted-foreground">
            Daftar token yang bisa dipakai di template. Klik untuk menyalin.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Cari variabel…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {searching ? (
        <div className="space-y-4">
          {searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada variabel yang cocok.</p>
          )}
          {searchResults.map((r) => (
            <Card key={`${r.module}-${r.entries[0]?.token}`}>
              <CardContent className="space-y-2 pt-4">
                <h2 className="text-sm font-semibold">{r.moduleLabel}</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {r.entries.map((e) => (
                    <EntryRow key={`${r.module}-${e.system}-${e.token}`} e={e} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs defaultValue={tabs[0]?.key}>
          <TabsList className="h-auto flex-wrap">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => {
            const entries = allEntries(t.key);
            const fill = entries.filter((e) => e.system === "fill");
            const rb = entries.filter((e) => e.system === "rb");
            return (
              <TabsContent key={t.key} value={t.key} className="space-y-4">
                {fill.length > 0 && (
                  <Card>
                    <CardContent className="space-y-2 pt-4">
                      <h2 className="text-sm font-semibold">
                        Template Excel &amp; Surat <span className="font-normal text-muted-foreground">(substitusi {"{{…}}"})</span>
                      </h2>
                      <div className="grid gap-2 md:grid-cols-2">
                        {fill.map((e) => (
                          <EntryRow key={`fill-${e.token}`} e={e} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {rb.length > 0 && (
                  <Card>
                    <CardContent className="space-y-2 pt-4">
                      <h2 className="text-sm font-semibold">
                        Report Builder <span className="font-normal text-muted-foreground">(baris {"{data.field}"} · rekap {"{{path}}"})</span>
                      </h2>
                      <div className="grid gap-2 md:grid-cols-2">
                        {rb.map((e) => (
                          <EntryRow key={`rb-${e.token}`} e={e} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {fill.length === 0 && rb.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Belum ada variabel terdaftar untuk modul ini.
                  </p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <p className="text-xs text-muted-foreground">
        Sistem berbeda punya sintaks berbeda: Excel/Surat memakai {"{{nama}}"}, Report Builder
        memakai {"{data.field}"} untuk baris dataset dan {"{{path}}"} untuk nilai rekap.
        Variabel berstatus "Rencana" belum dieksekusi — hanya referensi untuk format baru.
      </p>
    </div>
  );
}
