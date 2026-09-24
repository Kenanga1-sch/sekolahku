"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignJustify,
  Undo,
  Redo,
  Variable,
  Maximize2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VariablePickerPopover } from "@/components/letter-builder/variable-picker-popover";
import { normalizeRichValue } from "@/lib/letter-richtext";

interface Props {
  /** Nilai tersimpan (JSON string; legacy teks biasa otomatis dikonversi). */
  value: string;
  onChange: (json: string) => void;
  placeholder?: string;
  allowVariables?: boolean;
  className?: string;
}

function Btn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("h-7 w-7 p-0", active && "bg-muted text-primary")}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  );
}

function Toolbar({
  editor,
  allowVariables,
  onInsertVar,
}: {
  editor: Editor | null;
  allowVariables?: boolean;
  onInsertVar: (token: string) => void;
}) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
      <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Tebal">
        <Bold className="h-3.5 w-3.5" />
      </Btn>
      <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Miring">
        <Italic className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Garis bawah"
      >
        <UnderlineIcon className="h-3.5 w-3.5" />
      </Btn>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Daftar bullet"
      >
        <List className="h-3.5 w-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Daftar nomor"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Btn>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Btn active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Kiri">
        <AlignLeft className="h-3.5 w-3.5" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} title="Tengah">
        <AlignCenter className="h-3.5 w-3.5" />
      </Btn>
      <Btn active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="Rata kanan-kiri">
        <AlignJustify className="h-3.5 w-3.5" />
      </Btn>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Btn disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} title="Batal">
        <Undo className="h-3.5 w-3.5" />
      </Btn>
      <Btn disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} title="Ulang">
        <Redo className="h-3.5 w-3.5" />
      </Btn>
      {allowVariables && (
        <>
          <Separator orientation="vertical" className="mx-0.5 h-5" />
          <VariablePickerPopover onSelect={onInsertVar} />
        </>
      )}
    </div>
  );
}

/**
 * Editor teks kaya untuk field blok ber-type "richtext".
 * Menyimpan nilai sebagai JSON TipTap (stabil & mudah diparsing renderer).
 */
export function RichTextField({
  value,
  onChange,
  placeholder,
  allowVariables,
  className,
}: Props) {
  const normalized = useMemo(() => normalizeRichValue(value), [value]);
  const [modalOpen, setModalOpen] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder || "Mulai menulis…" }),
    ],
    content: JSON.parse(normalized),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[90px] p-2.5 focus:outline-none",
          "[&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:my-1"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
  });

  // Sinkron bila nilai berubah dari luar (mis. muat dokumen tersimpan).
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (normalized !== current) {
      editor.commands.setContent(JSON.parse(normalized), { emitUpdate: false });
    }
  }, [normalized, editor]);

  const insertVar = useCallback(
    (token: string) => {
      editor?.chain().focus().insertContent(`${token} `).run();
    },
    [editor]
  );

  return (
    <>
      <div className={cn("relative overflow-hidden rounded-md border bg-card", className)}>
        <div className="flex items-center justify-between border-b bg-muted/20 pr-1">
          <Toolbar editor={editor} allowVariables={allowVariables} onInsertVar={insertVar} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setModalOpen(true)}
            title="Perbesar Editor Teks"
            aria-label="Perbesar editor teks"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <EditorContent editor={editor} />
      </div>

      {/* Modal Full Editor untuk kenyamanan menulis panjang */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex h-[85vh] max-w-4xl flex-col p-4">
          <DialogHeader className="border-b pb-2">
            <DialogTitle className="text-base font-semibold">Editor Teks Kaya (Mode Fokus)</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
            <Toolbar editor={editor} allowVariables={allowVariables} onInsertVar={insertVar} />
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <EditorContent editor={editor} className="min-h-[400px]" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setModalOpen(false)}>
              <Check className="mr-1.5 h-4 w-4" /> Selesai
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
