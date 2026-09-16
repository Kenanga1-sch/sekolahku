"use client";

import { Plus, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface MatchPair {
  id: string;
  left: string;
  right: string;
  rightId: string;
}

interface PairMatchEditorProps {
  value: MatchPair[];
  onChange: (next: MatchPair[]) => void;
}

export function PairMatchEditor({ value, onChange }: PairMatchEditorProps) {
  // Pastikan setiap pasangan selalu punya rightId stabil (untik koreksi otomatis).
  const ensureRightIds = (pairs: MatchPair[]): MatchPair[] =>
    pairs.map((p) => (p.rightId ? p : { ...p, rightId: `r${p.id}` }));

  const updateLeft = (id: string, left: string) =>
    onChange(value.map((p) => (p.id === id ? { ...p, left } : p)));

  const updateRight = (id: string, right: string) =>
    onChange(value.map((p) => (p.id === id ? { ...p, right } : p)));

  const addPair = () => {
    if (value.length >= 6) return;
    const newId = String(value.length + 1);
    onChange([...value, { id: newId, left: "", right: "", rightId: `r${newId}` }]);
  };

  const removePair = (id: string) => {
    if (value.length <= 2) return;
    onChange(
      value
        .filter((p) => p.id !== id)
        .map((p, i) => {
          const newId = String(i + 1);
          return { ...p, id: newId, rightId: `r${newId}` };
        })
    );
  };

  return (
    <div className="space-y-3">
      <Label>Pasangan Item</Label>
      <p className="text-[11px] text-muted-foreground">
        Siswa harus mencocokkan item kiri dengan item kanan yang benar.
      </p>

      <div className="space-y-2">
        {ensureRightIds(value).map((pair, idx) => (
          <div key={pair.id} className="flex items-center gap-2">
            <span className="flex h-9 w-7 shrink-0 items-center justify-center text-xs font-bold text-muted-foreground">
              {idx + 1}
            </span>
            <Input
              value={pair.left}
              onChange={(e) => updateLeft(pair.id, e.target.value)}
              placeholder="Item kiri (mis. Jakarta)"
              className="flex-1"
            />
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={pair.right}
              onChange={(e) => updateRight(pair.id, e.target.value)}
              placeholder="Item kanan (mis. Indonesia)"
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-destructive"
              disabled={value.length <= 2}
              onClick={() => removePair(pair.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {value.length < 6 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPair}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-1" />
          Tambah Pasangan
        </Button>
      )}
    </div>
  );
}
