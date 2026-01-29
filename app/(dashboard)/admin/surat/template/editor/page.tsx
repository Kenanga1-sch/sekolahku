"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import ImageExtension from "@tiptap/extension-image";
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'

import { toast } from "sonner";
import { EditorToolbar } from "@/components/letters/editor-toolbar";
import { ImportDialog } from "@/components/letters/import-dialog";
import { EditorSidebar } from "@/components/letters/editor-sidebar";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TemplateEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("id");

  // State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [paperSize, setPaperSize] = useState("A4");
  const [orientation, setOrientation] = useState("portrait");
  const [type, setType] = useState<"EDITOR" | "UPLOAD">("EDITOR"); // New State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false); // New State

  // Editor Setup
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      LinkExtension,
      ImageExtension,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: "<p>Ketik isi surat di sini...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-sm xl:prose-base focus:outline-none min-h-[500px] w-full max-w-none p-8 bg-white text-black shadow-sm border mx-auto",
        style: "width: 210mm; min-height: 297mm;" // Initial A4
      },
    },
    immediatelyRender: false,
  });

  // Load Data
  useEffect(() => {
    if (templateId) {
      fetch(`/api/letters/templates/${templateId}`)
        .then(res => {
            if(!res.ok) throw new Error("Failed");
            return res.json();
        })
        .then(data => {
            setName(data.name);
            setCategory(data.category);
            setPaperSize(data.paperSize);
            setOrientation(data.orientation);
            setType(data.type || "EDITOR"); // Set Type
            if (data.type !== 'UPLOAD' && editor) {
                 editor.commands.setContent(data.content);
            }
        })
        .finally(() => setLoading(false));
    } else {
        setLoading(false);
    }
  }, [templateId, editor]);

  // Adjust paper size visual
  useEffect(() => {
    if (!editor) return;
    
    let width = "210mm";
    let height = "297mm";
    
    if (paperSize === "F4") {
        width = "215mm";
        height = "330mm";
    } else if (paperSize === "LEGAL") {
        width = "216mm";
        height = "356mm";
    }

    if (orientation === "landscape") {
        const w = width;
        width = height;
        height = w;
    }

    const dom = document.querySelector(".ProseMirror") as HTMLElement;
    if (dom) {
        dom.style.width = width;
        dom.style.minHeight = height;
    }
  }, [paperSize, orientation, editor]);

  // Actions
  const handleSave = async () => {
    if (!name) {
        toast.error("Nama template wajib diisi");
        return;
    }

    setSaving(true);
    try {
        const payload = {
            name,
            category,
            paperSize,
            orientation,
            content: type === 'EDITOR' ? editor?.getHTML() : undefined, // Only save content if EDITOR
            type // Pass type
        };

        const url = templateId 
            ? `/api/letters/templates/${templateId}` 
            : `/api/letters/templates`;
            
        const method = templateId ? "PATCH" : "POST";

        const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Failed to save");

        toast.success("Template berhasil disimpan");
        router.push("/admin/surat/template");
    } catch (error) {
        toast.error("Gagal menyimpan template");
    } finally {
        setSaving(false);
    }
  };

  if (!editor || loading) return (
      <div className="h-screen flex items-center justify-center flex-col gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-muted-foreground animate-pulse">Memuat editor...</p>
      </div>
  );

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-zinc-50 dark:bg-zinc-950">
       <EditorToolbar 
          name={name} 
          setName={setName}
          category={category}
          setCategory={setCategory}
          onSave={handleSave}
          onPreview={() => setIsPreviewOpen(true)}
          saving={saving}
          onUndo={() => editor?.chain().focus().undo().run()}
          onRedo={() => editor?.chain().focus().redo().run()}
          canUndo={editor?.can().undo() ?? false}
          canRedo={editor?.can().redo() ?? false}
          onImport={() => setIsImportOpen(true)}
          mode={type}
       />

       {type === 'UPLOAD' ? (
           <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-8 text-center text-muted-foreground">
              <div className="h-24 w-24 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-full flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">Template Word (.docx)</h2>
              <p className="max-w-md mx-auto mt-2 text-lg">
                Template ini menggunakan file Word yang diupload. <br/>
                Editor visual tidak tersedia.
              </p>
              <div className="flex gap-4 mt-8">
                  <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                    Upload Ulang / Ganti File
                  </Button>
              </div>
           </div>
       ) : (
           <div className="flex-1 flex overflow-hidden">
              {/* Canvas Area */}
              <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-zinc-100 dark:bg-zinc-950/50">
                 <div className="scale-[0.8] md:scale-100 origin-top transition-transform duration-200">
                    <EditorContent editor={editor} />
                 </div>
              </div>

              {/* Sidebar */}
              <EditorSidebar 
                 editor={editor}
                 paperSize={paperSize}
                 setPaperSize={setPaperSize}
                 orientation={orientation}
                 setOrientation={setOrientation}
              />
           </div>
       )}

       {/* Preview Modal */}
       <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
             <DialogHeader className="p-4 border-b">
                <DialogTitle>Preview Template</DialogTitle>
                <DialogDescription>Tampilan sementara tanpa data asli.</DialogDescription>
             </DialogHeader>
             <div className="flex-1 overflow-auto bg-zinc-100 dark:bg-zinc-900/50 p-8 flex justify-center rounded-b-lg">
                <div 
                   className="bg-white text-black shadow-lg p-[20mm] origin-top scale-[0.6] md:scale-90"
                   dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
                   style={{
                       width: paperSize === 'F4' ? '215mm' : paperSize === 'LEGAL' ? '216mm' : '210mm',
                       minHeight: paperSize === 'F4' ? '330mm' : paperSize === 'LEGAL' ? '356mm' : '297mm',
                       transform: orientation === 'landscape' ? 'rotate(0deg)' : 'none'
                   }}
                />
             </div>
          </DialogContent>
       </Dialog>

       <ImportDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
}
