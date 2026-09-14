"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Check, X, AlertTriangle } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkInTime: string;
  method: string;
  notes: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  hadir: { label: "Hadir", icon: <Check className="h-4 w-4" />, color: "bg-green-100 text-green-800" },
  sakit: { label: "Sakit", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-yellow-100 text-yellow-800" },
  izin: { label: "Izin", icon: <Calendar className="h-4 w-4" />, color: "bg-blue-100 text-blue-800" },
  alpha: { label: "Alpha", icon: <X className="h-4 w-4" />, color: "bg-red-100 text-red-800" },
};

function formatTimestamp(ts: number): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function PresensiSayaPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await fetch("/api/student/me/attendance");
        const json = await res.json();
        if (json.success) setRecords(json.data || []);
      } catch (err) {
        console.error("Gagal memuat presensi:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Presensi Saya</h1>

      {records.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Belum ada data presensi.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const cfg = STATUS_CONFIG[r.status] || { label: r.status, icon: null, color: "bg-gray-100" };
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-medium">{formatTimestamp(r.date)}</div>
                    {r.notes && <div className="text-sm text-muted-foreground">{r.notes}</div>}
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
