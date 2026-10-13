"use client";

import React from "react";
import { MoreVertical, Download, Pencil, Copy, Scissors, Share2, Trash2, RotateCw, FolderInput, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import * as cloud from "@/lib/cloudstorage/api";
import type { CloudFile } from "@/lib/cloudstorage/api";

/** Satu aksi dalam menu/bottom-sheet berkas. */
interface RowAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  /** Bila diisi, aksi dirender sebagai tautan (mis. Unduh). */
  href?: string;
  danger?: boolean;
  /** Pemisah sebelum aksi ini (petunjuk pengelompokan). */
  dividerBefore?: boolean;
}

/**
 * Menu aksi per-item. Desktop: DropdownMenu. Mobile (sentuh): bottom-sheet
 * dengan target baris besar — jauh lebih nyaman di jari daripada dropdown
 * mengambang. Keduanya berbagi SATU daftar aksi agar tidak divergen.
 */
export function RowActions({
  file,
  onPreview,
  onRename,
  onCopy,
  onCut,
  onShare,
  onDelete,
  onEdit,
  onRotate,
  onMoveTo,
  onCopyTo,
}: {
  file: CloudFile;
  onPreview: () => void;
  onRename: () => void;
  onCopy: () => void;
  onCut: () => void;
  onShare: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRotate: (deg: number) => void;
  onMoveTo: () => void;
  onCopyTo: () => void;
}) {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const isImage = !file.is_folder && (file.mime_type || "").startsWith("image/");
  const canEdit = cloud.isEditableText(file);

  const actions: RowAction[] = [];
  if (!file.is_folder) {
    actions.push({ id: "preview", label: "Pratinjau", icon: FileText, onClick: onPreview });
  }
  if (canEdit) {
    actions.push({ id: "edit", label: "Edit teks", icon: Pencil, onClick: onEdit });
  }
  if (isImage) {
    actions.push({ id: "rotate-right", label: "Putar 90° ke kanan", icon: RotateCw, onClick: () => onRotate(90) });
    actions.push({ id: "rotate-left", label: "Putar 90° ke kiri", icon: RotateCw, onClick: () => onRotate(270) });
  }
  if (!file.is_folder) {
    actions.push({ id: "download", label: "Unduh", icon: Download, href: cloud.fileDownloadUrl(file.id, true) });
  }
  actions.push({ id: "rename", label: "Ganti Nama", icon: Pencil, onClick: onRename, dividerBefore: true });
  actions.push({ id: "move-to", label: "Pindah ke…", icon: FolderInput, onClick: onMoveTo });
  actions.push({ id: "copy-to", label: "Salin ke…", icon: Copy, onClick: onCopyTo });
  actions.push({ id: "copy", label: "Salin", icon: Copy, onClick: onCopy });
  actions.push({ id: "cut", label: "Potong", icon: Scissors, onClick: onCut });
  actions.push({ id: "share", label: "Bagikan", icon: Share2, onClick: onShare });
  actions.push({ id: "delete", label: "Hapus", icon: Trash2, onClick: onDelete, danger: true, dividerBefore: true });

  const logoTrigger = (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Menu berkas"
      className="h-9 w-9 opacity-100 md:h-7 md:w-7 md:opacity-0 md:group-hover:opacity-100 md:data-[state=open]:opacity-100 data-[state=open]:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <MoreVertical className="h-4 w-4" />
    </Button>
  );

  const run = (a: RowAction) => {
    setSheetOpen(false);
    a.onClick?.();
  };

  return (
    <>
      {/* Desktop: dropdown mengambang */}
      <div className="hidden md:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{logoTrigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {actions.map((a) => (
              <React.Fragment key={a.id}>
                {a.dividerBefore && <DropdownMenuSeparator />}
                {a.href ? (
                  <DropdownMenuItem asChild>
                    <a href={a.href} download>
                      <a.icon className="mr-2 h-4 w-4" /> {a.label}
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className={a.danger ? "text-rose-600" : undefined}
                    onClick={a.onClick}
                  >
                    <a.icon className="mr-2 h-4 w-4" /> {a.label}
                  </DropdownMenuItem>
                )}
              </React.Fragment>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile: bottom-sheet dengan baris besar & label */}
      <div className="md:hidden">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Menu berkas"
          className="h-9 w-9"
          onClick={(e) => {
            e.stopPropagation();
            setSheetOpen(true);
          }}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl p-0">
            <SheetHeader className="border-b dark:border-neutral-800">
              <SheetTitle className="truncate pr-8 text-left text-base">{file.name}</SheetTitle>
            </SheetHeader>
            <div className="max-h-[70vh] overflow-y-auto py-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
              {actions.map((a) => {
                const Icon = a.icon;
                const itemCls = cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors active:bg-neutral-100 dark:active:bg-neutral-800",
                  a.danger ? "text-rose-600" : "text-neutral-700 dark:text-neutral-200",
                  a.dividerBefore && "border-t dark:border-neutral-800"
                );
                return a.href ? (
                  <a key={a.id} href={a.href} download className={itemCls} onClick={() => setSheetOpen(false)}>
                    <Icon className="h-5 w-5 shrink-0" />
                    {a.label}
                  </a>
                ) : (
                  <button key={a.id} type="button" className={itemCls} onClick={() => run(a)}>
                    <Icon className="h-5 w-5 shrink-0" />
                    {a.label}
                  </button>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
