"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Plus, Trash2, Home, BookOpen, Layers, Star, Settings } from "lucide-react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { goGet, goPut } from "@/lib/api-client";
import { toast } from "sonner";
import { mutate } from "swr";

const SECTION_CONFIGS = [
  { id: "hero", title: "Hero (Beranda)", icon: Home, desc: "Bagian paling atas halaman depan" },
  { id: "profil", title: "Profil Sekolah", icon: BookOpen, desc: "Sejarah, Visi, Misi" },
  { id: "fasilitas", title: "Fasilitas & Ekosistem", icon: Star, desc: "Kurikulum & Fasilitas" },
  { id: "layanan", title: "Layanan Mandiri", icon: Settings, desc: "Layanan untuk siswa & admin" },
  { id: "spmb", title: "Portal SPMB", icon: Layers, desc: "Info penerimaan siswa baru" },
];

const DEFAULT_SECTION_DATA = {
  heading: "",
  subheading: "",
  button: { label: "", url: "" },
  items: []
};

export default function HalamanDepanPage() {
  const { settings, isLoading } = useSchoolSettings();
  
  const [sections, setSections] = useState<any>({});
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (settings?.landing_sections) {
      try {
        setSections(JSON.parse(settings.landing_sections));
      } catch (e) {
        console.error("Failed to parse landing_sections", e);
      }
    }
  }, [settings]);

  const openEditor = (sectionId: string) => {
    setActiveSection(sectionId);
    setFormData(sections[sectionId] || { ...DEFAULT_SECTION_DATA });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!activeSection || !formData) return;
    
    setIsSaving(true);
    try {
      const newSections = { ...sections, [activeSection]: formData };
      const res = await goPut("/api/admin/settings", {
        landing_sections: JSON.stringify(newSections)
      });
      
      if (res.success) {
        setSections(newSections);
        mutate("/api/public/school-settings");
        toast.success("Pengaturan bagian berhasil disimpan.");
        setIsSheetOpen(false);
      } else {
        throw new Error(res.message || "Failed to save");
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateButton = (field: string, value: string) => {
    setFormData((prev: any) => ({
      ...prev,
      button: { ...(prev.button || {}), [field]: value }
    }));
  };

  const addItem = () => {
    setFormData((prev: any) => ({
      ...prev,
      items: [...(prev.items || []), { title: "", desc: "", icon: "", image: "", url: "" }]
    }));
  };

  const updateItem = (index: number, field: string, value: string) => {
    setFormData((prev: any) => {
      const newItems = [...(prev.items || [])];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index: number) => {
    setFormData((prev: any) => {
      const newItems = [...(prev.items || [])];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan Halaman Depan</h1>
        <p className="text-muted-foreground">
          Pilih bagian mana dari halaman depan yang ingin Anda edit (Judul, Teks, Poin, & Tombol).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SECTION_CONFIGS.map((config) => (
          <Card key={config.id} className="hover:border-indigo-500 transition-colors cursor-pointer" onClick={() => openEditor(config.id)}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
                  <config.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{config.desc}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Edit Bagian: {SECTION_CONFIGS.find(c => c.id === activeSection)?.title}</SheetTitle>
            <SheetDescription>Ubah teks, tombol, dan poin-poin yang akan muncul di halaman depan.</SheetDescription>
          </SheetHeader>

          {formData && (
            <div className="space-y-6 pb-20">
              <div className="space-y-4">
                <div>
                  <Label>Judul Utama (Heading)</Label>
                  <Input 
                    value={formData.heading || ""} 
                    onChange={(e) => updateField("heading", e.target.value)} 
                    placeholder="Contoh: Profil Sekolah"
                  />
                </div>
                <div>
                  <Label>Deskripsi / Sub-judul</Label>
                  <Textarea 
                    value={formData.subheading || ""} 
                    onChange={(e) => updateField("subheading", e.target.value)} 
                    placeholder="Tulis deskripsi singkat..."
                    rows={4}
                  />
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-slate-50 dark:bg-zinc-900/50 space-y-4">
                <h3 className="font-medium">Tombol Aksi Utama</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Label Tombol</Label>
                    <Input 
                      value={formData.button?.label || ""} 
                      onChange={(e) => updateButton("label", e.target.value)} 
                      placeholder="Contoh: Baca Selengkapnya"
                    />
                  </div>
                  <div>
                    <Label>Tujuan URL</Label>
                    <Input 
                      value={formData.button?.url || ""} 
                      onChange={(e) => updateButton("url", e.target.value)} 
                      placeholder="Contoh: /profil/sejarah"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Daftar Item / Card Kecil</h3>
                  <Button variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" /> Tambah Item
                  </Button>
                </div>

                {formData.items?.map((item: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg space-y-4 relative bg-white dark:bg-zinc-950">
                    <Button 
                      variant="ghost" size="icon" 
                      className="absolute top-2 right-2 text-red-500 hover:bg-red-50" 
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="md:col-span-2">
                        <Label>Judul Item</Label>
                        <Input 
                          value={item.title || ""} 
                          onChange={(e) => updateItem(idx, "title", e.target.value)} 
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Deskripsi</Label>
                        <Textarea 
                          value={item.desc || ""} 
                          onChange={(e) => updateItem(idx, "desc", e.target.value)} 
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label>Ikon (Nama Lucide, misal: BookOpen)</Label>
                        <Input 
                          value={item.icon || ""} 
                          onChange={(e) => updateItem(idx, "icon", e.target.value)} 
                        />
                      </div>
                      <div>
                        <Label>URL Gambar (Opsional)</Label>
                        <Input 
                          value={item.image || ""} 
                          onChange={(e) => updateItem(idx, "image", e.target.value)} 
                          placeholder="/images/foto.png"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label>URL Tautan (Jika item bisa diklik)</Label>
                        <Input 
                          value={item.url || ""} 
                          onChange={(e) => updateItem(idx, "url", e.target.value)} 
                          placeholder="/tautan"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Simpan Perubahan
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
