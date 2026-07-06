"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Save,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

// Subcomponents relocated to profile
import TabProfil from "./tab-profil";
import TabVisiMisi from "./tab-visi-misi";
import TabSistem from "./tab-sistem";

export default function TabSekolah() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    school_name: "",
    school_npsn: "",
    school_address: "",
    school_phone: "",
    school_email: "",
    school_website: "",
    school_logo: "",
    school_lat: -6.2,
    school_lng: 106.816666,
    max_distance_km: 3,
    spmb_is_open: true,
    current_academic_year: "2025/2026",
    principal_name: "",
    principal_nip: "",
    is_maintenance: false,
    last_letter_number: 0,
    letter_number_format: "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
    savings_treasurer_id: "",
    school_vision: "",
    school_mission: "",
    school_indicators: "",
    school_history_timeline: "",
    school_history_achievements: "",
    school_curriculum: "",
    school_extracurriculars: "",
    landing_tagline: "",
    landing_description: "",
    landing_texts: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response: any = await goGet("/api/school-settings");
      const record = response?.data ?? response;
      
      if (record && record.id) {
        setSettingsId(record.id);
        setSettings({
          school_name: record.school_name || "",
          school_npsn: record.school_npsn || "",
          school_address: record.school_address || "",
          school_phone: record.school_phone || "",
          school_email: record.school_email || "",
          school_website: record.school_website || "",
          school_logo: record.school_logo || "",
          school_lat: record.school_lat ?? -6.2,
          school_lng: record.school_lng ?? 106.816666,
          max_distance_km: record.max_distance_km ?? 3,
          spmb_is_open: record.spmb_is_open ?? true,
          current_academic_year: record.current_academic_year || "2025/2026",
          principal_name: record.principal_name || "",
          principal_nip: record.principal_nip || "",
          is_maintenance: record.is_maintenance ?? false,
          last_letter_number: record.last_letter_number || 0,
          letter_number_format: record.letter_number_format || "421/{nomor}/SDN1-KNG/{bulan}/{tahun}",
          savings_treasurer_id: record.savings_treasurer_id || "",
          school_vision: record.school_vision || "",
          school_mission: record.school_mission || "",
          school_indicators: record.school_indicators || "",
          school_history_timeline: record.school_history_timeline || "",
          school_history_achievements: record.school_history_achievements || "",
          school_curriculum: record.school_curriculum || "",
          school_extracurriculars: record.school_extracurriculars || "",
          landing_tagline: record.landing_tagline || "",
          landing_description: record.landing_description || "",
          landing_texts: record.landing_texts || "",
        });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
      showError("Gagal memuat pengaturan sekolah");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response: any = await goPost("/api/school-settings", { id: settingsId, ...settings });
      const result = response?.data ?? response;
      if (result?.id) setSettingsId(result.id);
      
      setSaved(true);
      showSuccess("Pengaturan sekolah berhasil disimpan!");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError(err instanceof Error ? err.message : "Gagal menyimpan pengaturan. Silakan coba lagi.");
      showError("Gagal menyimpan perubahan");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-white dark:bg-zinc-950 p-6 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 shadow-xs">
      {/* Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800/60 pb-4">
        <div>
          <h3 className="text-lg font-bold">Pengaturan Sekolah</h3>
          <p className="text-muted-foreground text-xs">Kelola profil, visi misi, dan konfigurasi sistem sekolah.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSettings} className="border-slate-200 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white transition-all shadow-sm">
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Perubahan
          </Button>
        </div>
      </div>

      {saved && (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200 text-xs">
            Seluruh pengaturan sekolah berhasil disimpan secara permanen ke database!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="text-xs">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs Navigation */}
      <Tabs defaultValue="profil" className="w-full">
        <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl w-full flex flex-wrap overflow-x-auto no-scrollbar mb-4">
          <TabsTrigger value="profil" className="rounded-lg text-xs font-semibold cursor-pointer flex-1 whitespace-nowrap">Profil Sekolah</TabsTrigger>
          <TabsTrigger value="konten" className="rounded-lg text-xs font-semibold cursor-pointer flex-1 whitespace-nowrap">Konten Publik & Visi Misi</TabsTrigger>
          <TabsTrigger value="sistem" className="rounded-lg text-xs font-semibold cursor-pointer flex-1 whitespace-nowrap">Pengaturan Sistem</TabsTrigger>
        </TabsList>
        <TabsContent value="profil" className="pt-2">
          <TabProfil settings={settings} setSettings={setSettings} />
        </TabsContent>
        <TabsContent value="konten" className="pt-2">
          <TabVisiMisi settings={settings} setSettings={setSettings} />
        </TabsContent>
        <TabsContent value="sistem" className="pt-2">
          <TabSistem settings={settings} setSettings={setSettings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
