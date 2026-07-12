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
import { Plus, Trash2, Home, BookOpen, Layers, Star, Settings, Palette } from "lucide-react";

interface TabLandingSectionsProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
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
          <p className="text-xs text-muted-foreground">Kelola judul, deskripsi, tombol, dan kartu di tiap bagian landing page.</p>
        </div>
      </div>

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
                <CardContent className="grid grid-cols-2 gap-3">
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
