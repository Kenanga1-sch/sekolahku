"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { PickupForm } from "@/components/alumni/pickup-form";
import { Calendar, History } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import type { DocumentPickup } from "./types-alumni";

interface PickupTabProps {
  pickups: DocumentPickup[];
  alumniId: string;
  isGraduated: boolean;
  onRefresh: () => void;
}

export function PickupTab({ pickups, alumniId, isGraduated, onRefresh }: PickupTabProps) {
  return (
    <TabsContent value="pickups" className="mt-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Riwayat Serah Terima Dokumen Fisik</CardTitle>
            {isGraduated && <PickupForm alumniId={alumniId} onPickupComplete={onRefresh} />}
          </CardHeader>
          <CardContent>
            {pickups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground"><History className="h-12 w-12 mx-auto mb-2 opacity-50" /><p>Belum ada riwayat serah terima dokumen</p></div>
            ) : (
              <div className="space-y-4">
                {pickups.map(pickup => (
                  <div key={pickup.id} className="flex items-start gap-4 p-3 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center"><Calendar className="h-5 w-5 text-primary" /></div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{pickup.documentType?.name || "Dokumen"}</p>
                      <p className="text-xs text-muted-foreground">Diambil oleh: <span className="font-semibold">{pickup.recipientName}</span>{pickup.recipientRelation && ` (${pickup.recipientRelation})`}</p>
                      {pickup.notes && <p className="text-xs text-muted-foreground mt-1">Catatan: {pickup.notes}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">Waktu: {format(new Date(pickup.pickupDate), "dd MMMM yyyy HH:mm", { locale: localeId })}</p>
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