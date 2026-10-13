"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatClassName } from "@/lib/class-utils";

import type { ClassItem, QuestionSet } from "./types";

/** Dialog memilih kelas yang boleh mengerjakan paket ujian. */
export function AssignDialog({
  assigningSet,
  classes,
  assignSelected,
  isAssignSaving,
  onToggle,
  onSave,
  onClose,
}: {
  assigningSet: QuestionSet | null;
  classes: ClassItem[];
  assignSelected: Set<string>;
  isAssignSaving: boolean;
  onToggle: (classId: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!assigningSet} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tugaskan Ujian ke Kelas</DialogTitle>
          <DialogDescription>
            Pilih kelas yang boleh mengerjakan &quot;{assigningSet?.name}&quot;. Hanya siswa di kelas terpilih yang dapat mengakses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2 max-h-72 overflow-y-auto">
          {classes.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">Belum ada kelas</p>
          ) : (
            classes.map((c) => {
              const checked = assignSelected.has(c.id);
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    checked ? "bg-blue-50 dark:bg-blue-950/20 border-blue-300" : "hover:bg-slate-50 dark:hover:bg-zinc-900"
                  }`}
                  onClick={() => onToggle(c.id)}
                >
                  <Checkbox checked={checked} />
                  <span className="text-sm">{formatClassName(c.name)}</span>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onClose()}>Batal</Button>
          <Button onClick={onSave} disabled={isAssignSaving}>
            {isAssignSaving ? "Menyimpan..." : "Simpan Penugasan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
