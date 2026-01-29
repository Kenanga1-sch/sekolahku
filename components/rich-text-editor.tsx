"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    Bold,
    Italic,
    Strikethrough,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Link as LinkIcon,
    Image as ImageIcon,
    Heading1,
    Heading2,
    Heading3,
    Code,
    Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
    content: string;
    onChange: (content: string) => void;
    placeholder?: string;
    className?: string;
}

function ToolbarButton({
    active,
    disabled,
    onClick,
    children,
    title,
}: {
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
    title: string;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
                "h-8 w-8 p-0",
                active && "bg-muted text-primary"
            )}
            onClick={onClick}
            disabled={disabled}
            title={title}
        >
            {children}
        </Button>
    );
}

function Toolbar({ editor }: { editor: Editor | null }) {
    if (!editor) return null;

    const setLink = () => {
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("URL", previousUrl);
        if (url === null) return;
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const addImage = () => {
        const url = window.prompt("Image URL");
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    return (
        <div className="border-b bg-muted/30 p-1 flex flex-wrap gap-0.5">
            <ToolbarButton
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
                title="Bold"
            >
                <Bold className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
                title="Italic"
            >
                <Italic className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
                title="Strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("code")}
                onClick={() => editor.chain().focus().toggleCode().run()}
                title="Code"
            >
                <Code className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
                active={editor.isActive("heading", { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                title="Heading 1"
            >
                <Heading1 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("heading", { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("heading", { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                title="Heading 3"
            >
                <Heading3 className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                title="Ordered List"
            >
                <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                title="Quote"
            >
                <Quote className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                title="Horizontal Rule"
            >
                <Minus className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
                active={editor.isActive("link")}
                onClick={setLink}
                title="Link"
            >
                <LinkIcon className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                onClick={addImage}
                title="Image"
            >
                <ImageIcon className="h-4 w-4" />
            </ToolbarButton>

            <Separator orientation="vertical" className="mx-1 h-6" />

            <ToolbarButton
                disabled={!editor.can().chain().focus().undo().run()}
                onClick={() => editor.chain().focus().undo().run()}
                title="Undo"
            >
                <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton
                disabled={!editor.can().chain().focus().redo().run()}
                onClick={() => editor.chain().focus().redo().run()}
                title="Redo"
            >
                <Redo className="h-4 w-4" />
            </ToolbarButton>
        </div>
    );
}

export function RichTextEditor({
    content,
    onChange,
    placeholder = "Mulai menulis...",
    className,
}: RichTextEditorProps) {
    const editor = useEditor({
        immediatelyRender: false, // Prevent SSR hydration mismatch
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-primary underline",
                },
            }),
            Image.configure({
                HTMLAttributes: {
                    class: "rounded-lg max-w-full",
                },
            }),
        ],
        content: content,
        editorProps: {
            attributes: {
                class: cn(
                    "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-4 focus:outline-none",
                    "[&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4",
                    "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic"
                ),
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    return (
        <div className={cn("border rounded-lg overflow-hidden", className)}>
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}

export default RichTextEditor;
