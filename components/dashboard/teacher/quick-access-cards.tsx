
"use client";

import Link from "next/link";
import { BookOpen, UserCheck, Star, FileText } from "lucide-react";

export function QuickAccessCards() {
  const actions = [
    {
      title: "Isi Jurnal Mengajar",
      desc: "Catat aktivitas hari ini",
      icon: BookOpen,
      href: "/admin/kurikulum/jurnal",
      color: "bg-orange-500",
      gradient: "from-orange-500 to-red-500"
    },
    {
      title: "Presensi Siswa",
      desc: "Cek absensi kelas",
      icon: UserCheck,
      href: "/presensi",
      color: "bg-emerald-500",
      gradient: "from-emerald-500 to-teal-500"
    },
    {
      title: "Input Nilai Harian",
      desc: "Asesmen formatif TP",
      icon: Star,
      href: "/admin/akademik/nilai",
      color: "bg-blue-500",
      gradient: "from-blue-500 to-indigo-500"
    },
    {
      title: "Buka Modul Ajar",
      desc: "Lihat rencana ajar",
      icon: FileText,
      href: "/admin/kurikulum/perencanaan",
      color: "bg-purple-500",
      gradient: "from-purple-500 to-pink-500"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action, i) => (
        <Link key={i} href={action.href} className="group relative overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1 hover:border-gray-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
          <div className="relative p-5 z-10">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${action.color}/10 text-${action.color.split("-")[1]}-600`}>
              <action.icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-1">
              {action.title}
            </h3>
            <p className="text-xs text-muted-foreground">{action.desc}</p>
          </div>
          {/* Gradient Hover Effect */}
          <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
        </Link>
      ))}
    </div>
  );
}
