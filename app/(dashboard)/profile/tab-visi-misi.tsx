"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, Target, Calendar, Award, BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabLandingSections from "./tab-landing-sections";

interface TabVisiMisiProps {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function TabVisiMisi({ settings, setSettings }: TabVisiMisiProps) {
  // Parse initial states
  const [missions, setMissions] = useState<string[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [curriculumDesc, setCurriculumDesc] = useState("");
  const [curriculumFeatures, setCurriculumFeatures] = useState<string[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [landingTexts, setLandingTexts] = useState<Record<string, string>>({
    profile_desc: "Membangun fondasi akademik dan budi keperti yang luhur demi mempersiapkan murid menghadapi jenjang pendidikan berikutnya dengan penuh percaya diri.",
    program_desc: "Fokus pengembangan karakter pancasila, literasi dasar, serta wadah minat bakat melalui kegiatan ekskul yang terstruktur.",
    news_desc: "Ikuti perkembangan berita terbaru, pengumuman resmi, dan prestasi gemilang warga sekolah kami.",
    gallery_desc: "Rekaman visual berbagai kegiatan sekolah, fasilitas modern, serta kebersamaan hangat warga sekolah.",
    excellence_desc: "Kami merancang sekolah bukan sekadar ruang belajar biasa, melainkan rumah yang inovatif dan menyenangkan bagi minat anak Anda.",
    services_desc: "Kemudahan mengurus mutasi masuk/keluar siswa, melacak status permohonan, dan memantau saldo tabungan secara terpadu.",
    spmb_desc: "Proses pendaftaran seleksi dilakukan secara transparan, adil, dan terintegrasi sistem peta zonasi kelurahan secara *real-time*.",
    faq_desc: "Temukan jawaban singkat untuk pertanyaan umum yang sering diajukan mengenai SPMB dan aktivitas sekolah.",
    contact_desc: "Jika ada pertanyaan mengenai pendaftaran, sarana sekolah, atau informasi umum, kirimkan pesan kepada kami."
  });

  // Load once settings are loaded
  useEffect(() => {
    if (settings) {
      try {
        setMissions(settings.school_mission ? JSON.parse(settings.school_mission) : []);
      } catch (e) { setMissions([]); }

      try {
        setIndicators(settings.school_indicators ? JSON.parse(settings.school_indicators) : []);
      } catch (e) { setIndicators([]); }

      try {
        setTimeline(settings.school_history_timeline ? JSON.parse(settings.school_history_timeline) : []);
      } catch (e) { setTimeline([]); }

      try {
        setAchievements(settings.school_history_achievements ? JSON.parse(settings.school_history_achievements) : []);
      } catch (e) { setAchievements([]); }

      try {
        const curr = settings.school_curriculum ? JSON.parse(settings.school_curriculum) : { description: "", features: [] };
        setCurriculumDesc(curr.description || "");
        setCurriculumFeatures(curr.features || []);
      } catch (e) {
        setCurriculumDesc("");
        setCurriculumFeatures([]);
      }

      try {
        setExtras(settings.school_extracurriculars ? JSON.parse(settings.school_extracurriculars) : []);
      } catch (e) { setExtras([]); }

      try {
        if (settings.landing_texts) {
          const parsed = JSON.parse(settings.landing_texts);
          setLandingTexts(prev => ({ ...prev, ...parsed }));
        }
      } catch (e) {
        console.error("Failed to parse landing_texts", e);
      }
    }
  }, [settings]);

  // Sync helpers
  const saveLandingTexts = (updates: Record<string, string>) => {
    const nextMap = { ...landingTexts, ...updates };
    setLandingTexts(nextMap);
    setSettings((prev: any) => ({ ...prev, landing_texts: JSON.stringify(nextMap) }));
  };

  const saveMissions = (list: string[]) => {
    setMissions(list);
    setSettings((prev: any) => ({ ...prev, school_mission: JSON.stringify(list) }));
  };

  const saveIndicators = (list: any[]) => {
    setIndicators(list);
    setSettings((prev: any) => ({ ...prev, school_indicators: JSON.stringify(list) }));
  };

  const saveTimeline = (list: any[]) => {
    setTimeline(list);
    setSettings((prev: any) => ({ ...prev, school_history_timeline: JSON.stringify(list) }));
  };

  const saveAchievements = (list: any[]) => {
    setAchievements(list);
    setSettings((prev: any) => ({ ...prev, school_history_achievements: JSON.stringify(list) }));
  };

  const saveCurriculum = (desc: string, feats: string[]) => {
    const obj = { description: desc, features: feats };
    setSettings((prev: any) => ({ ...prev, school_curriculum: JSON.stringify(obj) }));
  };

  const saveExtras = (list: any[]) => {
    setExtras(list);
    setSettings((prev: any) => ({ ...prev, school_extracurriculars: JSON.stringify(list) }));
  };

  // Misi handlers
  const addMission = () => {
    const newList = [...missions, ""];
    saveMissions(newList);
  };

  const updateMission = (index: number, val: string) => {
    const newList = [...missions];
    newList[index] = val;
    saveMissions(newList);
  };

  const removeMission = (index: number) => {
    const newList = missions.filter((_, i) => i !== index);
    saveMissions(newList);
  };

  const moveMission = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === missions.length - 1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newList = [...missions];
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    saveMissions(newList);
  };

  // Indikator handlers
  const addIndicator = () => {
    const newList = [...indicators, { title: "", description: "" }];
    saveIndicators(newList);
  };

  const updateIndicator = (index: number, key: string, val: string) => {
    const newList = [...indicators];
    newList[index] = { ...newList[index], [key]: val };
    saveIndicators(newList);
  };

  const removeIndicator = (index: number) => {
    const newList = indicators.filter((_, i) => i !== index);
    saveIndicators(newList);
  };

  // Timeline handlers
  const addTimelineEvent = () => {
    const newList = [...timeline, { year: "", title: "", description: "" }];
    saveTimeline(newList);
  };

  const updateTimelineEvent = (index: number, key: string, val: string) => {
    const newList = [...timeline];
    newList[index] = { ...newList[index], [key]: val };
    saveTimeline(newList);
  };

  const removeTimelineEvent = (index: number) => {
    const newList = timeline.filter((_, i) => i !== index);
    saveTimeline(newList);
  };

  // Achievements handlers
  const addAchievement = () => {
    const newList = [...achievements, { icon: "Award", value: "", label: "" }];
    saveAchievements(newList);
  };

  const updateAchievement = (index: number, key: string, val: string) => {
    const newList = [...achievements];
    newList[index] = { ...newList[index], [key]: val };
    saveAchievements(newList);
  };

  const removeAchievement = (index: number) => {
    const newList = achievements.filter((_, i) => i !== index);
    saveAchievements(newList);
  };

  // Curriculum Features handlers
  const addCurrFeature = () => {
    const newList = [...curriculumFeatures, ""];
    setCurriculumFeatures(newList);
    saveCurriculum(curriculumDesc, newList);
  };

  const updateCurrFeature = (index: number, val: string) => {
    const newList = [...curriculumFeatures];
    newList[index] = val;
    setCurriculumFeatures(newList);
    saveCurriculum(curriculumDesc, newList);
  };

  const removeCurrFeature = (index: number) => {
    const newList = curriculumFeatures.filter((_, i) => i !== index);
    setCurriculumFeatures(newList);
    saveCurriculum(curriculumDesc, newList);
  };

  // Extras handlers
  const addExtra = () => {
    const newList = [...extras, { name: "", description: "", schedule: "", category: "Olahraga" }];
    saveExtras(newList);
  };

  const updateExtra = (index: number, key: string, val: string) => {
    const newList = [...extras];
    newList[index] = { ...newList[index], [key]: val };
    saveExtras(newList);
  };

  const removeExtra = (index: number) => {
    const newList = extras.filter((_, i) => i !== index);
    saveExtras(newList);
  };

  return (
    <Tabs defaultValue="visimisi" className="space-y-6">
      <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl flex flex-wrap w-full">
        <TabsTrigger value="visimisi" className="rounded-lg flex-1 whitespace-nowrap text-xs px-2">
          <span className="hidden sm:inline">Visi, Misi & Indikator</span>
          <span className="sm:hidden">Visi & Misi</span>
        </TabsTrigger>
        <TabsTrigger value="sejarah" className="rounded-lg flex-1 whitespace-nowrap text-xs px-2">
          <span className="hidden sm:inline">Sejarah & Prestasi</span>
          <span className="sm:hidden">Sejarah</span>
        </TabsTrigger>
        <TabsTrigger value="kurikulum" className="rounded-lg flex-1 whitespace-nowrap text-xs px-2">
          <span className="hidden sm:inline">Kurikulum & Ekstra</span>
          <span className="sm:hidden">Kurikulum</span>
        </TabsTrigger>
        <TabsTrigger value="landing" className="rounded-lg flex-1 whitespace-nowrap text-xs px-2">Landing</TabsTrigger>
      </TabsList>

      {/* TABS CONTENT 1: VISI MISI */}
      <TabsContent value="visimisi" className="space-y-6">
        {/* Teks Halaman Depan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-600">
              <Sparkles className="h-5 w-5" /> Teks Halaman Depan (Landing Page Copy)
            </CardTitle>
            <CardDescription>Sesuaikan tagline utama dan deskripsi pada halaman depan sekolah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Tagline Utama (Hero)</Label>
              <Input
                value={settings.landing_tagline || ""}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, landing_tagline: e.target.value }))}
                placeholder="Contoh: Cerdas · Berkarakter · Berdaya Saing"
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Utama (Hero)</Label>
              <Textarea
                value={settings.landing_description || ""}
                onChange={(e) => setSettings((prev: any) => ({ ...prev, landing_description: e.target.value }))}
                placeholder="Tulis deskripsi penjelasan sekolah..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Profil & Visi Misi</Label>
              <Textarea
                value={landingTexts.profile_desc || ""}
                onChange={(e) => saveLandingTexts({ profile_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian profil..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Kurikulum & Ekskul</Label>
              <Textarea
                value={landingTexts.program_desc || ""}
                onChange={(e) => saveLandingTexts({ program_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian kurikulum..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Berita & Pengumuman</Label>
              <Textarea
                value={landingTexts.news_desc || ""}
                onChange={(e) => saveLandingTexts({ news_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian berita..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Galeri Foto</Label>
              <Textarea
                value={landingTexts.gallery_desc || ""}
                onChange={(e) => saveLandingTexts({ gallery_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian galeri..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Keunggulan & Bento</Label>
              <Textarea
                value={landingTexts.excellence_desc || ""}
                onChange={(e) => saveLandingTexts({ excellence_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian keunggulan..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Layanan Administratif</Label>
              <Textarea
                value={landingTexts.services_desc || ""}
                onChange={(e) => saveLandingTexts({ services_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian layanan..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi SPMB</Label>
              <Textarea
                value={landingTexts.spmb_desc || ""}
                onChange={(e) => saveLandingTexts({ spmb_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian SPMB..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi FAQ</Label>
              <Textarea
                value={landingTexts.faq_desc || ""}
                onChange={(e) => saveLandingTexts({ faq_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian FAQ..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Deskripsi Kontak Kami</Label>
              <Textarea
                value={landingTexts.contact_desc || ""}
                onChange={(e) => saveLandingTexts({ contact_desc: e.target.value })}
                placeholder="Tulis deskripsi bagian kontak..."
                rows={2}
                className="text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Visi */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-600">
              <Eye className="h-5 w-5" /> Visi Sekolah
            </CardTitle>
            <CardDescription>Pernyataan cita-cita jangka panjang sekolah.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={settings.school_vision || ""}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, school_vision: e.target.value }))}
              placeholder="Contoh: Terwujudnya peserta didik yang Agamis, Kolaboratif, dan Prestasi."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Misi */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Target className="h-5 w-5" /> Misi Sekolah
              </CardTitle>
              <CardDescription>Langkah-langkah strategis untuk mewujudkan visi.</CardDescription>
            </div>
            <Button size="sm" onClick={addMission}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Misi
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {missions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada misi. Tambahkan misi baru.</p>
            ) : (
              missions.map((misi, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="font-mono text-sm text-muted-foreground w-6 text-right">{index + 1}.</span>
                  <Input
                    value={misi}
                    onChange={(e) => updateMission(index, e.target.value)}
                    placeholder="Tulis butir misi sekolah..."
                    className="flex-1"
                  />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMission(index, "up")} disabled={index === 0}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => moveMission(index, "down")} disabled={index === missions.length - 1}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => removeMission(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Indikator Visi */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Target className="h-5 w-5" /> Indikator Fokus Siswa
              </CardTitle>
              <CardDescription>Indikator profil siswa (misal: Berakhlak, Berprestasi).</CardDescription>
            </div>
            <Button size="sm" onClick={addIndicator}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Indikator
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {indicators.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada indikator. Tambahkan indikator baru.</p>
            ) : (
              indicators.map((ind, index) => (
                <div key={index} className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 space-y-3 relative group">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => removeIndicator(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 space-y-2">
                      <Label>Nama Karakter</Label>
                      <Input
                        value={ind.title || ""}
                        onChange={(e) => updateIndicator(index, "title", e.target.value)}
                        placeholder="Contoh: Berakhlak"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label>Deskripsi Karakter</Label>
                      <Input
                        value={ind.description || ""}
                        onChange={(e) => updateIndicator(index, "description", e.target.value)}
                        placeholder="Peserta didik yang berakhlak dalam hubungannya dengan Tuhan..."
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TABS CONTENT 2: SEJARAH */}
      <TabsContent value="sejarah" className="space-y-6">
        {/* Timeline Sejarah */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Calendar className="h-5 w-5" /> Garis Waktu Sejarah
              </CardTitle>
              <CardDescription>Kronologi tonggak penting perjalanan sekolah.</CardDescription>
            </div>
            <Button size="sm" onClick={addTimelineEvent}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Peristiwa
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada sejarah timeline. Tambahkan baru.</p>
            ) : (
              timeline.map((event, index) => (
                <div key={index} className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => removeTimelineEvent(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 space-y-2">
                      <Label>Tahun</Label>
                      <Input
                        value={event.year || ""}
                        onChange={(e) => updateTimelineEvent(index, "year", e.target.value)}
                        placeholder="Contoh: 1970"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-2">
                      <Label>Nama Peristiwa</Label>
                      <Input
                        value={event.title || ""}
                        onChange={(e) => updateTimelineEvent(index, "title", e.target.value)}
                        placeholder="Contoh: Pendirian Sekolah"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Keterangan Lengkap</Label>
                    <Textarea
                      value={event.description || ""}
                      onChange={(e) => updateTimelineEvent(index, "description", e.target.value)}
                      placeholder="Uraian singkat mengenai sejarah yang terjadi pada tahun tersebut..."
                      rows={2}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Prestasi Ringkas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Award className="h-5 w-5" /> Statistik & Prestasi Ringkas
              </CardTitle>
              <CardDescription>Data angka ringkas (misal: Jumlah Alumni, Tahun Berdiri).</CardDescription>
            </div>
            <Button size="sm" onClick={addAchievement}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Statistik
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {achievements.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada statistik. Tambahkan statistik baru.</p>
            ) : (
              achievements.map((ach, index) => (
                <div key={index} className="flex gap-4 items-center p-3 rounded-lg border border-slate-100 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/20">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Nilai / Angka</Label>
                      <Input
                        value={ach.value || ""}
                        onChange={(e) => updateAchievement(index, "value", e.target.value)}
                        placeholder="Contoh: 50+ atau 5000+"
                      />
                    </div>
                    <div className="space-y-1 col-span-1 md:col-span-2">
                      <Label className="text-xs">Label Keterangan</Label>
                      <Input
                        value={ach.label || ""}
                        onChange={(e) => updateAchievement(index, "label", e.target.value)}
                        placeholder="Contoh: Prestasi Akademik atau Alumni"
                      />
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive h-8 w-8 mt-4" onClick={() => removeAchievement(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TABS CONTENT 3: KURIKULUM & EXTRA */}
      <TabsContent value="kurikulum" className="space-y-6">
        {/* Deskripsi Kurikulum */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-indigo-600">
              <BookOpen className="h-5 w-5" /> Deskripsi Kurikulum Sekolah
            </CardTitle>
            <CardDescription>Penjelasan kurikulum belajar yang diterapkan sekolah.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Uraian Kurikulum</Label>
              <Textarea
                value={curriculumDesc}
                onChange={(e) => {
                  setCurriculumDesc(e.target.value);
                  saveCurriculum(e.target.value, curriculumFeatures);
                }}
                placeholder="Kami menerapkan Kurikulum Merdeka yang berfokus pada pengembangan karakter..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Poin Keunggulan Kurikulum</Label>
                <Button variant="outline" size="sm" onClick={addCurrFeature}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Tambah Poin
                </Button>
              </div>
              <div className="space-y-2">
                {curriculumFeatures.map((feat, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      value={feat}
                      onChange={(e) => updateCurrFeature(index, e.target.value)}
                      placeholder="Contoh: Penguatan literasi dan numerasi"
                    />
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => removeCurrFeature(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ekstrakurikuler */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <GraduationCap className="h-5 w-5" /> Daftar Ekstrakurikuler
              </CardTitle>
              <CardDescription>Kegiatan penunjang minat bakat siswa diluar kelas.</CardDescription>
            </div>
            <Button size="sm" onClick={addExtra}>
              <Plus className="h-4 w-4 mr-1" /> Tambah Ekskul
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {extras.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada ekstrakurikuler. Tambahkan ekskul baru.</p>
            ) : (
              extras.map((ex, index) => (
                <div key={index} className="p-4 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40 space-y-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 text-destructive hover:text-destructive h-8 w-8"
                    onClick={() => removeExtra(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Nama Ekskul</Label>
                      <Input
                        value={ex.name || ""}
                        onChange={(e) => updateExtra(index, "name", e.target.value)}
                        placeholder="Contoh: Pramuka"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Jadwal Kegiatan</Label>
                      <Input
                        value={ex.schedule || ""}
                        onChange={(e) => updateExtra(index, "schedule", e.target.value)}
                        placeholder="Contoh: Jumat, 14:00 - 16:00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Kategori</Label>
                      <select
                        value={ex.category || "Olahraga"}
                        onChange={(e) => updateExtra(index, "category", e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="Wajib">Wajib</option>
                        <option value="Olahraga">Olahraga</option>
                        <option value="Kesenian">Kesenian</option>
                        <option value="STEM">STEM</option>
                        <option value="Akademik">Akademik</option>
                        <option value="Keagamaan">Keagamaan</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Keterangan Singkat</Label>
                    <Input
                      value={ex.description || ""}
                      onChange={(e) => updateExtra(index, "description", e.target.value)}
                      placeholder="Contoh: Pengembangan karakter, kepemimpinan, dan keterampilan hidup..."
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* TABS CONTENT 4: LANDING PAGE SECTIONS */}
      <TabsContent value="landing" className="pt-2">
        <TabLandingSections settings={settings} setSettings={setSettings} />
      </TabsContent>
    </Tabs>
  );
}
