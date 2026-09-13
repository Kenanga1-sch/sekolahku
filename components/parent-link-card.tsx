"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, Phone, Trash2, UserPlus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStudentParentsAction, linkParentAction, unlinkParentAction } from "@/actions/parent";

interface ParentAccount {
  userId: string;
  name: string;
  phone: string;
  relation: string;
}

export function ParentLinkCard({ studentId }: { studentId: string }) {
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("orangtua");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    try {
      const res = await getStudentParentsAction(studentId);
      if (res.success) setParents((res.data as ParentAccount[]) || []);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  const link = async () => {
    if (!/^08\d{8,13}$/.test(phone.trim())) {
      toast.error("Format nomor HP tidak valid (contoh: 081234567890)");
      return;
    }
    setBusy(true);
    try {
      const res = await linkParentAction(studentId, phone.trim(), relation);
      if (res.success) {
        toast.success("Akun orang tua ditautkan");
        setPhone("");
        await load();
      } else {
        toast.error(res.error || "Gagal menautkan");
      }
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (userId: string) => {
    const res = await unlinkParentAction(studentId, userId);
    if (res.success) {
      toast.success("Tautan dilepas");
      await load();
    } else {
      toast.error(res.error || "Gagal melepas tautan");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-5 w-5 text-primary" /> Akun Orang Tua
        </CardTitle>
        <CardDescription>
          Tautkan akun orang tua (dibuat di menu Pengguna atau daftar mandiri) ke siswa ini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : parents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada akun orang tua tertaut.</p>
        ) : (
          <div className="space-y-2">
            {parents.map((p) => (
              <div key={p.userId} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name || "(Tanpa nama)"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {p.phone || "-"} · {p.relation}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100" onClick={() => unlink(p.userId)} title="Lepas tautan">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end border-t pt-4">
          <div className="space-y-1.5 sm:col-span-1">
            <Label>Nomor HP Orang Tua</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label>Hubungan</Label>
            <select
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="orangtua">Orang Tua</option>
              <option value="ayah">Ayah</option>
              <option value="ibu">Ibu</option>
              <option value="wali">Wali</option>
            </select>
          </div>
          <Button onClick={link} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Tautkan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
