"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/lib/toast";
import { listSessions, type ComputerSession } from "@/lib/computer";
import { formatDateTime } from "../komputer-helpers";

export function HistoryTab() {
  const [sessions, setSessions] = useState<ComputerSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSessions(await listSessions());
    } catch {
      showError("Gagal memuat riwayat");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalMinutes = sessions.reduce((acc, s) => acc + s.minutesUsed, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-lg">Riwayat Pemakaian</CardTitle>
        <Button variant="outline" size="icon" onClick={load} aria-label="Muat ulang">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">Belum ada pemakaian.</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 text-center">
              <div className="border rounded-lg p-3">
                <div className="text-2xl font-bold">{sessions.length}</div>
                <div className="text-xs text-muted-foreground">Total Sesi</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-2xl font-bold">{totalMinutes}</div>
                <div className="text-xs text-muted-foreground">Total Menit</div>
              </div>
            </div>
            <div className="space-y-2">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {s.studentName} <span className="text-muted-foreground">·</span> {s.stationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(s.startedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" /> {s.minutesUsed} mnt
                    </Badge>
                    {s.endReason === "time_up" && (
                      <Badge variant="destructive">Waktu habis</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
