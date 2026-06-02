"use client";

import { ArrowRight } from "lucide-react";
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
    <Card>
      <CardHeader>
        <CardTitle>Isi Variabel Surat</CardTitle>
        <CardDescription>Lengkapi data yang kosong di bawah ini.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {manualVars.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-muted-foreground italic text-sm">Tidak ada variabel manual.</p>
          </div>
        ) : (
          manualVars.map((v) => (
            <div key={v} className="space-y-2">
              <Label className="capitalize">{v.replace(/_/g, " ")}</Label>
              <Input
                placeholder={`Masukkan ${v.replace(/_/g, " ")}`}
                value={manualInputs[v] || ""}
                onChange={(e) => setManualInputs({ ...manualInputs, [v]: e.target.value })}
              />
            </div>
          ))
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          Kembali
        </Button>
        <Button onClick={onNext} className="bg-blue-600">
          Lanjut Preview <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
