"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Trash2,
  Copy,
  FilePlus2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createPage,
  newPageId,
  type LetterDocumentData,
  type LetterPage,
} from "@/lib/config/letter-document";
import {
  createBlockInstance,
  type LetterBlockInstance,
} from "@/lib/config/letter-blocks";
import { LetterBlockEditor } from "@/components/letter-builder/letter-block-editor";
import { SortableList } from "@/components/letter-builder/sortable-list";

interface Props {
  document: LetterDocumentData;
  onChange: (doc: LetterDocumentData) => void;
  /**
   * Varian tata letak untuk panel blok:
   *  - "sidebar" (default): palet di dalam kolom (mobile).
   *  - "compact": palet disembunyikan karena sudah dipindah ke ribbon atas (desktop),
   *    namun editor isi blok tetap tampil di kolom.
   */
  variant?: "sidebar" | "compact";
  /** Callback saat susunan blok halaman aktif berubah (untuk palet di luar). */
  onActiveBlocksChange?: (blocks: LetterBlockInstance[]) => void;
  /** Indeks halaman aktif (controlled). Bila diisi, halaman dikendalikan induk. */
  activePageIdx?: number;
  /** Callback saat halaman aktif berubah (untuk controlled mode). */
  onActivePageIdxChange?: (idx: number) => void;
}

/** Handle imperatif agar ribbon atas bisa menambah blok ke halaman aktif. */
export interface LetterDocumentEditorHandle {
  /** Tambah blok ke halaman yang sedang aktif. */
  addBlockToActivePage: (blockId: string) => void;
  /** Susunan blok halaman aktif (untuk disabling di palet). */
  getActiveBlocks: () => LetterBlockInstance[];
}

/**
 * Editor dokumen surat multi-halaman (mode halaman eksplisit).
 *
 * Menampilkan daftar halaman + editor blok untuk halaman yang dipilih.
 * Setiap halaman punya susunan blok sendiri; ada opsi "pakai kop".
 *
 * Seluruh isi berada dalam SATU area scroll vertikal sehingga tidak ada lagi
 * menu yang tidak dapat dijangkau di layar pendek.
 */
