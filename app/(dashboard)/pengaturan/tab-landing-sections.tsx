"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Home, BookOpen, Layers, Star, Settings, Palette, Type, RotateCcw, Check } from "lucide-react";
import {
  DEFAULT_BRAND,
  BRAND_KEYS,
  RADIUS_OPTIONS,
  parseBrandTheme,
  isHex,
  type BrandTheme,
} from "@/lib/theme";

interface TabLandingSectionsProps {
  settings: any;
  setSettings: (patch: any) => void | Promise<void>;
}

const BRAND_LABELS: Record<string, string> = {
  primary: "Primer",
  secondary: "Sekunder",
  accent: "Aksen",
  background: "Latar",
  public_bg: "Latar Publik",
  foreground: "Teks Utama",
  muted_foreground: "Teks Redup",
  border: "Border",
};

function safeParseJson(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Input warna: color-picker + teks hex (commit hanya saat hex valid). */
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => {
            setText(e.target.value);
            onChange(e.target.value);
          }}
          className="h-8 w-9 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            if (isHex(v)) onChange(v);
          }}
          onBlur={() => setText(value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}

const SECTION_CONFIGS = [
  { id: "hero", title: "Hero (Beranda)", icon: Home, desc: "Bagian paling atas halaman depan", color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
  { id: "profil", title: "Profil Sekolah", icon: BookOpen, desc: "Sejarah, Visi, Misi", color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  { id: "fasilitas", title: "Fasilitas & Ekosistem", icon: Star, desc: "Kurikulum & Fasilitas", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
  { id: "layanan", title: "Layanan Mandiri", icon: Settings, desc: "Layanan untuk siswa & admin", color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
  { id: "spmb", title: "Portal SPMB", icon: Layers, desc: "Info penerimaan siswa baru", color: "text-rose-600", bg: "bg-rose-100 dark:bg-rose-900/30" },
];

const DEFAULT_SECTION = { heading: "", subheading: "", button: { label: "", url: "" }, items: [] };

export default function TabLandingSections({ settings, setSettings }: TabLandingSectionsProps) {
  const [sections, setSections] = useState<Record<string, any>>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // ---- Tema warna (brand_theme) ----
  const [themeDraft, setThemeDraft] = useState<BrandTheme>(() => parseBrandTheme(null));
  const [themeDirty, setThemeDirty] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    setThemeDraft(parseBrandTheme(settings?.brand_theme));
    setThemeDirty(false);
  }, [settings?.brand_theme]);

  const patchTheme = (patch: Partial<BrandTheme>) => {
    setThemeDraft((prev) => ({ ...prev, ...patch }));
    setThemeDirty(true);
  };

  const saveTheme = async () => {
    setThemeSaving(true);
    try {
      await setSettings({ brand_theme: JSON.stringify(themeDraft) });
      setThemeDirty(false);
    } catch (e) {
      console.error("Gagal menyimpan tema", e);
    } finally {
      setThemeSaving(false);
    }
  };

  // ---- Konten global (landing_tagline / landing_description / landing_texts) ----
  const emptyContent = { tagline: "", description: "", heroBadge: "", ctaLabel: "" };
  const [contentDraft, setContentDraft] = useState(emptyContent);
  const [contentDirty, setContentDirty] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);

  useEffect(() => {
    const texts = safeParseJson(settings?.landing_texts);
    setContentDraft({
      tagline: settings?.landing_tagline || "",
      description: settings?.landing_description || "",
      heroBadge: texts.hero_badge || "",
      ctaLabel: texts.cta_primary_label || "",
    });
    setContentDirty(false);
  }, [settings?.landing_tagline, settings?.landing_description, settings?.landing_texts]);

  const patchContent = (patch: Partial<typeof emptyContent>) => {
    setContentDraft((prev) => ({ ...prev, ...patch }));
    setContentDirty(true);
  };

  const saveContent = async () => {
    setContentSaving(true);
    try {
      // Baca-merge penuh: kunci milik tab Visi & Misi harus ikut bertahan.
      const texts = safeParseJson(settings?.landing_texts);
      texts.hero_badge = contentDraft.heroBadge;
      texts.cta_primary_label = contentDraft.ctaLabel;
      await setSettings({
        landing_tagline: contentDraft.tagline,
        landing_description: contentDraft.description,
        landing_texts: JSON.stringify(texts),
      });
      setContentDirty(false);
    } catch (e) {
      console.error("Gagal menyimpan konten global", e);
    } finally {
      setContentSaving(false);
    }
  };

  useEffect(() => {
    if (settings?.landing_sections) {
      try {
        setSections(JSON.parse(settings.landing_sections));
      } catch (e) {
        setSections({});
      }
    }
  }, [settings]);

  const saveSections = (newSections: Record<string, any>) => {
    setSections(newSections);
    setSettings((prev: any) => ({ ...prev, landing_sections: JSON.stringify(newSections) }));
  };

  const openEditor = (sectionId: string) => {
    setActiveSection(sectionId);
    setFormData(sections[sectionId] ? { ...sections[sectionId] } : { ...DEFAULT_SECTION });
    setIsSheetOpen(true);
  };

  const handleSheetSave = () => {
    if (!activeSection || !formData) return;
    const newSections = { ...sections, [activeSection]: formData };
    saveSections(newSections);
    setIsSheetOpen(false);
  };

  const resetSection = (sectionId: string) => {
    const { [sectionId]: _, ...rest } = sections;
    saveSections(rest);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Palette className="h-5 w-5 text-indigo-600" />
        <div>
          <p className="font-semibold text-sm">Atur Konten Halaman Depan</p>
          <p className="text-xs text-muted-foreground">Kelola tema warna, teks global, judul, deskripsi, tombol, dan kartu di tiap bagian landing page.</p>
        </div>
      </div>

      {/* ===== Kartu: Tema Warna ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Tema Warna</CardTitle>
                <CardDescription className="text-xs">
                  Warna berlaku untuk seluruh UI (publik & dashboard) setelah disimpan. Nilai kosong = warna default.
                </CardDescription>
              </div>
            </div>
            {themeDirty && (
              <span className="text-[11px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                Belum disimpan
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview langsung dari nilai draft (belum tentu tersimpan) */}
          <div className="rounded-lg border overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold" style={{ background: themeDraft.primary, color: "#ffffff" }}>
              Header · primer
            </div>
            <div className="p-3 flex flex-wrap items-center gap-2" style={{ background: themeDraft.background }}>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: themeDraft.primary, color: "#ffffff" }}>
                Tombol utama
              </span>
              <span className="px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: themeDraft.secondary, color: themeDraft.primary }}>
                Sekunder
              </span>
              <span className="text-xs font-medium" style={{ color: themeDraft.foreground }}>Teks</span>
              <span className="text-xs" style={{ color: themeDraft.muted_foreground }}>Teks redup</span>
              <span className="text-xs font-semibold" style={{ color: themeDraft.primary }}>Aksen</span>
              <span
                className="ml-auto text-[11px] px-2 py-1 rounded border"
                style={{ background: "#ffffff", borderColor: themeDraft.border, color: themeDraft.foreground }}
              >
                Kartu
              </span>
            </div>
            <div className="h-3" style={{ background: themeDraft.public_bg }} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {BRAND_KEYS.map((key) => (
              <ColorField
                key={key}
                label={BRAND_LABELS[key] || key}
                value={themeDraft[key]}
                onChange={(hex) => patchTheme({ [key]: hex })}
              />
            ))}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Radius Sudut</Label>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  onClick={() => patchTheme({ radius })}
                  className={`px-3 h-8 text-xs font-medium rounded-md border transition-colors ${
                    themeDraft.radius === radius
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {radius === "0.5rem" ? "Kecil" : radius === "0.75rem" ? "Sedang" : "Besar"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setThemeDraft({ ...DEFAULT_BRAND });
                setThemeDirty(true);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset Default
            </Button>
            <Button size="sm" onClick={saveTheme} disabled={!themeDirty || themeSaving}>
              {themeSaving ? "Menyimpan…" : (<><Check className="h-3.5 w-3.5 mr-1" /> Simpan Tema</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== Kartu: Konten Global ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                <Type className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Konten Global</CardTitle>
                <CardDescription className="text-xs">
                  Teks yang tampil di beberapa halaman publik, termasuk hero halaman depan.
                </CardDescription>
              </div>
            </div>
            {contentDirty && (
              <span className="text-[11px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                Belum disimpan
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs">Tagline (landing)</Label>
            <Input
              value={contentDraft.tagline}
              onChange={(e) => patchContent({ tagline: e.target.value })}
              placeholder="Sekolah Unggul, Berkarakter, Berdaya Saing"
            />
          </div>
          <div>
            <Label className="text-xs">Deskripsi Hero (halaman depan)</Label>
            <Textarea
              value={contentDraft.description}
              onChange={(e) => patchContent({ description: e.target.value })}
              rows={2}
              placeholder="Membangun generasi cerdas dan berkarakter…"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Label Badge Hero</Label>
              <Input
                value={contentDraft.heroBadge}
                onChange={(e) => patchContent({ heroBadge: e.target.value })}
                placeholder="Tahun Ajaran"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Kosongkan untuk teks default. Gunakan <code>{"{year}"}</code> untuk menyisipkan tahun ajaran.
              </p>
            </div>
            <div>
              <Label className="text-xs">Label Tombol Utama Hero</Label>
              <Input
                value={contentDraft.ctaLabel}
                onChange={(e) => patchContent({ ctaLabel: e.target.value })}
                placeholder="Daftar Sekarang"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Kosongkan untuk label otomatis (menyesuaikan status SPMB).
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={saveContent} disabled={!contentDirty || contentSaving}>
              {contentSaving ? "Menyimpan…" : (<><Check className="h-3.5 w-3.5 mr-1" /> Simpan Konten</>)}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTION_CONFIGS.map((config) => {
          const hasData = sections[config.id] && (sections[config.id].heading || sections[config.id].items?.length > 0);
          return (
            <Card
              key={config.id}
              className="hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer group relative"
              onClick={() => openEditor(config.id)}
            >
              {hasData && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-green-500" title="Sudah dikonfigurasi" />
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.bg} ${config.color}`}>
                    <config.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base group-hover:text-indigo-600 transition-colors">{config.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs">{config.desc}</CardDescription>
                {hasData && (
                  <p className="text-xs text-muted-foreground mt-2 truncate font-mono">
                    &quot;{sections[config.id].heading || sections[config.id].subheading || "Terkonfigurasi"}&quot;
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>
              Edit: {SECTION_CONFIGS.find((c) => c.id === activeSection)?.title}
            </SheetTitle>
            <SheetDescription>
              Ubah teks, tombol, dan kartu yang muncul di bagian ini pada halaman depan.
            </SheetDescription>
          </SheetHeader>

          {formData && (
            <div className="space-y-6 pb-20">
              {/* Heading & Subheading */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Judul & Deskripsi</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Judul Utama</Label>
                    <Input value={formData.heading || ""} onChange={(e) => setFormData((p: any) => ({ ...p, heading: e.target.value }))} placeholder="Contoh: Profil Sekolah" />
                  </div>
                  <div>
                    <Label className="text-xs">Deskripsi / Sub-judul</Label>
                    <Textarea value={formData.subheading || ""} onChange={(e) => setFormData((p: any) => ({ ...p, subheading: e.target.value }))} placeholder="Tulis deskripsi singkat..." rows={3} />
                  </div>
                </CardContent>
              </Card>

              {/* Button */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Tombol Aksi</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Label</Label>
                    <Input value={formData.button?.label || ""} onChange={(e) => setFormData((p: any) => ({ ...p, button: { ...p.button, label: e.target.value } }))} placeholder="Baca Selengkapnya" />
                  </div>
                  <div>
                    <Label className="text-xs">Tujuan URL</Label>
                    <Input value={formData.button?.url || ""} onChange={(e) => setFormData((p: any) => ({ ...p, button: { ...p.button, url: e.target.value } }))} placeholder="/profil/sejarah" />
                  </div>
                </CardContent>
              </Card>

              {/* Items / Cards */}
              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">Kartu / Item ({formData.items?.length || 0})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData((p: any) => ({ ...p, items: [...(p.items || []), { title: "", desc: "", icon: "", image: "", url: "" }] }));
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Tambah
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(!formData.items || formData.items.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">Belum ada kartu. Tambahkan kartu baru.</p>
                  )}
                  {formData.items?.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-lg border bg-slate-50/50 dark:bg-zinc-900/40 space-y-3 relative">
                      <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData((p: any) => ({ ...p, items: p.items.filter((_: any, i: number) => i !== idx) }));
                        }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="md:col-span-2"><Label className="text-xs">Judul</Label><Input value={item.title || ""} onChange={(e) => { const items = [...formData.items]; items[idx] = { ...items[idx], title: e.target.value }; setFormData((p: any) => ({ ...p, items })); }} /></div>
                        <div className="md:col-span-2"><Label className="text-xs">Deskripsi</Label><Textarea value={item.desc || ""} onChange={(e) => { const items = [...formData.items]; items[idx] = { ...items[idx], desc: e.target.value }; setFormData((p: any) => ({ ...p, items })); }} rows={2} /></div>
                        <div><Label className="text-xs">Ikon (Lucide)</Label><Input value={item.icon || ""} onChange={(e) => { const items = [...formData.items]; items[idx] = { ...items[idx], icon: e.target.value }; setFormData((p: any) => ({ ...p, items })); }} placeholder="BookOpen" /></div>
                        <div><Label className="text-xs">URL Gambar</Label><Input value={item.image || ""} onChange={(e) => { const items = [...formData.items]; items[idx] = { ...items[idx], image: e.target.value }; setFormData((p: any) => ({ ...p, items })); }} placeholder="/images/..." /></div>
                        <div className="md:col-span-2"><Label className="text-xs">URL Tautan</Label><Input value={item.url || ""} onChange={(e) => { const items = [...formData.items]; items[idx] = { ...items[idx], url: e.target.value }; setFormData((p: any) => ({ ...p, items })); }} placeholder="/tautan" /></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" size="sm" className="text-red-500 hover:bg-red-50"
                  onClick={() => { if (activeSection) { resetSection(activeSection); setIsSheetOpen(false); } }}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Reset Bagian Ini
                </Button>
                <Button onClick={handleSheetSave}>
                  Simpan & Tutup
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
