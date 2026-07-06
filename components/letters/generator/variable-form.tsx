"use client";

import { ArrowLeft, ArrowRight, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface VariableFormProps {
  manualVars: string[];
  manualInputs: Record<string, string>;
  setManualInputs: (inputs: Record<string, string>) => void;
  onBack: () => void;
  onNext: () => void;
}

export function VariableForm({
  manualVars,
  manualInputs,
  setManualInputs,
  onBack,
  onNext,
}: VariableFormProps) {
  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
      <CardHeader className="bg-slate-50/50 dark:bg-zinc-800/20 border-b border-slate-100 dark:border-slate-800/80 px-6 py-4">
        <CardTitle className="text-base text-slate-800 dark:text-slate-100 font-semibold">2. Isi Variabel Surat</CardTitle>
        <CardDescription className="text-xs">Lengkapi data tambahan yang diperlukan oleh template di bawah ini.</CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {manualVars.length === 0 ? (
          <div className="text-center py-8 px-4 flex flex-col items-center justify-center space-y-3 bg-slate-50/50 dark:bg-zinc-950/20 border border-dashed rounded-xl">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">Semua Data Terpenuhi</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Template ini tidak memerlukan input manual tambahan. Semua data diambil otomatis dari sistem.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manualVars.map((v) => (
              <div key={v} className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize">
                  {v.replace(/_/g, " ")}
                </Label>
                <Input
                  placeholder={`Masukkan ${v.replace(/_/g, " ")}`}
                  value={manualInputs[v] || ""}
                  onChange={(e) => setManualInputs({ ...manualInputs, [v]: e.target.value })}
                  className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-zinc-900/10">
        <Button variant="ghost" onClick={onBack} className="rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 font-medium">
          Kembali Pilih Template
        </Button>
        <Button onClick={onNext} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5 font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-100 dark:shadow-none">
          Lanjut Pratinjau <ArrowRight className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