export const LetterDocumentEditor = forwardRef<LetterDocumentEditorHandle, Props>(
  function LetterDocumentEditor(
    {
      document,
      onChange,
      variant = "sidebar",
      onActiveBlocksChange,
      activePageIdx: controlledIdx,
      onActivePageIdxChange,
    },
    ref
  ) {
    const [internalIdx, setInternalIdx] = useState(0);
    const setActivePageIdx = (idx: number) => {
      setInternalIdx(idx);
      onActivePageIdxChange?.(idx);
    };
    const [renaming, setRenaming] = useState<string | null>(null);
    const renameRef = useRef<HTMLInputElement>(null);

    const pages = document.pages;
    const activePageIdx = controlledIdx ?? internalIdx;
    const safeIdx = Math.min(activePageIdx, Math.max(pages.length - 1, 0));
    const activePage = pages[safeIdx];

    // Laporkan susunan blok halaman aktif ke pemanggil (untuk palet ribbon/tab).
    useEffect(() => {
      onActiveBlocksChange?.(activePage?.blocks ?? []);
    }, [activePage?.blocks, onActiveBlocksChange]);

    const updatePages = (nextPages: LetterPage[]) => {
      onChange({ ...document, pages: nextPages });
    };

    const updateActiveBlocks = (blocks: LetterBlockInstance[]) => {
      updatePages(pages.map((p, i) => (i === safeIdx ? { ...p, blocks } : p)));
    };

    /** Tambah blok ke halaman aktif (dipakai internal & via handle). */
    const addBlockToActivePage = (blockId: string) => {
      const inst = createBlockInstance(blockId);
      if (!inst) return;
      const current = pages[safeIdx]?.blocks ?? [];
      updatePages(
        pages.map((p, i) => (i === safeIdx ? { ...p, blocks: [...current, inst] } : p))
      );
    };

    useImperativeHandle(
      ref,
      () => ({
        addBlockToActivePage,
        getActiveBlocks: () => pages[safeIdx]?.blocks ?? [],
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [pages, safeIdx]
    );

  const addPage = () => {
    const p = createPage(`Halaman ${pages.length + 1}`);
    updatePages([...pages, p]);
    setActivePageIdx(pages.length);
  };

  const duplicatePage = (idx: number) => {
    const src = pages[idx];
    const clone: LetterPage = {
      id: newPageId(),
      name: `${src.name} (salinan)`,
      useHeader: src.useHeader,
      blocks: src.blocks.map((b) => ({
        ...b,
        instanceId: createBlockInstance(b.blockId)?.instanceId ?? `${b.blockId}-dup`,
        data: { ...b.data },
      })),
    };
    const next = [...pages];
    next.splice(idx + 1, 0, clone);
    updatePages(next);
    setActivePageIdx(idx + 1);
  };

  const removePage = (idx: number) => {
    if (pages.length <= 1) return;
    const next = pages.filter((_, i) => i !== idx);
    updatePages(next);
    setActivePageIdx(Math.max(0, Math.min(safeIdx, next.length - 1)));
  };

  const movePage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[idx], next[target]] = [next[target], next[idx]];
    updatePages(next);
    setActivePageIdx(target);
  };

  const reorderPages = (next: LetterPage[]) => {
    updatePages(next);
    // Jaga halaman aktif tetap menyorot halaman yang sama setelah urutan berubah.
    const activeId = pages[safeIdx]?.id;
    const newIdx = next.findIndex((p) => p.id === activeId);
    if (newIdx >= 0) setActivePageIdx(newIdx);
  };

  const setPageName = (idx: number, name: string) => {
    updatePages(pages.map((p, i) => (i === idx ? { ...p, name } : p)));
  };

  const toggleHeader = (idx: number) => {
    updatePages(pages.map((p, i) => (i === idx ? { ...p, useHeader: !p.useHeader } : p)));
  };

  const totalBlocks = pages.reduce((s, p) => s + p.blocks.length, 0);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Daftar halaman */}
      <div className="shrink-0 border-b bg-muted/30 p-2">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Halaman ({pages.length}) • {totalBlocks} blok
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px]"
            onClick={addPage}
          >
            <FilePlus2 className="h-3.5 w-3.5" /> Halaman
          </Button>
        </div>
        <SortableList
          items={pages}
          getId={(p) => p.id}
          onReorder={reorderPages}
          ariaItemLabel={(p) => `Pindahkan halaman ${p.name}`}
          renderItem={(p, idx, handle) => (
            <div
              className={`flex items-center gap-1 rounded-md border px-1.5 py-1 ${
                idx === safeIdx ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30" : "bg-card"
              }`}
            >
              {handle}
              {renaming === p.id ? (
                <input
                  ref={renameRef}
                  autoFocus
                  defaultValue={p.name}
                  aria-label="Nama halaman"
                  className="min-w-0 flex-1 rounded border bg-background px-1 text-xs"
                  onBlur={(e) => {
                    setPageName(idx, e.target.value || p.name);
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setPageName(idx, (e.target as HTMLInputElement).value || p.name);
                      setRenaming(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-xs font-medium"
                  onClick={() => setActivePageIdx(idx)}
                  onDoubleClick={() => setRenaming(p.id)}
                  title="Klik untuk pilih, dobel-klik untuk ganti nama"
                >
                  {p.name}
                  {p.useHeader && (
                    <Badge variant="outline" className="ml-1 px-1 py-0 text-[9px]">
                      kop
                    </Badge>
                  )}
                </button>
              )}
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => toggleHeader(idx)}
                  aria-label={p.useHeader ? "Matikan kop halaman" : "Pakai kop halaman"}
                  title={p.useHeader ? "Matikan kop" : "Pakai kop"}
                >
                  {p.useHeader ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => movePage(idx, -1)}
                  disabled={idx === 0}
                  aria-label="Pindahkan halaman ke atas"
                  title="Naik"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => movePage(idx, 1)}
                  disabled={idx === pages.length - 1}
                  aria-label="Pindahkan halaman ke bawah"
                  title="Turun"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => duplicatePage(idx)}
                  aria-label="Duplikat halaman"
                  title="Duplikat halaman"
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-red-600 hover:text-red-700"
                  onClick={() => removePage(idx)}
                  disabled={pages.length <= 1}
                  aria-label="Hapus halaman"
                  title="Hapus halaman"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        />
      </div>

      {/* Editor blok halaman aktif */}
      {activePage && (
        <div className="min-h-0 flex-1">
          <LetterBlockEditor
            blocks={activePage.blocks}
            onChange={updateActiveBlocks}
            pageName={activePage.name}
            variant={variant}
          />
        </div>
      )}
    </div>
  );
  }
);
