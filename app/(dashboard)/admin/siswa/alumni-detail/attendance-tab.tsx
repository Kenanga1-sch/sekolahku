"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Plus, Edit, Trash2 } from "lucide-react";
import type { AlumniAttendanceSummary } from "./types-alumni";

interface AttendanceTabProps {
  attendances: AlumniAttendanceSummary[];
  onAdd: () => void;
  onEdit: (a: AlumniAttendanceSummary) => void;
  onDelete: (id: string) => void;
}

export function AttendanceTab({ attendances, onAdd, onEdit, onDelete }: AttendanceTabProps) {
  return (
    <TabsContent value="attendance" className="mt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Rekapitulasi Kehadiran</CardTitle>
            <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Tambah Rekap</Button>
          </CardHeader>
          <CardContent>
            {attendances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Belum ada rekap kehadiran disimpan</p></div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tahun Ajaran</TableHead><TableHead>Semester</TableHead>
                      <TableHead className="text-center">Hadir (H)</TableHead><TableHead className="text-center">Sakit (S)</TableHead>
                      <TableHead className="text-center">Izin (I)</TableHead><TableHead className="text-center">Alpha (A)</TableHead>
                      <TableHead className="text-center font-bold">Total Hari</TableHead><TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendances.map(a => {
                      const total = a.present + a.sick + a.permission + a.absent;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium">{a.academicYear}</TableCell><TableCell>{a.semester}</TableCell>
                          <TableCell className="text-center text-emerald-600 font-semibold">{a.present}</TableCell>
                          <TableCell className="text-center text-blue-600">{a.sick}</TableCell>
                          <TableCell className="text-center text-amber-600">{a.permission}</TableCell>
                          <TableCell className="text-center text-rose-600">{a.absent}</TableCell>
                          <TableCell className="text-center font-bold">{total}</TableCell>
                          <TableCell className="text-right space-x-1 whitespace-nowrap">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(a)}><Edit className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}