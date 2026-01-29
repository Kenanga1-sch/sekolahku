
"use client";

import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TeacherStats {
  tpCount: number;
  moduleCount: number;
  gradeCount: number;
  journalCount: number;
}

export function TeacherAssistantPanel({ stats }: { stats: TeacherStats | null }) {
  if (!stats) return null;

  const todos = [];

  if (stats.tpCount === 0) {
    todos.push({
      priority: "high",
      text: "Anda belum menyusun Tujuan Pembelajaran (TP).",
      action: "Susun TP",
      link: "/admin/kurikulum/perencanaan"
    });
  }

  if (stats.tpCount > 0 && stats.moduleCount === 0) {
    todos.push({
      priority: "high",
      text: "Modul Ajar minggu ini belum dibuat.",
      action: "Buat Modul",
      link: "/admin/kurikulum/perencanaan"
    });
  }

  if (stats.moduleCount > 0 && stats.gradeCount === 0) {
    todos.push({
      priority: "medium",
      text: "Nilai belum diinput untuk materi aktif.",
      action: "Input Nilai",
      link: "/admin/akademik/nilai"
    });
  }

  // Generic
  todos.push({
    priority: "low",
    text: `Jurnal mengajar tersimpan: ${stats.journalCount} entri.`,
    action: "Isi Jurnal",
    link: "/admin/kurikulum/jurnal"
  });

  return (
    <Card className="h-full border-none shadow-none bg-zinc-50 dark:bg-zinc-900/50">
      <CardHeader>
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" /> Asisten Virtual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {todos.map((todo, i) => (
          <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm">
            {todo.priority === "high" ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : todo.priority === "medium" ? (
              <AlertCircle className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium mb-1">{todo.text}</p>
              <a href={todo.link} className="text-xs font-bold text-blue-600 hover:underline">
                {todo.action}
              </a>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
