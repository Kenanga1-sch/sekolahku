
"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { showSuccess, showError } from "@/lib/toast";

interface SPMBPromoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrantId: string | null;
  registrantName?: string;
  onSuccess?: () => void;
}

export function SPMBPromoteDialog({ 
  open, 
  onOpenChange, 
  registrantId, 
  registrantName,
  onSuccess 
}: SPMBPromoteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    if (open) {
      fetchClasses();
      setSelectedClassId("");
    }
  }, [open]);

  const fetchClasses = async () => {
    try {
      const res = await fetch("/api/academic/classes");
      const data = await res.json();
      setClasses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePromote = async () => {
    if (!registrantId || !selectedClassId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/spmb/candidates/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationId: registrantId,
          targetClassId: selectedClassId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses");

      showSuccess("Siswa berhasil dipromosikan ke Master Data");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promosikan ke Siswa Aktif</DialogTitle>
          <DialogDescription>
            Pindahkan <strong>{registrantName}</strong> ke Master Data Siswa. 
            Data akan disalin dan akun siswa dibuat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Pilih Kelas Tujuan</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Kelas..." />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name} ({cls.academicYear})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handlePromote} disabled={loading || !selectedClassId}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Proses Masuk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
