"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { Heart, Plus, Edit, Trash2 } from "lucide-react";
import type { AlumniHealthRecord } from "./types-alumni";

interface HealthTabProps {
  records: AlumniHealthRecord[];
  onAdd: () => void;
  onEdit: (r: AlumniHealthRecord) => void;
  onDelete: (id: string) => void;
}

export function HealthTab({ records, onAdd, onEdit, onDelete }: HealthTabProps) {
  return (
    <TabsContent value="health" className="mt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-5 w-5 text-rose-500 animate-pulse" />Riwayat Kesehatan & Perkembangan Jasmani</CardTitle>
            <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Tambah Rekam Medis</Button>
          </CardHeader>
          <CardContent>
            <DataTable
              data={records || []}
              getRowId={(hr) => hr.id}
              emptyTitle="Belum ada catatan kesehatan tahunan disimpan"
              emptyDescription="Tambahkan rekam medis pertama untuk alumni ini."
              actions={(hr) => (
                <div className="space-x-1 whitespace-nowrap">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(hr)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(hr.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
              columns={[
                {
                  key: "year",
                  header: "Tingkat / Kelas",
                  card: "title",
                  render: (hr) => <span className="font-semibold">{hr.year}</span>,
                },
                {
                  key: "weight",
                  header: "Berat Badan (kg)",
                  card: "field",
                  render: (hr) => (hr.weight ? `${hr.weight} kg` : "-"),
                },
                {
                  key: "height",
                  header: "Tinggi Badan (cm)",
                  card: "field",
                  render: (hr) => (hr.height ? `${hr.height} cm` : "-"),
                },
                {
                  key: "illness",
                  header: "Penyakit Diderita",
                  card: "field",
                  render: (hr) => <span className="block max-w-xs truncate">{hr.illness || "-"}</span>,
                },
                {
                  key: "abnormality",
                  header: "Kelainan Jasmani",
                  card: "field",
                  render: (hr) => <span className="block max-w-xs truncate">{hr.abnormality || "-"}</span>,
                },
              ]}
            />
          </CardContent>
        </Card>
      </motion.div>
    </TabsContent>
  );
}