"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Copy, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FILL_VARIABLE_MODULES,
  type FillVariable,
} from "@/lib/config/report-variables";

/**
 * Kamus variabel laporan — referensi semua token {{...}} yang bisa dipakai di
 * template file (.xlsx/.docx) yang diunggah admin. Daftar di
 * lib/config/report-variables.ts. Satu-satunya sistem pembuatan laporan kini
 * template file, jadi hanya sintaks substitusi {{snake_case}} yang ditampilkan.
 */

interface Entry {
  token: string;
  label: string;
  hint: string;
  status?: "siap" | "rencana";
}

const FILL_MODULES = FILL_VARIABLE_MODULES;
const tabs = FILL_MODULES.map((m) => ({ key: m.module, label: m.label }));

/** Token siap-salin dari sistem fill ({{...}}). */
function fillEntries(module: string): Entry[] {
  const mod = FILL_MODULES.find((m) => m.module === module);
  if (!mod) return [];
  const out: Entry[] = [];
  for (const g of mod.groups) {
    for (const v of g.variables as FillVariable[]) {
      out.push({
        token: v.name === "=..." ? "=SUM(...)" : `{{${v.name}}}`,
        label: `${g.label} · ${v.label}`,
        hint: v.description,
        status: v.status,
      });
    }
  }
  return out;
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
        <Badge variant={e.status === "rencana" ? "outline" : "secondary"} className="text-[10px]">
          {e.status === "rencana" ? "Rencana" : "Siap"}
        </Badge>
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    </button>
  );
}

export default function KamusVariabelPage() {
  const [query, setQuery] = useState("");

  const searching = query.trim().length > 0;
  const q = query.trim().toLowerCase();

  // Hasil pencarian lintas modul.
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const out: { module: string; moduleLabel: string; entries: Entry[] }[] = [];
    for (const t of tabs) {
      const entries = fillEntries(t.key).filter(
        (e) =>
          e.token.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.hint.toLowerCase().includes(q)
      );
      if (entries.length === 0) continue;
      out.push({ module: t.key, moduleLabel: t.label, entries });
    }
    return out;
  }, [q, searching]);

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
          placeholder="Cari variabel..."
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
            <Card key={r.module}>
              <CardContent className="space-y-2 pt-4">
                <h2 className="text-sm font-semibold">{r.moduleLabel}</h2>
                <div className="grid gap-2 md:grid-cols-2">
                  {r.entries.map((e) => (
                    <EntryRow key={`${r.module}-${e.token}`} e={e} />
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
            const entries = fillEntries(t.key);
            return (
              <TabsContent key={t.key} value={t.key} className="space-y-4">
                <Card>
                  <CardContent className="space-y-2 pt-4">
                    <h2 className="text-sm font-semibold">
                      Template Excel &amp; Surat{" "}
                      <span className="font-normal text-muted-foreground">(substitusi {"{{...}}"})</span>
                    </h2>
                    {entries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Belum ada variabel terdaftar untuk modul ini.
                      </p>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {entries.map((e) => (
                          <EntryRow key={e.token} e={e} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      <p className="text-xs text-muted-foreground">
        Template memakai sintaks {"{{nama}}"} (mis. {"{{sekolah_nama}}"}, {"{{nama}}"}). Variabel
        berstatus &quot;Rencana&quot; belum dieksekusi — hanya referensi untuk format baru.
      </p>
    </div>
  );
}