"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LETTER_PAPER_OPTIONS,
  type LetterDocumentData,
  type LetterOrientation,
  type LetterPaperSize,
} from "@/lib/config/letter-document";

/** Dialog pengaturan dokumen (ukuran kertas, orientasi, watermark, footer). */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: LetterDocumentData;
  onChange: (doc: LetterDocumentData) => void;
}

export function DocumentSettingsDialog({
  open,
  onOpenChange,
  document,
  onChange,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pengaturan Dokumen</DialogTitle>
          <DialogDescription>
            Atur ukuran kertas, orientasi, watermark, dan catatan kaki untuk seluruh dokumen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Ukuran Kertas</Label>
            <Select
              value={document.paperSize || "A4"}
              onValueChange={(v) => onChange({ ...document, paperSize: v as LetterPaperSize })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LETTER_PAPER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Orientasi Halaman</Label>
            <Select
              value={document.orientation || "portrait"}
              onValueChange={(v) => onChange({ ...document, orientation: v as LetterOrientation })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Tegak (Portrait)</SelectItem>
                <SelectItem value="landscape">Mendatar (Landscape)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Teks Watermark (opsional)</Label>
            <Input
              value={document.watermark || ""}
              onChange={(e) => onChange({ ...document, watermark: e.target.value })}
              placeholder="mis. DRAFT / RAHASIA / SALINAN"
              className="h-8 text-sm"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 pt-1 text-xs">
            <Checkbox
              checked={document.showFooter !== false}
              onCheckedChange={(v) => onChange({ ...document, showFooter: v === true })}
              className="h-4 w-4"
            />
            Tampilkan nomor halaman di footer (&quot;Halaman X dari Y&quot;)
          </label>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Selesai
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
