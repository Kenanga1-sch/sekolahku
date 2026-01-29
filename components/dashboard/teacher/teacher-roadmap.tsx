
"use client";

import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface TeacherStats {
  tpCount: number;
  moduleCount: number;
  gradeCount: number;
}

export function TeacherRoadmap({ stats }: { stats: TeacherStats | null }) {
  if (!stats) return null;

  const steps = [
    {
      id: 1,
      title: "Perencanaan",
      description: "Pilih CP, Susun TP, Buat ATP",
      completed: stats.tpCount > 0,
      current: stats.tpCount === 0,
      link: "/admin/kurikulum/perencanaan",
      action: "Susun Perencanaan"
    },
    {
      id: 2,
      title: "Modul Ajar",
      description: "Buat modul ajar minggu ini",
      completed: stats.moduleCount > 0 && stats.moduleCount >= stats.tpCount, // Rough logic
      current: stats.tpCount > 0 && stats.moduleCount < stats.tpCount,
      link: "/admin/kurikulum/perencanaan/modul-editor",
      action: "Buat Modul Ajar"
    },
    {
      id: 3,
      title: "Penilaian",
      description: `${stats.gradeCount} nilai tersimpan`,
      completed: false, // Never truly done until report?
      current: stats.moduleCount > 0,
      link: "/admin/akademik/nilai",
      action: "Input Nilai"
    }
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <h2 className="text-lg font-bold mb-6">Alur Kerja Semester Ini</h2>
      <div className="relative">
        {/* Connecting Line */}
        <div className="absolute top-4 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-800 -z-10" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, idx) => (
            <div key={idx} className={`relative pt-0 md:pt-8 flex md:block gap-4 ${step.current ? 'opacity-100' : 'opacity-70'}`}>
              
              {/* Indicator Dot (Mobile: left, Desktop: top) */}
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2 
                md:absolute md:-top-4 md:left-0 
                ${step.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 
                  step.current ? 'bg-blue-600 border-blue-600 text-white animate-pulse' : 
                  'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-400'}
              `}>
                {step.completed ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{step.id}</span>}
              </div>

              <div>
                <h3 className={`font-bold text-lg ${step.current ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 h-10">{step.description}</p>
                
                {step.current && (
                  <Link href={step.link}>
                    <Button size="sm" className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20">
                      {step.action} <ArrowRight className="ml-2 w-3 h-3" />
                    </Button>
                  </Link>
                )}
                {step.completed && (
                   <Link href={step.link}>
                    <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                        Lihat <ArrowRight className="ml-2 w-3 h-3" />
                    </Button>
                   </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
