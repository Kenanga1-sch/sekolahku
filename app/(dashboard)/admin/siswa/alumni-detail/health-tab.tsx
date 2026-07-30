"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Heart className="h-5 w-5 text-rose-500 animate-pulse" />Riwayat Kesehatan & Perkembangan Jasmani</CardTitle>
            <Button size="sm" onClick={onAdd}><Plus className="h-4 w-4 mr-1" />Tambah Rekam Medis</Button>
          </CardHeader>
          <CardContent>
            {!records || records.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><Heart className="h-12 w-12 mx-auto mb-2 opacity-50 text-rose-500" /><p>Belum ada catatan kesehatan tahunan disimpan</p></div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tingkat / Kelas</TableHead><TableHead>Berat Badan (kg)</TableHead><TableHead>Tinggi Badan (cm)</TableHead>
                      <TableHead>Penyakit Diderita</TableHead><TableHead>Kelainan Jasmani</TableHead><TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map(hr => (
                      <TableRow key={hr.id}>
                        <TableCell className="font-semibold">{hr.year}</TableCell>
                        <TableCell>{hr.weight ? `${hr.weight} kg` : "-"}</TableCell>
                        <TableCell>{hr.height ? `${hr.height} cm` : "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{hr.illness || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate">{hr.abnormality || "-"}</TableCell>
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(hr)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(hr.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
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