"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { goGet, goPost } from "@/lib/api-client";
import useSWR from "swr";
import Lenis from "lenis";
import type { Announcement } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const navItems = [
  { id: "hero", label: "Beranda" },
  { id: "visi-misi", label: "Profil" },
  { id: "kurikulum", label: "Program" },
  { id: "berita", label: "Berita" },
  { id: "layanan", label: "Layanan" },
  { id: "spmb", label: "SPMB" },
  { id: "kontak", label: "Kontak" },
];

export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 35, scale: 0.99 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } },
};

export const defaultTimeline = [
  { year: "1970", title: "Pendirian Sekolah", description: "SD Negeri 1 didirikan sebagai salah satu sekolah dasar pertama di wilayah ini dengan 6 ruang kelas dan 120 siswa." },
  { year: "1985", title: "Pengembangan Fasilitas", description: "Pembangunan gedung baru dengan tambahan 6 ruang kelas, perpustakaan, dan laboratorium IPA." },
  { year: "1998", title: "Akreditasi A", description: "Sekolah berhasil meraih akreditasi A dari Badan Akreditasi Nasional Sekolah/Madrasah (BAN-S/M)." },
  { year: "2010", title: "Sekolah Adiwiyata", description: "Penghargaan sebagai Sekolah Adiwiyata tingkat nasional atas komitmen terhadap lingkungan hidup." },
  { year: "2020", title: "Digitalisasi Pendidikan", description: "Implementasi pembelajaran digital dan sistem informasi sekolah terintegrasi." },
  { year: "2024", title: "Era Baru", description: "Peluncuran website sekolah terpadu dengan sistem SPMB online Jalur Domisili." },
];

export const defaultAchievements = [
  { value: "50+", label: "Prestasi Akademik" }, { value: "5000+", label: "Alumni" },
  { value: "54", label: "Tahun Berdiri" }, { value: "12", label: "Ekstrakurikuler" },
];

export const newsCategories = [
  { value: "all", label: "Semua" }, { value: "spmb", label: "SPMB" },
  { value: "prestasi", label: "Prestasi" }, { value: "kegiatan", label: "Kegiatan" }, { value: "pengumuman", label: "Pengumuman" },
];

const defaultLandingTexts = {
  profile_desc: "Membangun fondasi akademik dan budi pekerti yang luhur demi mempersiapkan murid menghadapi jenjang pendidikan berikutnya dengan penuh percaya diri.",
  program_desc: "Fokus pengembangan karakter pancasila, literasi dasar, serta wadah minat bakat melalui kegiatan ekskul yang terstruktur.",
  news_desc: "Ikuti perkembangan berita terbaru, pengumuman resmi, dan prestasi gemilang warga sekolah kami.",
  gallery_desc: "Rekaman visual berbagai kegiatan sekolah, fasilitas modern, serta kebersamaan hangat warga sekolah.",
  excellence_desc: "Kami merancang sekolah bukan sekadar ruang belajar biasa, melainkan rumah yang inovatif dan menyenangkan bagi minat anak Anda.",
  services_desc: "Kemudahan mengurus mutasi masuk/keluar siswa, melacak status permohonan, dan memantau saldo tabungan secara terpadu.",
  spmb_desc: "Proses pendaftaran seleksi dilakukan secara transparan, adil, dan terintegrasi sistem peta zonasi kelurahan secara real-time.",
  faq_desc: "Temukan jawaban singkat untuk pertanyaan umum yang sering diajukan mengenai SPMB dan aktivitas sekolah.",
  contact_desc: "Jika ada pertanyaan mengenai pendaftaran, sarana sekolah, atau informasi umum, kirimkan pesan kepada kami.",
};

const icons = {
  Sparkles: "Sparkles", BookOpen: "BookOpen", Star: "Star",
} as const;

