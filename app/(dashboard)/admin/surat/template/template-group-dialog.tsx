"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { goGet, goPost, goPut } from "@/lib/api-client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialData?: any;
}

export function TemplateGroupDialog({ open, onOpenChange, onSuccess, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [templatesList, setTemplatesList] = useState<any[]>([]); // For dropdown

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          description: initialData.description || "",
        });
        setSelectedTemplateIds(initialData.items?.map((item: any) => item.templateId) || []);
      } else {
        setFormData({ name: "", description: "" });
        setSelectedTemplateIds([]);
      }
      fetchTemplates();
    }
  }, [open, initialData]);

  const fetchTemplates = async () => {
    try {
      const data: any = await goGet("/api/eoffice/letter-templates?perPage=100");
      setTemplatesList(data.data || []);
    } catch (e) {}
  };

  const handleAddTemplate = (tplId: string) => {
    if (!tplId || selectedTemplateIds.includes(tplId)) return;
    setSelectedTemplateIds([...selectedTemplateIds, tplId]);
  };

  const handleRemoveTemplate = (tplId: string) => {
    setSelectedTemplateIds(selectedTemplateIds.filter(id => id !== tplId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Nama grup wajib diisi");
      return;
    }
    if (selectedTemplateIds.length === 0) {
      toast.error("Minimal harus ada 1 template di dalam grup");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        items: selectedTemplateIds.map(id => ({ templateId: id })),
      };

      if (initialData) {
        await goPut(`/api/eoffice/template-groups/${initialData.id}`, payload);
        toast.success("Grup template diperbarui");
      } else {
        await goPost("/api/eoffice/template-groups", payload);
        toast.success("Grup template berhasil dibuat");
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan grup template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{initialData ? "Edit Grup Template" : "Buat Grup Template"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Nama Paket / Grup</Label>
            <Input
              placeholder="Contoh: Paket Mutasi Keluar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Deskripsi Singkat</Label>
            <Textarea
              placeholder="Jelaskan isi paket ini..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Daftar Template dalam Grup</Label>
            <div className="flex gap-2 mb-2">
              <Select onValueChange={handleAddTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih template untuk ditambahkan..." />
                </SelectTrigger>
                <SelectContent>
                  {templatesList.filter(t => !selectedTemplateIds.includes(t.id)).map(tpl => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
              {selectedTemplateIds.length === 0 ? (
                <div className="p-3 text-sm text-center text-muted-foreground">
                  Belum ada template yang dipilih
                </div>
              ) : (
                selectedTemplateIds.map(tplId => {
                  const tplInfo = templatesList.find(t => t.id === tplId) || (initialData?.items?.find((i:any) => i.templateId === tplId)?.template);
                  return (
                    <div key={tplId} className="flex items-center justify-between p-2 px-3 text-sm">
                      <span>{tplInfo?.name || tplId}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-600 px-2" onClick={() => handleRemoveTemplate(tplId)}>Hapus</Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? "Menyimpan..." : "Simpan Grup"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
