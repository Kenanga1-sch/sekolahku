"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import { Trophy, Activity, Plus, Edit, Trash2 } from "lucide-react";
import type { AlumniAchievement, AlumniExtracurricular } from "./types-alumni";

interface AchievementTabProps {
  achievements: AlumniAchievement[];
  extracurriculars: AlumniExtracurricular[];
  onAddAchievement: () => void;
  onEditAchievement: (a: AlumniAchievement) => void;
  onDeleteAchievement: (id: string) => void;
  onAddEkskul: () => void;
  onEditEkskul: (e: AlumniExtracurricular) => void;
  onDeleteEkskul: (id: string) => void;
}

export function AchievementTab(props: AchievementTabProps) {
  const { achievements, extracurriculars, onAddAchievement, onEditAchievement, onDeleteAchievement, onAddEkskul, onEditEkskul, onDeleteEkskul } = props;

  return (
    <TabsContent value="achievements" className="mt-4 space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" />Prestasi & Penghargaan</CardTitle>
            <Button size="sm" onClick={onAddAchievement}><Plus className="h-4 w-4 mr-1" />Tambah Prestasi</Button>
          </CardHeader>
          <CardContent>
            {achievements.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm"><Trophy className="h-10 w-10 mx-auto mb-2 opacity-40 text-amber-500" /><p>Belum ada data prestasi disimpan</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {achievements.map(ach => (
                  <div key={ach.id} className="p-4 border rounded-lg flex justify-between items-start bg-zinc-50/55 dark:bg-white/5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{ach.title}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">{ach.level}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{ach.type === "academic" ? "Akademik" : "Non-Akademik"} &bull; {ach.ranking || "Keikutsertaan"} &bull; Tahun {ach.year}</p>
                      {ach.organizer && <p className="text-xs text-muted-foreground">Penyelenggara: {ach.organizer}</p>}
                      {ach.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 bg-white dark:bg-zinc-900 p-2 rounded border border-dashed">{ach.description}</p>}
                    </div>
                    <div className="flex gap-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEditAchievement(ach)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeleteAchievement(ach.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-5 w-5 text-emerald-500" />Kegiatan Ekstrakurikuler</CardTitle>
            <Button size="sm" onClick={onAddEkskul}><Plus className="h-4 w-4 mr-1" />Tambah Ekskul</Button>
          </CardHeader>
          <CardContent>
            {extracurriculars.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm"><Activity className="h-10 w-10 mx-auto mb-2 opacity-40 text-emerald-500" /><p>Belum ada data ekstrakurikuler disimpan</p></div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {extracurriculars.map(ex => (
                  <div key={ex.id} className="p-4 border rounded-lg flex justify-between items-start bg-zinc-50/55 dark:bg-white/5">
                    <div className="space-y-1">
                      <span className="font-semibold text-sm">{ex.activityName}</span>
                      <p className="text-xs text-muted-foreground">Peran: {ex.role || "-"} &bull; Periode: {ex.yearStart || "?"} - {ex.yearEnd || "Sekarang"}</p>
                      {ex.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 bg-white dark:bg-zinc-900 p-2 rounded border border-dashed">{ex.description}</p>}
                    </div>
                    <div className="flex gap-1 whitespace-nowrap">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEditEkskul(ex)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDeleteEkskul(ex.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}