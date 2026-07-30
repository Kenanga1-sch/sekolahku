"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { getSchoolLogo } from "@/lib/school-logo";
import { goPost } from "@/lib/api-client";
import { showError } from "@/lib/toast";

export interface StudentCard {
  id: string;
  fullName: string;
  nisn: string | null;
  nis: string | null;
  kip: string | null;
  className: string | null;
  photo: string | null;
  qrCode: string;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  birthDate: string | null;
  nik?: string | null;
  enrolledAt?: number | null;
  createdAt?: string | null;
}

export function useCetakKartu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const { settings } = useSchoolSettings();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cards, setCards] = useState<StudentCard[]>([]);
  const [cardsPerRow, setCardsPerRow] = useState("2");
  const [cardType, setCardType] = useState<"pelajar" | "nisn" | "kip">("pelajar");
  const [showPhoto, setShowPhoto] = useState(true);
  const [showNIS, setShowNIS] = useState(true);
  const [showBackSide, setShowBackSide] = useState(true);

  // Download single card as image
  const downloadCard = useCallback(async (studentId: string, studentName: string) => {
    const element = cardRefs.current.get(studentId);
    if (!element) return;
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(element, { quality: 1, pixelRatio: 3, backgroundColor: "#ffffff" });
      const link = document.createElement("a");
      link.download = `kartu-${cardType}-${studentName.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error downloading card:", error);
      toast.error("Gagal mengunduh kartu");
    }
  }, [cardType]);

  // Download all cards as ZIP
  const downloadAllCards = useCallback(async () => {
    setDownloading(true);
    try {
      const htmlToImage = await import("html-to-image");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const folder = zip.folder(`kartu-${cardType}`);
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const element = cardRefs.current.get(card.id);
        if (!element) continue;
        toast.info(`Memproses kartu ${i + 1}/${cards.length}...`);
        const dataUrl = await htmlToImage.toPng(element, { quality: 1, pixelRatio: 3, backgroundColor: "#ffffff" });
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
        const fileName = `kartu-${cardType}-${card.fullName.replace(/\s+/g, "-").toLowerCase()}.png`;
        folder?.file(fileName, base64Data, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `kartu-${cardType}-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${cards.length} kartu berhasil diunduh sebagai ZIP`);
    } catch (error) {
      console.error("Error downloading cards:", error);
      toast.error("Gagal mengunduh kartu");
    } finally {
      setDownloading(false);
    }
  }, [cards, cardType]);

  useEffect(() => {
    const fetchCards = async () => {
      const ids = searchParams.get("ids");
      if (!ids) {
        toast.error("Tidak ada siswa yang dipilih");
        router.push("/admin/siswa");
        return;
      }
      try {
        const response: any = await goPost("/api/master/students/print", { studentIds: ids.split(",") });
        if (response.success) setCards(response.data);
        else { showError(response.error || "Gagal memuat data"); router.push("/admin/siswa"); }
      } catch { showError("Terjadi kesalahan saat memproses data"); }
      finally { setLoading(false); }
    };
    fetchCards();
  }, [searchParams, router]);

  const handlePrint = () => window.print();

  const schoolName = settings?.school_name || "UPTD SDN 1 KENANGA";
  const schoolAddress = settings?.school_address || "Jl. Pendidikan No. 1";
  const schoolLogo = getSchoolLogo(settings?.school_logo);

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  return {
    loading, downloading, cards, cardsPerRow, setCardsPerRow, cardType, setCardType,
    showPhoto, setShowPhoto, showNIS, setShowNIS, showBackSide, setShowBackSide,
    schoolName, schoolAddress, schoolLogo, printRef, cardRefs,
    downloadCard, downloadAllCards, handlePrint, setCardRef, router,
  };
}