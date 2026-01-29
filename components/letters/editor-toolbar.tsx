"use client";

import { ArrowLeft, Save, Eye, Undo, Redo, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";

interface EditorToolbarProps {
  name: string;
  setName: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  onSave: () => void;
  onPreview: () => void;
  saving: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onImport: () => void;
  mode: "EDITOR" | "UPLOAD";
}

export function EditorToolbar({ 
  name, 
  setName, 
  category, 
  setCategory, 
  onSave,
  onPreview,
  saving,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onImport,
  mode
}: EditorToolbarProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white dark:bg-zinc-900 sticky top-0 z-10 w-full overflow-x-auto gap-4">
      <div className="flex items-center gap-4 shrink-0">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col gap-1">
          <Label htmlFor="tpl-name" className="sr-only">Nama Template</Label>
          <Input 
            id="tpl-name"
            placeholder="Nama Template" 
            className="h-8 w-[200px] md:w-[300px]" 
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">Umum</SelectItem>
            <SelectItem value="STUDENT">Siswa</SelectItem>
            <SelectItem value="STAFF">Guru/Staff</SelectItem>
            <SelectItem value="PARENT">Orang Tua</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="outline"
            size="sm"
            onClick={onImport}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
             <Upload className="h-4 w-4 mr-2" /> Import Template
          </Button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {mode === "EDITOR" && (
            <>
                <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Undo">
                <Undo className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} title="Redo">
                <Redo className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-2" />
            </>
        )}
        <Button variant="outline" size="sm" onClick={onPreview}>
           <Eye className="h-4 w-4 mr-2" /> Preview
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </div>
  );
}
