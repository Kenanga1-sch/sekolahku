"use client";

import { motion } from "framer-motion";
import { 
  BookOpenCheck, 
  NotebookPen, 
  Presentation, 
  GraduationCap, 
  Recycle, 
  ArrowRight,
  FileText,
  Calendar
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function KurikulumDashboard() {
  const router = useRouter();

  const modules = [
    {
      title: "Perencanaan",
      description: "Manajemen CP, TP, ATP, dan Modul Ajar (RPP)",
      icon: NotebookPen,
      href: "/admin/kurikulum/perencanaan",
      color: "text-blue-600",
      bg: "bg-blue-100 dark:bg-blue-900/20",
      stats: "Modul Ajar"
    },
    {
      title: "KBM & Jurnal",
      description: "Jurnal mengajar harian, presensi, dan catatan kelas",
      icon: Presentation,
      href: "/admin/kurikulum/kbm",
      color: "text-emerald-600",
      bg: "bg-emerald-100 dark:bg-emerald-900/20",
      stats: "Jurnal Harian"
    },
    {
      title: "Penilaian (E-Rapor)",
      description: "Input nilai formatif/sumatif berbasis TP dan cetak rapor",
      icon: GraduationCap,
      href: "/admin/kurikulum/penilaian",
      color: "text-purple-600",
      bg: "bg-purple-100 dark:bg-purple-900/20",
      stats: "Data Nilai"
    },
    {
      title: "Projek P5",
      description: "Manajemen tema, dimensi, dan rapor projek P5",
      icon: Recycle,
      href: "/admin/kurikulum/p5",
      color: "text-orange-600",
      bg: "bg-orange-100 dark:bg-orange-900/20",
      stats: "Projek Aktif"
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kurikulum Merdeka</h1>
        <p className="text-muted-foreground mt-2">
          Pusat administrasi pembelajaran berbasis Fase, assesmen holistik, dan profil pelajar pancasila.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card 
              className="h-full hover:shadow-lg transition-all cursor-pointer group border-l-4"
              style={{ borderLeftColor: mod.color.includes("blue") ? "#2563eb" : mod.color.includes("emerald") ? "#059669" : mod.color.includes("purple") ? "#9333ea" : "#ea580c" }}
              onClick={() => router.push(mod.href)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {mod.title}
                </CardTitle>
                <div className={`p-2 rounded-full ${mod.bg}`}>
                  <mod.icon className={`h-4 w-4 ${mod.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {mod.stats}
                </p>
                <p className="text-xs text-muted-foreground mt-4 line-clamp-2">
                  {mod.description}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Jadwal Hari Ini</CardTitle>
                <CardDescription>Ringkasan jam mengajar guru</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground border-dashed border-2 rounded-lg m-4">
                <div className="text-center">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada jadwal aktif</p>
                </div>
            </CardContent>
         </Card>

         <Card>
            <CardHeader>
                <CardTitle>Panduan Singkat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-3 text-sm">
                    <div className="bg-blue-100 text-blue-700 h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">1</div>
                    <p>Atur <b>Capaian Pembelajaran (CP)</b> sesuai Fase kelas Anda.</p>
                </div>
                <div className="flex gap-3 text-sm">
                    <div className="bg-blue-100 text-blue-700 h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">2</div>
                    <p>Turunkan menjadi <b>Tujuan Pembelajaran (TP)</b>.</p>
                </div>
                <div className="flex gap-3 text-sm">
                    <div className="bg-blue-100 text-blue-700 h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0 font-bold">3</div>
                    <p>Susun <b>Modul Ajar</b> dari TP yang sudah dibuat.</p>
                </div>
                <Button variant="outline" className="w-full mt-2" onClick={() => router.push("/admin/kurikulum/perencanaan")}>
                    Mulai Perencanaan <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </CardContent>
         </Card>
      </div>
    </div>
  );
}
