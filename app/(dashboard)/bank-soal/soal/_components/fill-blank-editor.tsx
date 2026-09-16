"use client";

import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface FillBlankAnswer {
  keyword: string;
  alternatives: string[];
}

interface FillBlankEditorProps {
  value: FillBlankAnswer;
  onChange: (next: FillBlankAnswer) => void;
}

export function FillBlankEditor({ value, onChange }: FillBlankEditorProps) {
  const addAlternative = () => {
    onChange({ ...value, alternatives: [...value.alternatives, ""] });
  };

  const updateAlternative = (idx: number, text: string) => {
    onChange({
      ...value,
      alternatives: value.alternatives.map((a, i) => (i === idx ? text : a)),
    });
  };

  const removeAlternative = (idx: number) => {
    onChange({
      ...value,
      alternatives: value.alternatives.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Kata Kunci Jawaban *</Label>
        <Input
          value={value.keyword}
          onChange={(e) => onChange({ ...value, keyword: e.target.value })}
          placeholder="Contoh: Jakarta"
        />
        <p className="text-[11px] text-muted-foreground">
          Jawaban utama yang dianggap benar. Cocokan tidak case-sensitive (huruf besar/kecil diabaikan).
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Jawaban Alternatif (Opsional)</Label>
          {value.alternatives.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {value.alternatives.length} alternatif
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Jawaban lain yang juga dianggap benar, mis. &quot;DKI Jakarta&quot; atau &quot;JKT&quot;.
        </p>

        <div className="space-y-2">
          {value.alternatives.map((alt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={alt}
                onChange={(e) => updateAlternative(idx, e.target.value)}
                placeholder={`Alternatif ${idx + 1}`}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => removeAlternative(idx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        {value.alternatives.length < 4 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAlternative}
            className="w-full border-dashed"
          >
            <Plus className="h-4 w-4 mr-1" />
            Tambah Alternatif
          </Button>
        )}
      </div>
    </div>
  );
}
