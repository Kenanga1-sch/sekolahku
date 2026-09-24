"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LETTER_VARIABLES } from "@/lib/config/letter-variables";
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
          <VariableMenu onPick={onInsertVar} />
        </>
      )}
    </div>
  );
}

function VariableMenu({ onPick }: { onPick: (token: string) => void }) {
  const groups = useMemo(() => Object.entries(LETTER_VARIABLES), []);

  const insert = useCallback(
    (token: string) => {
      onPick(token);
    },
    [onPick]
  );

  return (
    <details className="group">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded px-1.5 text-xs text-muted-foreground hover:bg-muted">
        <Variable className="h-3.5 w-3.5" /> Variabel
      </summary>
      <div className="absolute left-0 z-50 mt-1 max-h-56 w-64 overflow-y-auto rounded border bg-popover p-1 shadow-md">
        {groups.map(([group, items]) => (
          <div key={group} className="mb-1">
            <p className="px-1 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
              {group}
            </p>
            {items.map((it) => (
              <button
                key={it.value}
                type="button"
                className="block w-full rounded px-1 py-0.5 text-left text-xs hover:bg-accent"
                onClick={() => insert(it.value)}
              >
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </details>
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
          "prose prose-sm dark:prose-invert max-w-none min-h-[80px] p-2 focus:outline-none",
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
    <div className={cn("overflow-hidden rounded-md border", className)}>
      <Toolbar editor={editor} allowVariables={allowVariables} onInsertVar={insertVar} />
      <EditorContent editor={editor} />
    </div>
  );
}
