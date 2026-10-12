"use client";

import { User, Loader2, Calendar } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { StudentAttendanceSummary, StudentRef } from "./presensi-report-types";

// Student Detail Modal Component
export function StudentDetailModal({
  student,
  data,
  loading,
  onClose,
}: {
  student: StudentRef | null;
  data: StudentAttendanceSummary[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!student) return null;

  return (
    <Dialog open={!!student} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Riwayat Kehadiran: {student.name}
          </DialogTitle>
          <DialogDescription>
            NIS: {student.nis} • Kelas: {student.className}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Belum ada data kehadiran untuk siswa ini</p>
            </div>
          ) : (
            <DataTable
              data={data}
              getRowId={(d) => d.academicYear}
              columns={[
                {
                  key: "academicYear",
                  header: "Tahun Ajaran",
                  card: "title",
                  render: (d) => (
                    <span className="font-medium text-center">{d.academicYear}</span>
                  ),
                },
                {
                  key: "hadir",
                  header: "Hadir",
                  card: "field",
                  render: (d) => (
                    <span className="text-green-700 font-medium text-center block">{d.hadir}</span>
                  ),
                },
                {
                  key: "sakit",
                  header: "Sakit",
                  card: "field",
                  render: (d) => (
                    <span className="text-yellow-700 text-center block">{d.sakit}</span>
                  ),
                },
                {
                  key: "izin",
                  header: "Izin",
                  card: "field",
                  render: (d) => (
                    <span className="text-blue-700 text-center block">{d.izin}</span>
                  ),
                },
                {
                  key: "alpha",
                  header: "Alpha",
                  card: "field",
                  render: (d) => (
                    <span className="text-red-700 text-center block">{d.alpha}</span>
                  ),
                },
                {
                  key: "totalDays",
                  header: "Total Hari",
                  card: "field",
                  render: (d) => <span className="text-center block">{d.totalDays}</span>,
                },
                {
                  key: "pct",
                  header: "% Kehadiran",
                  card: "field",
                  render: (d) => {
                    const pct = d.totalDays > 0 ? Math.round((d.hadir / d.totalDays) * 1000) / 10 : 0;
                    return <span className="font-semibold text-purple-700 text-center block">{pct}%</span>;
                  },
                },
              ]}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