export function useLanding() {
  const [mounted, setMounted] = useState(false);
  const [news, setNews] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [contactSettings, setContactSettings] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("hero");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const { settings } = useSchoolSettings();

  // Modals & Drawers
  const [selectedNews, setSelectedNews] = useState<Announcement | null>(null);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);

  // Search & Filter
  const [newsSearch, setNewsSearch] = useState("");
  const [newsFilter, setNewsFilter] = useState("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [activeGalleryCat, setActiveGalleryCat] = useState("all");

  // 1. Cek Saldo
  const [balanceNisn, setBalanceNisn] = useState("");
  const [balanceBirthDate, setBalanceBirthDate] = useState("");
  const [balanceCooldown, setBalanceCooldown] = useState(0);
  const [balanceResult, setBalanceResult] = useState<any>(null);

  // 2. Mutasi Masuk
  const [inName, setInName] = useState("");
  const [inNisn, setInNisn] = useState("");
  const [inGender, setInGender] = useState<"L" | "P">("L");
  const [inOriginSchool, setInOriginSchool] = useState("");
  const [inOriginAddress, setInOriginAddress] = useState("");
  const [inGrade, setInGrade] = useState("1");
  const [inParent, setInParent] = useState("");
  const [inWhatsapp, setInWhatsapp] = useState("");
  const [inLoading, setInLoading] = useState(false);
  const [inSuccessRegNum, setInSuccessRegNum] = useState<string | null>(null);

  // 3. Mutasi Keluar
  const [outNisn, setOutNisn] = useState("");
  const [outBirthDate, setOutBirthDate] = useState("");
  const [outValidateLoading, setOutValidateLoading] = useState(false);
  const [outStudentData, setOutStudentData] = useState<any>(null);
  const [outDestinationSchool, setOutDestinationSchool] = useState("");
  const [outReason, setOutReason] = useState<"domisili" | "tugas_orangtua" | "lainnya">("domisili");
  const [outReasonDetail, setOutReasonDetail] = useState("");
  const [outSubmitLoading, setOutSubmitLoading] = useState(false);
  const [outStep, setOutStep] = useState<"validate" | "form" | "success">("validate");

  // 4. Lacak Status
  const [trackRegNum, setTrackRegNum] = useState("");
  const [trackNisn, setTrackNisn] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);

  // SWR - Gallery & Staff
  const { data: galleryData, isLoading: isGalleryLoading } = useSWR(
    `/api/public/gallery?category=${activeGalleryCat}`, fetcher
  );
  const galleryItems = galleryData?.data || [];

  const { data: staffData, isLoading: isStaffLoading } = useSWR(
    "/api/public/staff", (url: string) => goGet<any>(url)
  );

  // --- Derived text from settings ---
  const schoolVisi = settings?.school_vision || "Terwujudnya peserta didik yang bertaqwa, cerdas, terampil, mandiri, berkebinekaan global, serta berwawasan lingkungan hidup.";

  const schoolMisi = useMemo(() => {
    if (!settings?.school_mission) return [
      "Menyelenggarakan proses belajar aktif dan menyenangkan berbasis nilai moral keagamaan.",
      "Mengembangkan literasi, numerasi, serta kemampuan sains dan teknologi sejak usia dini.",
      "Membentuk kebiasaan peduli dan cinta lingkungan hidup di sekolah.",
    ];
    try { return JSON.parse(settings.school_mission); }
    catch { return [settings.school_mission]; }
  }, [settings]);

  const schoolTimeline = useMemo(() => {
    if (!settings?.school_history_timeline) return defaultTimeline;
    try { return JSON.parse(settings.school_history_timeline); }
    catch { return defaultTimeline; }
  }, [settings]);

  const schoolAchievements = useMemo(() => {
    if (!settings?.school_history_achievements) return defaultAchievements;
    try { return JSON.parse(settings.school_history_achievements); }
    catch { return defaultAchievements; }
  }, [settings]);

  const schoolTagline = (settings?.landing_tagline !== undefined && settings?.landing_tagline !== null)
    ? settings.landing_tagline : "Cerdas · Berkarakter · Berdaya Saing";

  const schoolDescription = (settings?.landing_description !== undefined && settings?.landing_description !== null)
    ? settings.landing_description : "Membuka jalan masa depan gemilang bagi putra-putri Anda melalui pendidikan dasar yang aktif, suportif, berwawasan global, dan berbasis karakter moral yang kokoh.";

  const landingTexts = useMemo(() => {
    if (settings?.landing_texts === undefined || settings?.landing_texts === null) return defaultLandingTexts;
    try { return { ...defaultLandingTexts, ...JSON.parse(settings.landing_texts) }; }
    catch { return defaultLandingTexts; }
  }, [settings]);

  const landingSections = useMemo(() => {
    if (!settings?.landing_sections) return {};
    try { return JSON.parse(settings.landing_sections); }
    catch { return {}; }
  }, [settings]);

  // --- Handlers ---
  const handleScrollTo = useCallback((id: string) => {
    const scrollContainer = document.getElementById("public-scroll-container");
    const el = document.getElementById(id);
    if (scrollContainer && el) scrollContainer.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (balanceNisn.length < 10) { toast.error("NISN harus 10 digit"); return; }
    setBalanceLoading(true);
    setBalanceResult(null);
    try {
      const res = await goPost<any>("/api/tabungan/check-balance", { identifier: balanceNisn, birthDate: balanceBirthDate });
      if (res?.data) { setBalanceResult(res.data); toast.success("Data ditemukan"); }
    } catch (err: any) { toast.error(err.message || "Gagal mengecek saldo"); }
    finally { setBalanceLoading(false); }
  };

  const handleMutasiMasukSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inName || inNisn.length < 10 || !inOriginSchool || !inOriginAddress || !inParent || inWhatsapp.length < 10) {
      toast.error("Mohon lengkapi seluruh data dengan benar");
      return;
    }
    setInLoading(true);
    try {
      const res = await goPost<any>("/api/mutasi/request", {
        studentName: inName, nisn: inNisn, gender: inGender, originSchool: inOriginSchool,
        originSchoolAddress: inOriginAddress, targetGrade: parseInt(inGrade), parentName: inParent, whatsappNumber: inWhatsapp,
      });
      if (res?.success) { setInSuccessRegNum(res.registrationNumber); toast.success("Permohonan berhasil dikirim!"); }
    } catch (err: any) { toast.error(err.message || "Gagal mengirim permohonan"); }
    finally { setInLoading(false); }
  };

  const handleMutasiKeluarValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outNisn.length < 10 || !outBirthDate) { toast.error("NISN (10 digit) dan Tanggal Lahir wajib diisi"); return; }
    setOutValidateLoading(true);
    try {
      const res = await goPost<{ data: any }>("/api/mutasi-keluar/validate", { nisn: outNisn, birthDate: outBirthDate });
      if (res?.data) { setOutStudentData(res.data); setOutStep("form"); toast.success("Siswa ditemukan"); }
    } catch (err: any) { toast.error(err.message || "Validasi gagal"); }
    finally { setOutValidateLoading(false); }
  };

  const handleMutasiKeluarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outDestinationSchool) { toast.error("Sekolah tujuan wajib diisi"); return; }
    setOutSubmitLoading(true);
    try {
      await goPost<any>("/api/mutasi-keluar/request", {
        studentId: outStudentData.id, destinationSchool: outDestinationSchool, reason: outReason, reasonDetail: outReasonDetail,
      });
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const reasonText = outReason === "domisili" ? "Pindah Domisili" : outReason === "tugas_orangtua" ? "Mengikuti Tugas Orang Tua" : outReasonDetail || "Alasan Lainnya";
      doc.setFont("times", "normal");
      doc.setFontSize(12);
      const dateStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      doc.text(`Indramayu, ${dateStr}`, 140, 20);
      doc.text("Hal : Permohonan Pindah Sekolah", 20, 30);
      doc.text("Yth. Kepala Sekolah", 20, 40);
      doc.text(outStudentData.schoolName || (settings?.school_name || "UPTD SDN 1 Kenanga"), 20, 46);
      doc.text("di Tempat", 20, 52);
      doc.text("Dengan hormat,", 20, 65);
      doc.text("Saya yang bertanda tangan di bawah ini orang tua / wali murid dari:", 20, 72);
      const startY = 82;
      doc.text(`Nama`, 30, startY); doc.text(`: ${outStudentData.fullName}`, 80, startY);
      doc.text(`NISN`, 30, startY + 8); doc.text(`: ${outStudentData.nisn}`, 80, startY + 8);
      doc.text(`Kelas`, 30, startY + 16); doc.text(`: ${outStudentData.className}`, 80, startY + 16);
      doc.text("Mengajukan permohonan pindah sekolah untuk anak kami tersebut di atas ke:", 20, 110);
      doc.text(`Sekolah Tujuan`, 30, 120); doc.text(`: ${outDestinationSchool}`, 80, 120);
      doc.text(`Alasan`, 30, 128); doc.text(`: ${reasonText}`, 80, 128);
      doc.text("Demikian surat permohonan ini saya buat dengan penuh kesadaran dan tanpa paksaan.", 20, 145);
      doc.text("Atas perhatian Bapak/Ibu Kepala Sekolah, saya ucapkan terima kasih.", 20, 153);
      doc.text("Hormat saya,", 140, 175);
      doc.text(`( ${outStudentData.parentName || "Orang Tua / Wali"} )`, 130, 205);
      doc.save(`surat-permohonan-pindah-${outStudentData.nisn}.pdf`);
      setOutStep("success"); toast.success("Surat permohonan berhasil dibuat!");
    } catch (err: any) { toast.error(err.message || "Gagal membuat permohonan"); }
    finally { setOutSubmitLoading(false); }
  };

  const handleTrackMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRegNum || trackNisn.length < 10) { toast.error("Nomor registrasi dan NISN wajib diisi"); return; }
    setTrackLoading(true); setTrackResult(null);
    try {
      const res = await goGet<any>(`/api/mutasi/status/${trackRegNum}?nisn=${trackNisn}`);
      if (res?.success) { setTrackResult(res.data); toast.success("Status ditemukan"); }
      else toast.error("Data permohonan tidak ditemukan");
    } catch (err: any) { toast.error(err.message || "Data permohonan tidak ditemukan"); }
    finally { setTrackLoading(false); }
  };

  const filteredNews = news.filter(item => {
    const matchQ = item.title.toLowerCase().includes(newsSearch.toLowerCase()) || (item.excerpt || "").toLowerCase().includes(newsSearch.toLowerCase());
    const matchCat = newsFilter === "all" || item.category === newsFilter;
    return matchQ && matchCat;
  });

  const filteredFaqs = faqs.map((category: any) => ({
    ...category,
    questions: category.questions.filter((q: any) =>
      q.q.toLowerCase().includes(faqSearch.toLowerCase()) || q.a.toLowerCase().includes(faqSearch.toLowerCase())
    ),
  })).filter((cat: any) => cat.questions.length > 0);

  // Effects
  useEffect(() => {
    setMounted(true);
    const scrollContainer = document.getElementById("public-scroll-container");
    const lenis = new Lenis({
      ...(scrollContainer ? { wrapper: scrollContainer } : {}),
      duration: 1.4, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true,
    });
    let rfId: number;
    function raf(time: number) { lenis.raf(time); rfId = requestAnimationFrame(raf); }
    rfId = requestAnimationFrame(raf);

    const handleScrollTracking = () => {
      if (!scrollContainer) return;
      const scrollPos = scrollContainer.scrollTop + scrollContainer.clientHeight / 3;
      for (const item of navItems) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop; const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) { setActiveSection(item.id); break; }
        }
      }
    };
    if (scrollContainer) scrollContainer.addEventListener("scroll", handleScrollTracking);

    goGet<Announcement[]>("/api/public/news").then((res) => { if (res?.length > 0) setNews(res); }).catch(() => {});
    goGet("/api/public/faqs").then((json: any) => { if (json?.success && Array.isArray(json.data)) setFaqs(json.data); }).catch(() => {});
    goGet("/api/public/spmb/landing").then((json: any) => { if (json?.success) setContactSettings(json.settings || null); }).catch(() => {});

    return () => {
      lenis.destroy(); cancelAnimationFrame(rfId);
      if (scrollContainer) scrollContainer.removeEventListener("scroll", handleScrollTracking);
    };
  }, []);

  // Saldo autoclose cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (balanceResult) {
      setBalanceCooldown(30);
      timer = setInterval(() => {
        setBalanceCooldown((prev) => {
          if (prev <= 1) { setBalanceResult(null); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [balanceResult]);

  return {
    // Core
    mounted, settings, contactSettings, activeSection,
    // Data
    news, faqs, galleryItems, isGalleryLoading, staffData, isStaffLoading,
    // Texts
    schoolVisi, schoolMisi, schoolTagline, schoolDescription, schoolTimeline, schoolAchievements,
    landingTexts, landingSections,
    // News filter
    newsSearch, setNewsSearch, newsFilter, setNewsFilter, filteredNews,
    // FAQ filter
    faqSearch, setFaqSearch, filteredFaqs,
    // Gallery
    activeGalleryCat, setActiveGalleryCat,
    // Modals
    selectedNews, setSelectedNews, selectedImage, setSelectedImage,
    // Cek Saldo
    balanceNisn, setBalanceNisn, balanceBirthDate, setBalanceBirthDate,
    balanceLoading, balanceCooldown, balanceResult, handleCheckBalance,
    // Mutasi Masuk
    inName, setInName, inNisn, setInNisn, inGender, setInGender,
    inOriginSchool, setInOriginSchool, inOriginAddress, setInOriginAddress,
    inGrade, setInGrade, inParent, setInParent, inWhatsapp, setInWhatsapp,
    inLoading, inSuccessRegNum, handleMutasiMasukSubmit, setInSuccessRegNum,
    // Mutasi Keluar
    outNisn, setOutNisn, outBirthDate, setOutBirthDate,
    outValidateLoading, outStudentData, outDestinationSchool, setOutDestinationSchool,
    outReason, setOutReason, outReasonDetail, setOutReasonDetail,
    outSubmitLoading, outStep, setOutStep,
    handleMutasiKeluarValidate, handleMutasiKeluarSubmit,
    // Lacak Status
    trackRegNum, setTrackRegNum, trackNisn, setTrackNisn,
    trackLoading, trackResult, handleTrackMutation,
    // Actions
    handleScrollTo,
  };
}