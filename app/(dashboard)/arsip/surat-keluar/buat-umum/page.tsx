"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { goPost } from "@/lib/api-client";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Typography } from "@tiptap/extension-typography";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TextStyle } from "@tiptap/extension-text-style";
import { FontFamily } from "@tiptap/extension-font-family";
import { Color } from "@tiptap/extension-color";
import { EditorSidebar } from "@/components/letters/editor-sidebar";

export default function BuatSuratUmumPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    mailNumber: "",
    recipient: "",
    subject: "",
    dateOfLetter: new Date().toISOString().split("T")[0],
    classificationCode: "",
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({ openOnClick: false }),
      Underline,
      ImageExtension.configure({ inline: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Highlight,
      Typography,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      FontFamily,
      Color,
      Placeholder.configure({
        placeholder: 'Ketik isi surat di sini...',
      }),
    ],
    content: "<p>Ketikkan surat Anda di sini...</p>",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.classificationCode) {
      toast.error("Kode klasifikasi wajib dipilih");
      return;
    }
    if (!formData.recipient || !formData.subject || !formData.dateOfLetter) {
      toast.error("Semua field wajib diisi");
      return;
    }
    if (!editor || editor.isEmpty) {
      toast.error("Isi surat tidak boleh kosong");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        htmlContent: editor.getHTML()
      };
      const res: any = await goPost("/api/eoffice/surat-keluar", payload);
      if (res.success) {
        toast.success("Surat umum berhasil dibuat!");
        router.push("/arsip/surat-keluar");
      } else {
        toast.error(res.error || "Gagal membuat surat");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Button 
              type="button"
              variant="ghost" 
              size="sm" 
              className="p-0 h-auto text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-transparent -ml-1 flex items-center gap-1.5 transition-colors"
              onClick={() => router.back()}
          >
              <ArrowLeft className="h-4 w-4" />
              Kembali
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Buat Surat Umum</h1>
            <p className="text-muted-foreground">
              Tulis surat bebas tanpa template.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="space-y-2">
            <Label>Tujuan (Kepada Yth)</Label>
            <Input 
              required
              placeholder="Cth: Orang Tua / Wali Murid"
              value={formData.recipient}
              onChange={e => setFormData({ ...formData, recipient: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Perihal</Label>
            <Input 
              required
              placeholder="Cth: Undangan Rapat Komite"
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Tanggal Surat</Label>
            <Input 
              required
              type="date"
              value={formData.dateOfLetter}
              onChange={e => setFormData({ ...formData, dateOfLetter: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Klasifikasi Surat (Wajib)</Label>
            <Input 
              required
              placeholder="Cth: 421 (Pendidikan)"
              value={formData.classificationCode}
              onChange={e => setFormData({ ...formData, classificationCode: e.target.value })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Nomor Surat (Opsional)</Label>
            <Input 
              placeholder="Kosongkan untuk otomatis (Sistem akan membuat nomor urut)"
              value={formData.mailNumber}
              onChange={e => setFormData({ ...formData, mailNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Isi Surat</Label>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950 min-h-[500px] flex flex-col">
            <EditorSidebar editor={editor} />
            <div className="flex-1 p-8 prose prose-slate max-w-none dark:prose-invert">
              <EditorContent editor={editor} className="min-h-[400px] outline-none" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? <span className="animate-pulse">Menyimpan...</span> : <><Send className="mr-2 h-4 w-4" /> Simpan Surat</>}
          </Button>
        </div>
      </form>
    </div>
  );
}
