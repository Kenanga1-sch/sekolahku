"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Plus, Loader2, Trash2 } from "lucide-react";
import type { ColumnDef } from "./use-alumni-detail";
import { getAcademicYearOptions } from "./use-alumni-detail";

interface TranscriptTabProps {
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  selectedSemester: string;
  setSelectedSemester: (v: string) => void;
  columns: ColumnDef[];
  gridRows: Record<string, any>[];
  savingTranscripts: boolean;
  enrolledYear?: string;
  onCellChange: (rowIndex: number, field: string, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  onSaveAll: () => void;
  onOpenTemplates: () => void;
  onOpenColumns: () => void;
  onRemoveColumn: (colKey: string) => void;
}

export function TranscriptTab(props: TranscriptTabProps) {
  const { selectedYear, setSelectedYear, selectedSemester, setSelectedSemester, columns, gridRows, savingTranscripts, enrolledYear, onCellChange, onKeyDown, onRemoveRow, onAddRow, onSaveAll, onOpenTemplates, onOpenColumns, onRemoveColumn } = props;

  return (
    <TabsContent value="transcripts" className="mt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
        <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800/80">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" />Transkrip Nilai (Spreadsheet Grid)</CardTitle>
              <p className="text-xs text-muted-foreground">Pilih Tahun & Semester, gunakan navigasi sel Excel-like (tombol arah / Enter), lalu Simpan Semua.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={onOpenTemplates} className="h-9">Kelola Template</Button>
              <Button variant="outline" size="sm" onClick={onOpenColumns} className="h-9">Kelola Kolom</Button>
              <Button variant="outline" size="sm" onClick={onAddRow} className="h-9"><Plus className="h-4 w-4 mr-1" />Tambah Baris</Button>
              <Button size="sm" className="h-9 bg-blue-600 hover:bg-blue-700 text-white border-0 font-medium shadow-sm" onClick={onSaveAll} disabled={savingTranscripts}>
                {savingTranscripts ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</> : "Simpan Semua Nilai"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap gap-4 items-center bg-slate-50 dark:bg-zinc-950/20 p-3 rounded-lg border border-slate-100 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Tahun Ajaran:</span>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[150px] h-9 bg-white dark:bg-zinc-900"><SelectValue placeholder="Pilih Tahun" /></SelectTrigger>
                  <SelectContent>{getAcademicYearOptions(enrolledYear).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground shrink-0">Semester:</span>
                <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                  <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-zinc-900"><SelectValue placeholder="Semester" /></SelectTrigger>
                  <SelectContent><SelectItem value="Ganjil">Ganjil</SelectItem><SelectItem value="Genap">Genap</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-zinc-800 rounded-lg max-h-[500px] overflow-y-auto">
              <Table className="border-collapse min-w-[800px]">
                <TableHeader className="bg-slate-50 dark:bg-zinc-900/50 sticky top-0 z-10">
                  <TableRow>
                    {columns.map(col => (
                      <TableHead key={col.key} className="border border-slate-200 dark:border-zinc-800 font-bold text-slate-800 dark:text-zinc-200 py-2.5 px-3">
                        <span>{col.label}</span>
                        {col.isCustom && (
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full ml-1" onClick={e => { e.stopPropagation(); onRemoveColumn(col.key); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </TableHead>
                    ))}
                    <TableHead className="w-[60px] border border-slate-200 dark:border-zinc-800 text-center py-2.5 px-3">Hapus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gridRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length + 1} className="text-center py-12 text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="text-sm font-semibold">Belum ada mata pelajaran untuk semester ini.</p>
                        <p className="text-xs text-muted-foreground mt-1">Silakan klik tombol <strong>Kelola Template</strong> atau <strong>Tambah Baris</strong>.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    gridRows.map((row, rIndex) => (
                      <TableRow key={rIndex} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        {columns.map((col, cIndex) => {
                          const isSubjectName = col.key === "subjectName";
                          const isScore = col.key === "score";
                          const isScoreLetter = col.key === "scoreLetter";
                          const cls = `w-full h-10 px-3 py-1 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-900 text-sm ${
                            isSubjectName ? "font-semibold text-slate-800 dark:text-zinc-200" : isScore ? "text-center font-bold text-blue-600 dark:text-blue-400" : isScoreLetter ? "text-center font-bold text-slate-700 dark:text-zinc-300" : "text-slate-600 dark:text-zinc-400"
                          }`;
                          return (
                            <TableCell key={col.key} className="p-0 border border-slate-200 dark:border-zinc-800">
                              <input
                                id={`cell-${rIndex}-${cIndex}`}
                                type={isScore ? "number" : "text"}
                                min={isScore ? "0" : undefined} max={isScore ? "100" : undefined} step={isScore ? "0.1" : undefined}
                                value={row[col.key] ?? ""}
                                onChange={e => onCellChange(rIndex, col.key, e.target.value)}
                                onKeyDown={e => onKeyDown(e, rIndex, cIndex)}
                                placeholder={isSubjectName ? "Nama mata pelajaran..." : isScore ? "0-100" : isScoreLetter ? "A, B, C..." : `Ketik ${col.label}...`}
                                className={cls}
                              />
                            </TableCell>
                          );
                        })}
                        <TableCell className="p-1 border border-slate-200 dark:border-zinc-800 text-center">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onRemoveRow(rIndex)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}