"use client";

import {
  CircleDot,
  CheckSquare,
  ToggleLeft,
  TextCursorInput,
  Link2,
  GitCompare,
  FileText,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuestionTypeOption {
  value: string;
  label: string;
  icon: any;
  preview: string;
  description: string;
}

export const QUESTION_TYPES: QuestionTypeOption[] = [
  {
    value: "pg_single",
    label: "PG Tunggal",
    icon: CircleDot,
    preview: "○ A    ○ B    ○ C    ○ D",
    description: "Pilihan ganda dengan satu jawaban benar",
  },
  {
    value: "pg_multi",
    label: "PG Multi",
    icon: CheckSquare,
    preview: "☐ A    ☐ B    ☐ C    ☐ D",
    description: "Pilihan ganda dengan beberapa jawaban benar",
  },
  {
    value: "true_false",
    label: "Benar / Salah",
    icon: ToggleLeft,
    preview: "○ Benar      ○ Salah",
    description: "Hanya dua pilihan: benar atau salah",
  },
  {
    value: "fill_blank",
    label: "Isian Singkat",
    icon: TextCursorInput,
    preview: "Ibu kota Indonesia adalah ____",
    description: "Soal dengan jawaban kata/kalimat singkat",
  },
  {
    value: "matching",
    label: "Menyambungkan",
    icon: Link2,
    preview: "A → 1    B → 2    C → 3",
    description: "Pasangkan item kiri dengan item kanan",
  },
  {
    value: "pair_match",
    label: "Menjodohkan",
    icon: GitCompare,
    preview: "Premise  ↔  Response",
    description: "Cocokkan pasangan antara dua kelompok",
  },
  {
    value: "essay",
    label: "Esai",
    icon: FileText,
    preview: "Jelaskan mengapa...",
    description: "Soal uraian, dinilai manual oleh guru",
  },
];

interface QuestionTypePickerProps {
  value: string;
  onChange: (v: string) => void;
}

export function QuestionTypePicker({ value, onChange }: QuestionTypePickerProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {QUESTION_TYPES.map((t) => {
        const isSelected = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all",
              isSelected
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-200 dark:ring-blue-800"
                : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-900/50"
            )}
          >
            {isSelected && (
              <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                isSelected
                  ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                  : "bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400"
              )}
            >
              <t.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {t.description}
              </p>
              <p className="text-[10px] font-mono text-slate-400 dark:text-zinc-600 mt-1.5 truncate">
                {t.preview}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
