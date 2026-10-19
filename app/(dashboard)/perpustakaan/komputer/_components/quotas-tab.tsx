"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import {
  listQuotaPolicies,
  setQuotaPolicy,
  listQuotas,
  setStudentQuota,
  type QuotaPolicy,
  type ComputerTimeQuota,
} from "@/lib/computer";

export function QuotasTab() {
  const [policies, setPolicies] = useState<QuotaPolicy[]>([]);
  const [quotas, setQuotas] = useState<ComputerTimeQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [editStudent, setEditStudent] = useState<ComputerTimeQuota | null>(null);
  const [editMinutes, setEditMinutes] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, q] = await Promise.all([listQuotaPolicies(), listQuotas()]);
      setPolicies(p);
      setQuotas(q);
    } catch {
      showError("Gagal memuat kuota");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePolicy = async () => {
    try {
      await setQuotaPolicy(cls, minutes);
      showSuccess("Kebijakan kuota disimpan");
      setCls("");
      setMinutes(60);
      load();
    } catch {
      showError("Gagal menyimpan kebijakan");
    }
  };

  const saveStudent = async () => {
    if (!editStudent) return;
    try {
      await setStudentQuota(editStudent.studentId, editMinutes);
      showSuccess("Kuota siswa disimpan");
      setEditStudent(null);
      load();
    } catch {
      showError("Gagal menyimpan kuota siswa");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Jatah Menit per Kelas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Kosongkan nama kelas untuk jatah <span className="font-medium">default</span> semua kelas.
            Siswa baru otomatis mendapat jatah ini.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1">
              <Label htmlFor="q-cls">Kelas</Label>
              <Input
                id="q-cls"
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                placeholder="(default) atau VII-A"
              />
            </div>
            <div className="w-full sm:w-32">
              <Label htmlFor="q-min">Menit</Label>
              <Input
                id="q-min"
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </div>
            <Button onClick={savePolicy} className="w-full sm:w-auto">Simpan</Button>
          </div>
          {policies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {policies.map((p) => (
                <Badge key={p.className || "__default"} variant="secondary">
                  {p.className || "Default"}: {p.minutes} menit
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kuota per Siswa</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : quotas.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              Belum ada kuota siswa. Atur jatah kelas di atas.
            </p>
          ) : (
            <div className="space-y-2">
              {quotas.map((q) => (
                <div
                  key={q.studentId}
                  className="flex items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{q.studentName || q.studentId}</p>
                    <p className="text-xs text-muted-foreground">{q.className || "-"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm">
                      <span className="font-semibold text-success">{q.remainingMinutes}</span>
                      <span className="text-muted-foreground"> / {q.totalMinutes} menit</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditStudent(q);
                        setEditMinutes(q.totalMinutes);
                      }}
                    >
                      Atur
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editStudent} onOpenChange={(o) => !o && setEditStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Kuota {editStudent?.studentName}</DialogTitle>
          </DialogHeader>
          <Label htmlFor="es-min">Total jatah menit</Label>
          <Input
            id="es-min"
            type="number"
            min={0}
            value={editMinutes}
            onChange={(e) => setEditMinutes(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Terpakai saat ini: {editStudent?.usedMinutes} menit.
          </p>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setEditStudent(null)}>
              Batal
            </Button>
            <Button onClick={saveStudent}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
