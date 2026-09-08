"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
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
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Rekapitulasi Kehadiran</CardTitle>
            <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Tambah Rekap</Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={attendances}
              getRowId={(a) => a.id}
              emptyTitle="Belum ada rekap kehadiran disimpan"
              emptyDescription="Tambahkan rekap kehadiran pertama untuk alumni ini."
              actions={(a) => (
                <div className="space-x-1 whitespace-nowrap">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(a)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
              columns={[
                {
                  key: "academicYear",
                  header: "Tahun Ajaran",
                  card: "title",
                  render: (a) => (
                    <div>
                      <p className="font-medium">{a.academicYear}</p>
                      <p className="text-xs text-muted-foreground">{a.semester}</p>
                    </div>
                  ),
                },
                {
                  key: "present",
                  header: "Hadir (H)",
                  card: "field",
                  render: (a) => <span className="text-emerald-600 font-semibold">{a.present}</span>,
                },
                {
                  key: "sick",
                  header: "Sakit (S)",
                  card: "field",
                  render: (a) => <span className="text-blue-600">{a.sick}</span>,
                },
                {
                  key: "permission",
                  header: "Izin (I)",
                  card: "field",
                  render: (a) => <span className="text-amber-600">{a.permission}</span>,
                },
                {
                  key: "absent",
                  header: "Alpha (A)",
                  card: "field",
                  render: (a) => <span className="text-rose-600">{a.absent}</span>,
                },
                {
                  key: "total",
                  header: "Total Hari",
                  card: "field",
                  render: (a) => <span className="font-bold">{a.present + a.sick + a.permission + a.absent}</span>,
                },
              ]}
            />
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}