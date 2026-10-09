"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { siteConfig } from "@/lib/config";
import { getSchoolLogo } from "@/lib/school-logo";
import { goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";
import {
  DEFAULT_ADJUST,
  isAdjustDirty,
  readAdjustStorage,
  readSettingsStorage,
  writeAdjustStorage,
  writeSettingsStorage,
  withOffset,
  type AdjustAll,
  type PrintMode,
} from "@/lib/kartu-print-layout";

/** Data kartu GTK dari POST /api/master/employees/print. */
export interface GtkCard {
  id: string;
  name: string;
  email?: string;
  nip: string | null;
  nuptk: string | null;
  nik?: string | null;
  employmentStatus: string | null;
  jobType: string | null;
  category: string | null;
  degree?: string | null;
  photoUrl: string | null;
  joinDate?: string | null;
}

const STORAGE_PREFIX = "gtk-cetak-kartu";

export function useCetakKartuGtk() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const { settings } = useSchoolSettings();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cards, setCards] = useState<GtkCard[]>([]);
  const [cardsPerRow, setCardsPerRow] = useState("2");
  const [showPhoto, setShowPhoto] = useState(true);
  const [showNIP, setShowNIP] = useState(true);
  const [showBackSide, setShowBackSide] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode>("combined");
  const [flipEdge, setFlipEdge] = useState<"long" | "short">("long");
  // Kalibrasi posisi cetak (mm) per mode per sisi per kolom — prefix storage
  // terpisah dari siswa (gtk-cetak-kartu-*).
  const [adjust, setAdjust] = useState<AdjustAll>(DEFAULT_ADJUST);
  const [savedAdjust, setSavedAdjust] = useState<AdjustAll>(DEFAULT_ADJUST);
  const [settingsHydrated, setSettingsHydrated] = useState(false);

  useEffect(() => {
    const saved = readAdjustStorage(STORAGE_PREFIX);
    if (saved) { setAdjust(saved); setSavedAdjust(saved); }
    const s = readSettingsStorage(STORAGE_PREFIX);
    if (s) {
      setCardsPerRow(s.cardsPerRow);
      setShowPhoto(s.showPhoto);
      setShowNIP(s.showNIS);
      setShowBackSide(s.showBackSide);
      setPrintMode(s.printMode);
      setFlipEdge(s.flipEdge);
    }
    setSettingsHydrated(true);
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    writeSettingsStorage(
      { cardsPerRow, cardType: "gtk", showPhoto, showNIS: showNIP, showBackSide, printMode, flipEdge },
      STORAGE_PREFIX
    );
  }, [settingsHydrated, cardsPerRow, showPhoto, showNIP, showBackSide, printMode, flipEdge]);

  const setOffset = useCallback(
    (mode: PrintMode, side: "front" | "back", col: number, axis: "x" | "y", value: number) => {
      setAdjust((prev) => withOffset(prev, mode, side, col, axis, value));
    },
    []
  );

  const saveAdjust = useCallback(() => {
    const ok = writeAdjustStorage(adjust, STORAGE_PREFIX);
    if (ok) {
      setSavedAdjust(adjust);
      toast.success("Pengaturan posisi disimpan");
    } else {
      toast.error("Gagal menyimpan — penyimpanan browser penuh atau diblokir");
    }
  }, [adjust]);

  const resetAdjust = useCallback(() => setAdjust(DEFAULT_ADJUST), []);

  const adjustDirty = isAdjustDirty(adjust, savedAdjust);

  const downloadCard = useCallback(async (id: string, name: string) => {
    const element = cardRefs.current.get(id);
    if (!element) return;
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(element, { quality: 1, pixelRatio: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `kartu-gtk-${name.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error downloading card:", error);
      toast.error("Gagal mengunduh kartu");
    }
  }, []);

  const downloadAllCards = useCallback(async () => {
    setDownloading(true);
    try {
      const htmlToImage = await import("html-to-image");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder("kartu-gtk");
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const element = cardRefs.current.get(card.id);
        if (!element) continue;
        toast.info(`Memproses kartu ${i + 1}/${cards.length}...`);
        const dataUrl = await htmlToImage.toPng(element, { quality: 1, pixelRatio: 3, backgroundColor: "#ffffff" });
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const fileName = `kartu-gtk-${card.name.replace(/\s+/g, "-").toLowerCase()}.png`;
        folder?.file(fileName, base64Data, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `kartu-gtk-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${cards.length} kartu berhasil diunduh sebagai ZIP`);
    } catch (error) {
      console.error("Error downloading cards:", error);
      toast.error("Gagal mengunduh kartu");
    } finally {
      setDownloading(false);
    }
  }, [cards]);

  useEffect(() => {
    const fetchCards = async () => {
      const ids = searchParams.get("ids");
      if (!ids) {
        toast.error("Tidak ada GTK yang dipilih");
        router.push("/admin/master/gtk?tab=cetak-kartu");
        return;
      }
      try {
        const response: any = await goPost("/api/master/employees/print", { employeeIds: ids.split(",") });
        if (response.success) setCards(response.data);
        else { showError(response.error || "Gagal memuat data"); router.push("/admin/master/gtk?tab=cetak-kartu"); }
      } catch { showError("Terjadi kesalahan saat memproses data"); }
      finally { setLoading(false); }
    };
    fetchCards();
  }, [searchParams, router]);

  const handlePrint = () => window.print();

  const schoolName = settings?.school_name || siteConfig.school.name;
  const schoolAddress = settings?.school_address || "Jl. Pendidikan No. 1";
  const schoolLogo = getSchoolLogo(settings?.school_logo);

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  return {
    loading, downloading, cards, cardsPerRow, setCardsPerRow,
    showPhoto, setShowPhoto, showNIP, setShowNIP, showBackSide, setShowBackSide,
    printMode, setPrintMode, flipEdge, setFlipEdge,
    adjust, setOffset, saveAdjust, resetAdjust, adjustDirty,
    schoolName, schoolAddress, schoolLogo, printRef, cardRefs,
    downloadCard, downloadAllCards, handlePrint, setCardRef, router,
  };
}
