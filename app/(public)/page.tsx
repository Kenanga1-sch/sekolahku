"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  BookOpen, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  Search,
  Newspaper,
  Megaphone,
  Award,
  Loader2,
  HelpCircle,
  GraduationCap,
  Camera,
  ZoomIn,
  X,
  Globe,
  Cpu,
  Palette,
  Footprints,
  Volleyball,
  Mic2,
  BookHeart,
  Trophy,
  History,
  RefreshCw,
  CreditCard,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Hash,
  User,
  School,
  Download,
  FileText,
  Building,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ContactForm } from "@/components/contact/contact-form";
import { goGet, goPost } from "@/lib/api-client";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import type { Announcement } from "@/types";
import { cn } from "@/lib/utils";
import useSWR from "swr";
import dynamic from "next/dynamic";
import Lenis from "lenis";
import Image from "next/image";

// Dynamically import the 3D Canvas with SSR disabled
const Demo3DCanvas = dynamic(() => import("@/components/landing/demo-3d-canvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-transparent">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  ),
});

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const navItems = [
  { id: "hero", label: "Beranda" },
  { id: "visi-misi", label: "Profil" },
  { id: "kurikulum", label: "Program" },
  { id: "berita", label: "Berita" },
  { id: "galeri", label: "Galeri" },
  { id: "keunggulan", label: "Keunggulan" },
  { id: "layanan", label: "Layanan" },
  { id: "spmb", label: "SPMB" },
  { id: "faq", label: "FAQ" },
  { id: "kontak", label: "Kontak" },
];

const newsCategories = [
  { value: "all", label: "Semua", icon: Newspaper },
  { value: "spmb", label: "SPMB", icon: Users },
  { value: "prestasi", label: "Prestasi", icon: Award },
  { value: "kegiatan", label: "Kegiatan", icon: Calendar },
  { value: "pengumuman", label: "Pengumuman", icon: Megaphone },
];

const galleryCategories = [
  { id: "all", label: "Semua" },
  { id: "kegiatan", label: "Kegiatan" },
  { id: "fasilitas", label: "Fasilitas" },
  { id: "prestasi", label: "Prestasi" },
  { id: "lainnya", label: "Lainnya" },
];

const subjects = [
  { name: "Bahasa Indonesia", icon: BookOpen },
  { name: "Matematika", icon: Cpu },
  { name: "IPA & IPS", icon: Globe },
  { name: "Pendidikan Agama", icon: BookHeart },
  { name: "PPKN", icon: Users },
  { name: "Bahasa Inggris", icon: Globe },
  { name: "Seni & Budaya", icon: Palette },
  { name: "PJOK", icon: Footprints },
];

const extraCurriculars = [
  { name: "Pramuka", description: "Karakter & Kepemimpinan", icon: Trophy, schedule: "Jumat, 14:00 - 16:00", category: "Wajib" },
  { name: "Futsal", description: "Kerjasama & Kebugaran", icon: Volleyball, schedule: "Selasa, 14:00 - 16:00", category: "Olahraga" },
  { name: "Seni Tari", description: "Tari Tradisional", icon: Palette, schedule: "Rabu, 14:00 - 16:00", category: "Kesenian" },
  { name: "Paduan Suara", description: "Olah Vokal & Musik", icon: Mic2, schedule: "Kamis, 14:00 - 16:00", category: "Kesenian" },
  { name: "Robotik", description: "Coding & Mekanik", icon: Cpu, schedule: "Senin, 14:00 - 16:00", category: "STEM" },
];

const defaultTimeline = [
  { year: "1970", title: "Pendirian Sekolah", description: "SD Negeri 1 didirikan sebagai salah satu sekolah dasar pertama di wilayah ini dengan 6 ruang kelas dan 120 siswa." },
  { year: "1985", title: "Pengembangan Fasilitas", description: "Pembangunan gedung baru dengan tambahan 6 ruang kelas, perpustakaan, dan laboratorium IPA." },
  { year: "1998", title: "Akreditasi A", description: "Sekolah berhasil meraih akreditasi A dari Badan Akreditasi Nasional Sekolah/Madrasah (BAN-S/M)." },
  { year: "2010", title: "Sekolah Adiwiyata", description: "Penghargaan sebagai Sekolah Adiwiyata tingkat nasional atas komitmen terhadap lingkungan hidup." },
  { year: "2020", title: "Digitalisasi Pendidikan", description: "Implementasi pembelajaran digital dan sistem informasi sekolah terintegrasi." },
  { year: "2024", title: "Era Baru", description: "Peluncuran website sekolah terpadu dengan sistem SPMB online Jalur Domisili." },
];

const defaultAchievements = [
  { value: "50+", label: "Prestasi Akademik", icon: Award },
  { value: "5000+", label: "Alumni", icon: Users },
  { value: "54", label: "Tahun Berdiri", icon: GraduationCap },
  { value: "12", label: "Ekstrakurikuler", icon: Trophy },
];

function getCategoryColor(category?: string) {
  return "bg-zinc-900/80 text-zinc-300 border border-zinc-800/80";
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [news, setNews] = useState<Announcement[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [contactSettings, setContactSettings] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("hero");

  // Fetch school settings context
  const { settings } = useSchoolSettings();

  // Modular text fields mapping (editable from Admin Page)
  const schoolVisi = settings?.school_vision || "Terwujudnya peserta didik yang bertaqwa, cerdas, terampil, mandiri, berkebinekaan global, serta berwawasan lingkungan hidup.";
  const schoolMisi = React.useMemo(() => {
    if (!settings?.school_mission) {
      return [
        "Menyelenggarakan proses belajar aktif dan menyenangkan berbasis nilai moral keagamaan.",
        "Mengembangkan literasi, numerasi, serta kemampuan sains dan teknologi sejak usia dini.",
        "Membentuk kebiasaan peduli dan cinta lingkungan hidup di sekolah."
      ];
    }
    try {
      return JSON.parse(settings.school_mission);
    } catch (e) {
      return [settings.school_mission];
    }
  }, [settings]);

  const schoolTimeline = React.useMemo(() => {
    if (!settings?.school_history_timeline) return defaultTimeline;
    try {
      return JSON.parse(settings.school_history_timeline);
    } catch (e) {
      return defaultTimeline;
    }
  }, [settings]);

  const schoolAchievements = React.useMemo(() => {
    if (!settings?.school_history_achievements) return defaultAchievements;
    try {
      const parsed = JSON.parse(settings.school_history_achievements);
      return parsed.map((item: any, idx: number) => {
        const icons = [Award, Users, GraduationCap, Trophy];
        return {
          ...item,
          icon: icons[idx % icons.length]
        };
      });
    } catch (e) {
      return defaultAchievements;
    }
  }, [settings]);

  const schoolSubjects = React.useMemo(() => {
    if (!settings?.school_curriculum) return subjects;
    try {
      const parsed = JSON.parse(settings.school_curriculum);
      return parsed.map((item: any, idx: number) => {
        const icons = [BookOpen, Cpu, Globe, BookHeart, Users, Globe, Palette, Footprints];
        return {
          name: item.name || item,
          icon: icons[idx % icons.length]
        };
      });
    } catch (e) {
      return subjects;
    }
  }, [settings]);

  const schoolEkskul = React.useMemo(() => {
    if (!settings?.school_extracurriculars) return extraCurriculars;
    try {
      const parsed = JSON.parse(settings.school_extracurriculars);
      return parsed.map((item: any, idx: number) => {
        const icons = [Trophy, Volleyball, Palette, Mic2, Cpu];
        return {
          ...item,
          icon: icons[idx % icons.length]
        };
      });
    } catch (e) {
      return extraCurriculars;
    }
  }, [settings]);

  const schoolTagline = (settings?.landing_tagline !== undefined && settings?.landing_tagline !== null)
    ? settings.landing_tagline
    : "Cerdas · Berkarakter · Berdaya Saing";

  const schoolDescription = (settings?.landing_description !== undefined && settings?.landing_description !== null)
    ? settings.landing_description
    : "Membuka jalan masa depan gemilang bagi putra-putri Anda melalui pendidikan dasar yang aktif, suportif, berwawasan global, dan berbasis karakter moral yang kokoh.";

  const landingTexts = React.useMemo(() => {
    const defaults = {
      profile_desc: "Membangun fondasi akademik dan budi keperti yang luhur demi mempersiapkan murid menghadapi jenjang pendidikan berikutnya dengan penuh percaya diri.",
      program_desc: "Fokus pengembangan karakter pancasila, literasi dasar, serta wadah minat bakat melalui kegiatan ekskul yang terstruktur.",
      news_desc: "Ikuti perkembangan berita terbaru, pengumuman resmi, dan prestasi gemilang warga sekolah kami.",
      gallery_desc: "Rekaman visual berbagai kegiatan sekolah, fasilitas modern, serta kebersamaan hangat warga sekolah.",
      excellence_desc: "Kami merancang sekolah bukan sekadar ruang belajar biasa, melainkan rumah yang inovatif dan menyenangkan bagi minat anak Anda.",
      services_desc: "Kemudahan mengurus mutasi masuk/keluar siswa, melacak status permohonan, dan memantau saldo tabungan secara terpadu.",
      spmb_desc: "Proses pendaftaran seleksi dilakukan secara transparan, adil, dan terintegrasi sistem peta zonasi kelurahan secara *real-time*.",
      faq_desc: "Temukan jawaban singkat untuk pertanyaan umum yang sering diajukan mengenai SPMB dan aktivitas sekolah.",
      contact_desc: "Jika ada pertanyaan mengenai pendaftaran, sarana sekolah, atau informasi umum, kirimkan pesan kepada kami."
    };
    if (settings?.landing_texts === undefined || settings?.landing_texts === null) return defaults;
    try {
      const parsed = JSON.parse(settings.landing_texts);
      return { ...defaults, ...parsed };
    } catch (e) {
      return defaults;
    }
  }, [settings]);

  const landingSections = React.useMemo(() => {
    if (!settings?.landing_sections) return {};
    try {
      return JSON.parse(settings.landing_sections);
    } catch (e) {
      return {};
    }
  }, [settings]);

  // Modals & Drawers States
  const [selectedNews, setSelectedNews] = useState<Announcement | null>(null);
  const [isAllNewsOpen, setIsAllNewsOpen] = useState(false);
  const [isAllGalleryOpen, setIsAllGalleryOpen] = useState(false);
  const [isAllFAQOpen, setIsAllFAQOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<any | null>(null);
  const [isCurriculumOpen, setIsCurriculumOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isStaffOpen, setIsStaffOpen] = useState(false);

  // Layanan States
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);
  const [isMutationOpen, setIsMutationOpen] = useState(false);
  const [mutationActiveTab, setMutationActiveTab] = useState<"masuk" | "keluar" | "lacak">("masuk");

  // Search & Filter States
  const [newsSearch, setNewsSearch] = useState("");
  const [newsFilter, setNewsFilter] = useState("all");
  const [activeGalleryCat, setActiveGalleryCat] = useState("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<"all" | "guru" | "staff" | "support">("all");

  // 1. Cek Saldo Form States
  const [balanceNisn, setBalanceNisn] = useState("");
  const [balanceBirthDate, setBalanceBirthDate] = useState("");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceResult, setBalanceResult] = useState<any>(null);
  const [balanceCooldown, setBalanceCooldown] = useState(0);

  // 2. Mutasi Masuk Form States
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

  // 3. Mutasi Keluar Form States
  const [outNisn, setOutNisn] = useState("");
  const [outBirthDate, setOutBirthDate] = useState("");
  const [outValidateLoading, setOutValidateLoading] = useState(false);
  const [outStudentData, setOutStudentData] = useState<any>(null);
  const [outDestinationSchool, setOutDestinationSchool] = useState("");
  const [outReason, setOutReason] = useState<"domisili" | "tugas_orangtua" | "lainnya">("domisili");
  const [outReasonDetail, setOutReasonDetail] = useState("");
  const [outSubmitLoading, setOutSubmitLoading] = useState(false);
  const [outStep, setOutStep] = useState<"validate" | "form" | "success">("validate");

  // 4. Lacak Status Mutasi Form States
  const [trackRegNum, setTrackRegNum] = useState("");
  const [trackNisn, setTrackNisn] = useState("");
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackResult, setTrackResult] = useState<any>(null);

  // Gallery Fetch via SWR
  const { data: galleryData, isLoading: isGalleryLoading } = useSWR(
    `/api/public/gallery?category=${activeGalleryCat}`,
    fetcher
  );
  const galleryItems = galleryData?.data || [];

  // Staff Fetch via SWR
  const { data: staffData, isLoading: isStaffLoading } = useSWR(
    "/api/public/staff",
    (url) => goGet<any>(url)
  );
  const allStaff = staffData?.data || [];
  const activeStaff = allStaff.filter((s: any) => s.isActive);
  const filteredStaff = activeStaff
    .sort((a: any, b: any) => {
      if (a.category === "kepsek") return -1;
      if (b.category === "kepsek") return 1;
      return 0;
    })
    .filter((s: any) => staffFilter === "all" || s.category === staffFilter);

  useEffect(() => {
    setMounted(true);
    const scrollContainer = document.getElementById("public-scroll-container");

    // Initialize Lenis Smooth Scroll
    const lenis = new Lenis({
      ...(scrollContainer ? { wrapper: scrollContainer } : {}),
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });

    let rfId: number;
    function raf(time: number) {
      lenis.raf(time);
      rfId = requestAnimationFrame(raf);
    }
    rfId = requestAnimationFrame(raf);

    // Active Section Tracking via Scroll Listener
    const handleScrollTracking = () => {
      if (!scrollContainer) return;
      const scrollPos = scrollContainer.scrollTop + scrollContainer.clientHeight / 3;

      for (const item of navItems) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScrollTracking);
    }

    // Fetch dynamic content
    goGet<Announcement[]>("/api/public/news")
      .then((res) => {
        if (res && res.length > 0) setNews(res);
      })
      .catch((e) => console.error("News fetch error:", e));

    goGet("/api/public/faqs")
      .then((json: any) => {
        if (json && json.success && Array.isArray(json.data)) setFaqs(json.data);
      })
      .catch((e) => console.error("FAQ fetch error:", e));

    goGet("/api/public/spmb/landing")
      .then((json: any) => {
        if (json && json.success) setContactSettings(json.settings || null);
      })
      .catch((e) => console.error("Contact fetch error:", e));

    return () => {
      lenis.destroy();
      cancelAnimationFrame(rfId);
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScrollTracking);
      }
    };
  }, []);

  // Cek Saldo Autoclose Cooldown
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (balanceResult) {
      setBalanceCooldown(30);
      timer = setInterval(() => {
        setBalanceCooldown((prev) => {
          if (prev <= 1) {
            setBalanceResult(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [balanceResult]);

  const handleScrollTo = (id: string) => {
    const scrollContainer = document.getElementById("public-scroll-container");
    const el = document.getElementById(id);
    if (scrollContainer && el) {
      scrollContainer.scrollTo({
        top: el.offsetTop,
        behavior: "smooth"
      });
    }
  };

  // Balance Check Submit
  const handleCheckBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (balanceNisn.length < 10) {
      toast.error("NISN harus 10 digit");
      return;
    }
    setBalanceLoading(true);
    setBalanceResult(null);
    try {
      const res = await goPost<any>("/api/tabungan/check-balance", {
        identifier: balanceNisn,
        birthDate: balanceBirthDate
      });
      if (res && res.data) {
        setBalanceResult(res.data);
        toast.success("Data ditemukan");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengecek saldo");
    } finally {
      setBalanceLoading(false);
    }
  };

  // Mutasi Masuk Submit
  const handleMutasiMasukSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inName || inNisn.length < 10 || !inOriginSchool || !inOriginAddress || !inParent || inWhatsapp.length < 10) {
      toast.error("Mohon lengkapi seluruh data dengan benar");
      return;
    }
    setInLoading(true);
    try {
      const res = await goPost<any>("/api/mutasi/request", {
        studentName: inName,
        nisn: inNisn,
        gender: inGender,
        originSchool: inOriginSchool,
        originSchoolAddress: inOriginAddress,
        targetGrade: parseInt(inGrade),
        parentName: inParent,
        whatsappNumber: inWhatsapp
      });
      if (res && res.success) {
        setInSuccessRegNum(res.registrationNumber);
        toast.success("Permohonan berhasil dikirim!");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim permohonan");
    } finally {
      setInLoading(false);
    }
  };

  // Mutasi Keluar Validate
  const handleMutasiKeluarValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (outNisn.length < 10 || !outBirthDate) {
      toast.error("NISN (10 digit) dan Tanggal Lahir wajib diisi");
      return;
    }
    setOutValidateLoading(true);
    try {
      const res = await goPost<{ data: any }>("/api/mutasi-keluar/validate", {
        nisn: outNisn,
        birthDate: outBirthDate
      });
      if (res && res.data) {
        setOutStudentData(res.data);
        setOutStep("form");
        toast.success("Siswa ditemukan");
      }
    } catch (err: any) {
      toast.error(err.message || "Validasi gagal");
    } finally {
      setOutValidateLoading(false);
    }
  };

  // Mutasi Keluar Submit + PDF Download
  const handleMutasiKeluarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outDestinationSchool) {
      toast.error("Sekolah tujuan wajib diisi");
      return;
    }
    setOutSubmitLoading(true);
    try {
      await goPost<any>("/api/mutasi-keluar/request", {
        studentId: outStudentData.id,
        destinationSchool: outDestinationSchool,
        reason: outReason,
        reasonDetail: outReasonDetail
      });
      
      // Generate PDF dynamically
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      const reasonText = 
        outReason === "domisili" ? "Pindah Domisili" :
        outReason === "tugas_orangtua" ? "Mengikuti Tugas Orang Tua" :
        outReasonDetail || "Alasan Lainnya";

      doc.setFont("times", "normal");
      doc.setFontSize(12);
      
      const dateStr = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
      doc.text(`Indramayu, ${dateStr}`, 140, 20);
      doc.text("Hal : Permohonan Pindah Sekolah", 20, 30);
      doc.text("Yth. Kepala Sekolah", 20, 40);
      doc.text(outStudentData.schoolName || (settings?.school_name || "UPTD SDN 1 Kenanga"), 20, 46);
      doc.text("di Tempat", 20, 52);

      doc.text("Dengan hormat,", 20, 65);
      doc.text("Saya yang bertanda tangan di bawah ini orang tua / wali murid dari:", 20, 72);

      const startY = 82;
      doc.text(`Nama`, 30, startY);
      doc.text(`: ${outStudentData.fullName}`, 80, startY);
      doc.text(`NISN`, 30, startY + 8);
      doc.text(`: ${outStudentData.nisn}`, 80, startY + 8);
      doc.text(`Kelas`, 30, startY + 16);
      doc.text(`: ${outStudentData.className}`, 80, startY + 16);

      doc.text("Mengajukan permohonan pindah sekolah untuk anak kami tersebut di atas ke:", 20, 110);
      doc.text(`Sekolah Tujuan`, 30, 120);
      doc.text(`: ${outDestinationSchool}`, 80, 120);
      doc.text(`Alasan`, 30, 128);
      doc.text(`: ${reasonText}`, 80, 128);

      doc.text("Demikian surat permohonan ini saya buat dengan penuh kesadaran dan tanpa paksaan.", 20, 145);
      doc.text("Atas perhatian Bapak/Ibu Kepala Sekolah, saya ucapkan terima kasih.", 20, 153);

      doc.text("Hormat saya,", 140, 175);
      doc.text(`( ${outStudentData.parentName || "Orang Tua / Wali"} )`, 130, 205);

      doc.save(`surat-permohonan-pindah-${outStudentData.nisn}.pdf`);

      setOutStep("success");
      toast.success("Surat permohonan berhasil dibuat!");
    } catch (err: any) {
      toast.error(err.message || "Gagal membuat permohonan");
    } finally {
      setOutSubmitLoading(false);
    }
  };

  // Lacak Status Mutasi Submit
  const handleTrackMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRegNum || trackNisn.length < 10) {
      toast.error("Nomor registrasi dan NISN wajib diisi");
      return;
    }
    setTrackLoading(true);
    setTrackResult(null);
    try {
      const res = await goGet<any>(`/api/mutasi/status/${trackRegNum}?nisn=${trackNisn}`);
      if (res && res.success) {
        setTrackResult(res.data);
        toast.success("Status ditemukan");
      } else {
        toast.error("Data permohonan tidak ditemukan");
      }
    } catch (err: any) {
      toast.error(err.message || "Data permohonan tidak ditemukan");
    } finally {
      setTrackLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 35, scale: 0.99 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
    },
  };

  if (!mounted) return null;

  // Filtered Lists for Drawers
  const filteredNews = news.filter(item => {
    const matchQ = item.title.toLowerCase().includes(newsSearch.toLowerCase()) || 
                   (item.excerpt || "").toLowerCase().includes(newsSearch.toLowerCase());
    const matchCat = newsFilter === "all" || item.category === newsFilter;
    return matchQ && matchCat;
  });

  const filteredFaqs = faqs.map(category => ({
    ...category,
    questions: category.questions.filter((q: any) => 
      q.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
      q.a.toLowerCase().includes(faqSearch.toLowerCase())
    )
  })).filter(cat => cat.questions.length > 0);

  const statusConfig: Record<string, { label: string; color: string; icon: any; desc: string }> = {
    pending: {
      label: "Menunggu Verifikasi",
      color: "bg-amber-900/30 text-amber-400 border-amber-850",
      icon: Clock,
      desc: "Permohonan Anda sedang dalam antrean untuk diperiksa oleh tim administrasi."
    },
    verified: {
      label: "Terverifikasi",
      color: "bg-blue-900/30 text-blue-400 border-blue-850",
      icon: CheckCircle2,
      desc: "Data telah diverifikasi. Menunggu persetujuan Kepala Sekolah."
    },
    approved: {
      label: "Disetujui",
      color: "bg-green-900/30 text-green-400 border-green-850",
      icon: CheckCircle2,
      desc: "Permohonan mutasi masuk disetujui. Surat Keterangan Diterima telah diterbitkan."
    },
    rejected: {
      label: "Ditolak",
      color: "bg-red-900/30 text-red-400 border-red-850",
      icon: XCircle,
      desc: "Permohonan ditolak karena kuota kelas penuh atau ketidakcocokan berkas."
    }
  };

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      
      {/* Floating Glassmorphic Sub-Navigation Bar */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 hidden xl:flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/80 shadow-2xl">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleScrollTo(item.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider transition-all duration-300 cursor-pointer select-none active:scale-95",
              activeSection === item.id
                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            )}
          >
            {item.id === "visi-misi" ? "Profil" : item.label}
          </button>
        ))}
      </div>

      {/* 3D Fixed Background Canvas */}
      <div className="fixed inset-0 w-full h-screen z-10 pointer-events-none opacity-90 md:opacity-100">
        <Demo3DCanvas />
      </div>

      {/* Grid background pattern */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:5rem_5rem] opacity-10 pointer-events-none z-0" />

      {/* Main Content (Interactive storytelling flow) */}
      <div className="relative z-20 w-full flex flex-col min-h-screen">
        
        {/* SECTION 1: HERO */}
        <section id="hero" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/40 border border-blue-900/30 text-xs font-semibold text-blue-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              Portal Informasi Sekolah Dasar
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1]">
              {settings?.school_name || "UPTD SDN 1 Kenanga"}
            </motion.h1>

            <motion.p variants={itemVariants} className="text-xl font-semibold text-zinc-400 tracking-wide uppercase">
              {schoolTagline}
            </motion.p>
            
            <motion.p variants={itemVariants} className="text-base sm:text-lg text-zinc-400 leading-relaxed">
              {schoolDescription}
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-4 pt-2">
              <Link href="/spmb/daftar">
                <Button size="lg" className="h-12 px-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] active:translate-y-[1px]">
                  Mulai Pendaftaran
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <button 
                onClick={() => handleScrollTo("visi-misi")}
                className="h-12 px-8 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-885 text-zinc-200 font-semibold active:scale-[0.98] active:translate-y-[1px] transition-all cursor-pointer"
              >
                Jelajahi Program
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 2: PROFIL & VISI MISI */}
        <section id="visi-misi" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Profil & Visi Misi</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.profile_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md text-zinc-100 rounded-2xl">
                <CardContent className="p-5 space-y-2">
                  <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-xs text-blue-400 font-bold">1</span>
                    Visi
                  </h3>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    {schoolVisi}
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md text-zinc-100 rounded-2xl">
                <CardContent className="p-5 space-y-2">
                  <h3 className="text-base font-bold text-blue-400 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-950 text-xs text-blue-400 font-bold">2</span>
                    Misi Utama
                  </h3>
                  <ul className="text-zinc-400 text-xs space-y-2 list-disc list-inside leading-relaxed">
                    {schoolMisi.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex gap-3 pt-2">
                <Button 
                  onClick={() => setIsHistoryOpen(true)}
                  variant="outline"
                  className="flex-1 h-11 rounded-full border-zinc-800 bg-zinc-900/20 text-zinc-200 hover:bg-zinc-900/60 font-bold transition-all active:scale-[0.98] active:translate-y-[1px]"
                >
                  <History className="h-4 w-4 mr-2" /> Sejarah Sekolah
                </Button>
                <Button 
                  onClick={() => setIsStaffOpen(true)}
                  className="flex-1 h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-[0.98] active:translate-y-[1px]"
                >
                  <Users className="h-4 w-4 mr-2" /> Guru & Staff
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 3: KURIKULUM & EKSKUL */}
        <section id="kurikulum" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Kurikulum & Ekstrakurikuler</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.program_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
                <BookOpen className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Kurikulum Merdeka</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Pembelajaran interaktif berbasis proyek untuk melatih anak berpikir kritis dan kolaboratif.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
                <Trophy className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Bakat & Minat Murid</h4>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Fasilitas pembinaan olahraga, sains (robotik), dan seni tari tradisional/paduan suara.
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setIsCurriculumOpen(true)}
                className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]"
              >
                Lihat Detail Kurikulum & Ekskul
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 4: BERITA & PENGUMUMAN */}
        <section id="berita" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Berita & Pengumuman</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.news_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              {news.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                  Belum ada kabar sekolah.
                </div>
              ) : (
                news.slice(0, 2).map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedNews(item)}
                    className="group flex flex-col rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 hover:bg-zinc-900/60 active:scale-[0.98] active:translate-y-[1px] transition-all duration-300 cursor-pointer backdrop-blur-md"
                  >
                    {item.thumbnail && (
                      <div className="h-44 w-full relative overflow-hidden bg-zinc-950 shrink-0">
                        <img 
                          src={item.thumbnail} 
                          alt={item.title} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103" 
                        />
                      </div>
                    )}
                    <div className="p-5 space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <Badge className={getCategoryColor(item.category)}>
                          {item.category}
                        </Badge>
                        <span className="text-zinc-500 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.published_at || 0).toLocaleDateString("id-ID")}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-zinc-100 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                        {item.excerpt || (item.content ? item.content.replace(/<[^>]*>/g, '') : '')}
                      </p>
                    </div>
                  </div>
                ))
              )}

              <Button 
                onClick={() => setIsAllNewsOpen(true)}
                variant="outline" 
                className="w-full h-11 rounded-full border-zinc-800 bg-zinc-900/20 text-zinc-200 hover:bg-zinc-900/60 font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]"
              >
                Lihat Semua Berita & Pengumuman
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 5: GALERI */}
        <section id="galeri" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/30 border border-emerald-900/30 text-xs font-semibold text-emerald-400">
                <Camera className="h-3.5 w-3.5" />
                Dokumentasi Kegiatan
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Galeri Dokumentasi</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.gallery_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              {isGalleryLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                </div>
              ) : galleryItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                  Belum ada dokumentasi foto.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {galleryItems.slice(0, 4).map((item: any) => (
                    <div 
                      key={item.id} 
                      onClick={() => setSelectedImage(item)}
                      className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-zinc-800/60 bg-zinc-900/50 active:scale-[0.98] active:translate-y-[1px] transition-all duration-300"
                    >
                      <Image 
                        src={item.imageUrl} 
                        alt={item.title} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                        <span className="text-[10px] font-medium text-white truncate w-full">{item.title}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                onClick={() => setIsAllGalleryOpen(true)}
                className="w-full h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]"
              >
                Buka Galeri Lengkap
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 6: KEUNGGULAN (BENTO) */}
        <section id="keunggulan" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {landingSections.fasilitas?.heading || "Fasilitas & Ekosistem Unggulan"}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingSections.fasilitas?.subheading || landingTexts.excellence_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              {landingSections.fasilitas?.items?.length > 0 ? (
                landingSections.fasilitas.items.map((item: any, idx: number) => {
                  const Icon = item.icon === "Sparkles" ? Sparkles : item.icon === "BookOpen" ? BookOpen : Star;
                  return (
                    <div key={idx} className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                      {item.image && (
                        <div className="h-36 w-full relative overflow-hidden">
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102" />
                        </div>
                      )}
                      <div className="p-5">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          <Icon className="h-4 w-4 text-amber-400" /> {item.title}
                        </h3>
                        <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                    <div className="h-36 w-full relative overflow-hidden">
                      <img src="/images/kurikulum_merdeka.png" alt="Kurikulum" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102" />
                    </div>
                    <div className="p-5">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-400" /> Kurikulum Merdeka Terpadu
                      </h3>
                      <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                        Pembelajaran yang berpusat pada murid, mendorong pemikiran kritis dan kreatif dengan bimbingan penuh kasih dari para guru.
                      </p>
                    </div>
                  </div>

                  <div className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 shadow-lg backdrop-blur-md">
                    <div className="h-36 w-full relative overflow-hidden">
                      <img src="/images/fasilitas_modern.png" alt="Fasilitas" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102" />
                    </div>
                    <div className="p-5">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-400" /> Fasilitas & Laboratorium Modern
                      </h3>
                      <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed">
                        Akses ke koleksi buku lengkap, ruang komputer modern, serta program sains dasar ramah anak untuk memuaskan rasa ingin tahu mereka.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 7: LAYANAN MANDIRI */}
        <section id="layanan" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {landingSections.layanan?.heading || "Layanan Administratif"}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingSections.layanan?.subheading || landingTexts.services_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border border-zinc-800/60 bg-zinc-900/40 shadow-md backdrop-blur-md hover:bg-zinc-900/60 transition-all duration-300 text-zinc-100 rounded-2xl active:scale-[0.98] active:translate-y-[1px]">
                <CardContent className="p-5 space-y-2 flex flex-col justify-between h-full">
                  <div>
                    <h4 className="font-bold text-sm text-white">Layanan Mutasi</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">Ajukan perpindahan sekolah murid masuk/keluar secara online, serta pantau status verifikasinya.</p>
                  </div>
                  <div className="flex flex-col gap-1.5 pt-2">
                    <button 
                      onClick={() => {
                        setMutationActiveTab("masuk");
                        setIsMutationOpen(true);
                      }}
                      className="inline-flex items-center text-xs text-blue-400 font-bold hover:underline cursor-pointer text-left"
                    >
                      Urus Mutasi <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </button>
                    <button 
                      onClick={() => {
                        setMutationActiveTab("lacak");
                        setIsMutationOpen(true);
                      }}
                      className="inline-flex items-center text-[10px] text-zinc-400 font-medium hover:text-white cursor-pointer text-left"
                    >
                      Lacak Status Permohonan <ChevronRight className="h-3 w-3 ml-0.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-zinc-800/60 bg-zinc-900/40 shadow-md backdrop-blur-md hover:bg-zinc-900/60 transition-all duration-300 text-zinc-100 rounded-2xl active:scale-[0.98] active:translate-y-[1px]">
                <CardContent className="p-5 space-y-2 flex flex-col justify-between h-full">
                  <div>
                    <h4 className="font-bold text-sm text-white">Cek Saldo Mandiri</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">Lacak riwayat uang jajan dan saldo tabungan brankas sekolah murid secara transparan untuk melatih hemat.</p>
                  </div>
                  <button 
                    onClick={() => setIsBalanceOpen(true)}
                    className="inline-flex items-center text-xs text-blue-400 font-bold hover:underline pt-2 cursor-pointer text-left"
                  >
                    Periksa Saldo <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 8: SPMB */}
        <section id="spmb" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/30 border border-blue-900/30 text-xs font-semibold text-blue-400">
                <Users className="h-3.5 w-3.5" />
                {landingSections.spmb?.heading || "Penerimaan Siswa Baru"}
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                {landingSections.spmb?.heading || "Penerimaan Siswa Baru (SPMB)"}
              </h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingSections.spmb?.subheading || landingTexts.spmb_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
              <Link href={landingSections.spmb?.button?.url || "/spmb/daftar"} className="flex-1">
                <Button size="lg" className="w-full h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] active:translate-y-[1px]">
                  {landingSections.spmb?.button?.label || "Pendaftaran Online"}
                </Button>
              </Link>
              <button 
                onClick={() => handleScrollTo("kontak")}
                className="flex-1 h-14 rounded-full border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-850 text-zinc-200 font-semibold active:scale-[0.98] active:translate-y-[1px] transition-all cursor-pointer"
              >
                Hubungi Panitia
              </button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 9: FAQ */}
        <section id="faq" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Tanya Jawab (FAQ)</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.faq_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              <Accordion type="single" collapsible className="space-y-2">
                <AccordionItem value="item-1" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">
                    Bagaimana alur Pendaftaran Siswa Baru (SPMB)?
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">
                    Lakukan pendaftaran di website, isi data diri & zonasi, upload berkas persyaratan (KK, Akta Lahir), pantau verifikasi panitia secara online di dashboard Anda.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">
                    Berapa umur minimal untuk mendaftar kelas 1 SD?
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">
                    Umur minimal adalah 6 tahun pada bulan Juli tahun berjalan, namun prioritas utama diberikan kepada anak usia 7 tahun ke atas sesuai juknis dinas pendidikan.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3" className="border border-zinc-800/60 bg-zinc-900/40 rounded-xl px-4">
                  <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">
                    Apakah ada biaya bulanan sekolah (SPP)?
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">
                    Tidak ada. Seluruh operasional di UPTD SDN 1 Kenanga dibiayai penuh oleh dana Bantuan Operasional Sekolah (BOS) sehingga gratis untuk seluruh murid.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Button 
                onClick={() => setIsAllFAQOpen(true)}
                className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-2 active:scale-[0.98] active:translate-y-[1px]"
              >
                Lihat Semua Tanya Jawab
              </Button>
            </motion.div>
          </motion.div>
        </section>

        {/* SECTION 10: KONTAK & MAPS */}
        <section id="kontak" className="min-h-screen flex flex-col justify-end pb-12 pt-28 sm:justify-center sm:py-24 px-4 sm:px-12 md:px-16 lg:px-20 relative border-t border-zinc-800/10">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-20%" }}
            variants={containerVariants}
            className="space-y-8 max-w-xl bg-zinc-950/70 sm:bg-zinc-950/85 backdrop-blur-2xl border border-zinc-800/60 p-5 sm:p-10 rounded-3xl shadow-2xl relative z-30 ml-0 sm:ml-6"
          >
            <motion.div variants={itemVariants} className="space-y-4">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Hubungi Kami</h2>
              <p className="text-zinc-400 leading-relaxed text-sm">
                {landingTexts.contact_desc}
              </p>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-6">
              <Card className="border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md rounded-2xl">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-zinc-300 leading-relaxed">
                      {contactSettings?.school_address || "Jl. Kenanga No. 1, Indramayu, Jawa Barat"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-zinc-300">
                      {contactSettings?.school_phone || "0812-3456-7890"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-zinc-300">
                      {contactSettings?.school_email || "sdn1kenanga@sch.id"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-xs text-zinc-300">
                      Senin - Jumat: 07:00 - 15:00 WIB
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* School Maps Location Iframe (Cosmic Dark Filtered) */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-950/40 relative">
                <iframe 
                  width="100%" 
                  height="100%" 
                  frameBorder="0" 
                  scrolling="no" 
                  marginHeight={0} 
                  marginWidth={0} 
                  src={`https://maps.google.com/maps?q=${contactSettings?.school_lat || -6.3273},${contactSettings?.school_lng || 108.3262}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  className="w-full h-full border-0 opacity-90 hover:opacity-100 transition-opacity duration-300"
                  allowFullScreen
                />
              </div>

              {/* Contact Message Form */}
              <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 backdrop-blur-md">
                <h4 className="font-bold text-sm mb-3 text-white">Kirim Pesan</h4>
                <ContactForm />
              </div>
            </motion.div>

            {/* Footer inside the final section */}
            <motion.div variants={itemVariants} className="border-t border-zinc-800/60 pt-6 text-center">
              <p className="text-[10px] text-zinc-500">
                &copy; {new Date().getFullYear()} {settings?.school_name || "UPTD SDN 1 Kenanga"}. All rights reserved. Built with Next.js & Three.js.
              </p>
            </motion.div>
          </motion.div>
        </section>

      </div>

      {/* ═══════════════════════════════════════
          INTERACTIVE MODALS & DRAWERS
          ═══════════════════════════════════════ */}

      {/* 1. CURRICULUM DETAIL DRAWER (SHEET) */}
      <Sheet open={isCurriculumOpen} onOpenChange={setIsCurriculumOpen}>
        <SheetContent side="left" className="w-full sm:max-w-2xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-2xl font-bold text-white flex items-center gap-2 text-left">
              <GraduationCap className="h-6 w-6 text-blue-400" /> Detail Program Sekolah
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-6 space-y-6 pr-1 no-scrollbar">
            <div>
              <h4 className="font-bold text-sm text-zinc-100 mb-2 border-b border-zinc-800/60 pb-1 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-400" /> Kurikulum Sekolah
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Kami menerapkan kurikulum terpadu yang berfokus pada pengembangan karakter, literasi, numerasi, dan kompetensi murid melalui pembelajaran aktif berbasis proyek.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {schoolSubjects.map((sub: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-900/5 border border-zinc-800/60 text-xs">
                    <sub.icon className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-zinc-300">{sub.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm text-zinc-100 mb-2 border-b border-zinc-800/60 pb-1 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-400" /> Kegiatan Ekstrakurikuler
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                Wadah penyaluran hobi, kebugaran fisik, kreativitas, dan pengembangan karakter kerja tim di luar jam pelajaran kelas.
              </p>
              <div className="space-y-2">
                {schoolEkskul.map((ekskul: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
                    <div className="flex items-center gap-3">
                      <ekskul.icon className="h-4 w-4 text-zinc-400" />
                      <div>
                        <span className="text-xs font-bold block text-white">{ekskul.name}</span>
                        <span className="text-[10px] text-zinc-500">{ekskul.description || ekskul.category}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-zinc-850 text-[9px] text-zinc-400 bg-zinc-950/40">
                      {ekskul.schedule || "Terjadwal"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 2. NEWS DETAIL DRAWER (SHEET) */}
      <Sheet open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          {selectedNews && (
            <>
              <SheetHeader className="pb-4 border-b border-zinc-800/60">
                <div className="flex justify-between items-center text-[10px] mb-2">
                  <Badge className={getCategoryColor(selectedNews.category)}>
                    {selectedNews.category}
                  </Badge>
                  <span className="text-zinc-500 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(selectedNews.published_at || 0).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                </div>
                <SheetTitle className="text-xl sm:text-2xl font-bold leading-snug text-white text-left">
                  {selectedNews.title}
                </SheetTitle>
              </SheetHeader>

              {/* News Body Image & Content */}
              <div className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1 no-scrollbar">
                {selectedNews.thumbnail && (
                  <div className="h-60 w-full relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950">
                    <img 
                      src={selectedNews.thumbnail} 
                      alt={selectedNews.title} 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                )}
                <div 
                  className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-4 font-normal"
                  dangerouslySetInnerHTML={{ __html: selectedNews.content || "" }}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* 3. ALL NEWS LIST DRAWER */}
      <Sheet open={isAllNewsOpen} onOpenChange={setIsAllNewsOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Newspaper className="h-5 w-5 text-blue-400" /> Kabar & Pengumuman Sekolah
            </SheetTitle>
          </SheetHeader>
          
          {/* Search & Category Filter */}
          <div className="py-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                placeholder="Cari kabar sekolah..." 
                className="pl-9 h-10 bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500 text-zinc-100" 
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
              />
            </div>
            
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {newsCategories.map((cat) => (
                <Button
                  key={cat.value}
                  variant={newsFilter === cat.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => newsFilter === cat.value ? setNewsFilter("all") : setNewsFilter(cat.value)}
                  className="rounded-full text-[10px] h-7 px-3 border-zinc-800 active:scale-95"
                >
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar">
            {filteredNews.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-500">
                Tidak ada kabar/pengumuman ditemukan.
              </div>
            ) : (
              filteredNews.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => {
                    setSelectedNews(item);
                  }}
                  className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/30 hover:bg-zinc-900/60 active:scale-[0.99] active:translate-y-[1px] cursor-pointer space-y-1.5 transition-all"
                >
                  <div className="flex justify-between items-center text-[9px]">
                    <Badge className={getCategoryColor(item.category)}>
                      {item.category}
                    </Badge>
                    <span className="text-zinc-500">
                      {new Date(item.published_at || 0).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs text-zinc-100 line-clamp-1">{item.title}</h4>
                  <p className="text-[10px] text-zinc-400 line-clamp-2 leading-relaxed">{item.excerpt}</p>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 4. ALL GALLERY LIST DRAWER */}
      <Sheet open={isAllGalleryOpen} onOpenChange={setIsAllGalleryOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-emerald-400" /> Galeri Dokumentasi Lengkap
            </SheetTitle>
          </SheetHeader>

          {/* Filter Categories */}
          <div className="py-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {galleryCategories.map((cat) => (
              <Button
                key={cat.id}
                variant={activeGalleryCat === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveGalleryCat(cat.id)}
                className="rounded-full text-[10px] h-7 px-3 border-zinc-800 active:scale-95"
              >
                {cat.label}
              </Button>
            ))}
          </div>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
            {isGalleryLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : galleryItems.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-500">
                Belum ada foto dalam kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pb-6">
                {galleryItems.map((item: any) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedImage(item)}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer border border-zinc-800/60 bg-zinc-900/50 active:scale-[0.98] active:translate-y-[1px] transition-all"
                  >
                    <Image 
                      src={item.imageUrl} 
                      alt={item.title} 
                      fill 
                      className="object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                      <span className="text-[10px] font-medium text-white truncate w-full">{item.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 5. IMAGE LIGHTBOX DIALOG */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black/95 border-none shadow-2xl text-white rounded-2xl">
          <DialogTitle className="sr-only">Detail Foto</DialogTitle>
          <div className="relative w-full h-[70vh] flex flex-col">
            <div className="relative flex-1 w-full bg-black/40">
              {selectedImage && (
                <Image
                  src={selectedImage.imageUrl}
                  alt={selectedImage.title}
                  fill
                  className="object-contain"
                />
              )}
            </div>
            {selectedImage && (
              <div className="p-4 bg-zinc-950/80 border-t border-zinc-900 flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-bold text-white leading-none">{selectedImage.title}</h4>
                  <span className="text-[9px] text-zinc-500 mt-1 block capitalize">{selectedImage.category}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setSelectedImage(null)}
                  className="h-8 w-8 p-0 rounded-full text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 6. ALL FAQ DRAWER */}
      <Sheet open={isAllFAQOpen} onOpenChange={setIsAllFAQOpen}>
        <SheetContent side="left" className="w-full sm:max-w-lg bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-400" /> Tanya Jawab Lengkap
            </SheetTitle>
          </SheetHeader>

          {/* Search Box */}
          <div className="py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input 
                placeholder="Cari pertanyaan umum..." 
                className="pl-9 h-10 bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500 text-zinc-100" 
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Accordion List Content */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
            {filteredFaqs.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-500">
                Tidak ada tanya jawab ditemukan.
              </div>
            ) : (
              filteredFaqs.map((category: any) => (
                <div key={category.id} className="space-y-2">
                  <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase border-b border-zinc-900 pb-1">
                    {category.title}
                  </h4>
                  <Accordion type="single" collapsible className="space-y-1.5">
                    {category.questions.map((faq: any, idx: number) => (
                      <AccordionItem 
                        key={idx} 
                        value={`${category.id}-${idx}`}
                        className="border border-zinc-900 bg-zinc-900/20 rounded-xl px-4"
                      >
                        <AccordionTrigger className="text-xs font-semibold hover:no-underline text-zinc-200 py-3 text-left">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-400 text-[11px] leading-relaxed pb-3">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 7. SEJARAH DRAWER (SHEET) */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <History className="h-5 w-5 text-blue-400" /> Sejarah & Perjalanan Sekolah
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-6 space-y-6 pr-1 no-scrollbar pb-6">
            {/* Stats Achievements */}
            <div className="grid grid-cols-2 gap-3">
              {schoolAchievements.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 text-center flex flex-col items-center justify-center space-y-1">
                  <div className="h-9 w-9 rounded-xl bg-blue-950/50 border border-blue-900/30 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-lg font-black text-white block pt-1">{item.value}</span>
                  <span className="text-[10px] text-zinc-400 font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase border-b border-zinc-900 pb-1">
                Linimasa Sejarah
              </h4>
              <div className="relative border-l border-zinc-800 pl-4 ml-2 space-y-6">
                {schoolTimeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-zinc-950" />
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-900/20">
                        {item.year}
                      </span>
                      <h5 className="text-xs font-bold text-white pt-1">{item.title}</h5>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 8. GURU & STAFF DRAWER (SHEET) */}
      <Sheet open={isStaffOpen} onOpenChange={setIsStaffOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <Users className="h-5 w-5 text-blue-400" /> Guru & Staff Pengajar
            </SheetTitle>
          </SheetHeader>

          {/* Filters */}
          <div className="py-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            {[
              { id: "all", label: "Semua" },
              { id: "guru", label: "Guru" },
              { id: "staff", label: "Staff & TU" },
              { id: "support", label: "Support" },
            ].map((item) => (
              <Button
                key={item.id}
                variant={staffFilter === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setStaffFilter(item.id as any)}
                className="rounded-full text-[10px] h-7 px-3 border-zinc-800 active:scale-95"
              >
                {item.label}
              </Button>
            ))}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 pb-6">
            {isStaffLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-500">
                Belum ada data staff untuk kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredStaff.map((staff: any) => (
                  <div key={staff.id} className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 flex flex-col">
                    <div className="aspect-[3/4] relative bg-zinc-950 overflow-hidden shrink-0">
                      <img 
                        src={staff.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.name}`}
                        alt={staff.name}
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-103 w-full h-full absolute inset-0"
                      />
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                      <div>
                        <h4 className="font-bold text-[11px] leading-tight text-white line-clamp-2">
                          {staff.name}{staff.degree ? `, ${staff.degree}` : ""}
                        </h4>
                        <span className="text-[9px] text-zinc-500 mt-0.5 block">{staff.position}</span>
                      </div>
                      {staff.quote && (
                        <p className="text-[9px] text-zinc-400 italic line-clamp-2 border-t border-zinc-900 pt-1.5 mt-1.5">
                          &quot;{staff.quote}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 9. CEK SALDO TABUNGAN DRAWER (SHEET) */}
      <Sheet open={isBalanceOpen} onOpenChange={setIsBalanceOpen}>
        <SheetContent side="left" className="w-full sm:max-w-md bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <CreditCard className="h-5 w-5 text-blue-400" /> Periksa Saldo Tabungan Siswa
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-6 pr-1 no-scrollbar pb-6">
            {balanceResult ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 text-center space-y-4">
                  <div className="mx-auto bg-blue-950/50 border border-blue-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Nama Siswa</span>
                    <h4 className="font-bold text-sm text-white">{balanceResult.name}</h4>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider">Kelas</span>
                    <p className="text-xs text-zinc-300 font-medium">{balanceResult.className}</p>
                  </div>
                  <div className="bg-zinc-950/80 py-4 rounded-xl border border-zinc-900">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono tracking-wider block mb-1">Total Saldo</span>
                    <p className="text-2xl font-black text-blue-400">
                      Rp {balanceResult.balance.toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[10px] text-center text-zinc-500">
                    Keterangan: Data per {new Date(balanceResult.lastUpdate).toLocaleString("id-ID")}. <br />
                    Layar akan tereset otomatis dalam {balanceCooldown} detik.
                  </p>
                  <Button 
                    onClick={() => {
                      setBalanceResult(null);
                      setBalanceCooldown(0);
                    }} 
                    className="w-full h-11 rounded-full bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 font-bold transition-all active:scale-[0.98]"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Cek Kartu Lain
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckBalance} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">NISN (10 digit)</label>
                  <Input 
                    placeholder="Masukkan Nomor Induk Siswa Nasional" 
                    value={balanceNisn}
                    onChange={(e) => setBalanceNisn(e.target.value)}
                    maxLength={10}
                    className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500 text-zinc-100"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Tanggal Lahir</label>
                  <Input 
                    type="date"
                    value={balanceBirthDate}
                    onChange={(e) => setBalanceBirthDate(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500 text-zinc-100"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-4 active:scale-[0.98]" disabled={balanceLoading}>
                  {balanceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                  Periksa Saldo
                </Button>
              </form>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* 10. ADMINISTRASI MUTASI DRAWER (SHEET) */}
      <Sheet open={isMutationOpen} onOpenChange={setIsMutationOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-2 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <Building className="h-5 w-5 text-blue-400" /> Layanan Administrasi Mutasi
            </SheetTitle>
          </SheetHeader>

          {/* Drawer Tabs */}
          <div className="py-3 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0 border-b border-zinc-900">
            {[
              { id: "masuk", label: "Mutasi Masuk" },
              { id: "keluar", label: "Mutasi Keluar" },
              { id: "lacak", label: "Lacak Status" },
            ].map((tab) => (
              <Button
                key={tab.id}
                variant={mutationActiveTab === tab.id ? "default" : "outline"}
                size="sm"
                onClick={() => setMutationActiveTab(tab.id as any)}
                className="rounded-full text-[10px] h-7 px-3 border-zinc-800 active:scale-95"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto mt-4 pr-1 no-scrollbar pb-6">
            
            {/* TAB 1: MUTASI MASUK */}
            {mutationActiveTab === "masuk" && (
              inSuccessRegNum ? (
                <div className="space-y-6 text-center">
                  <div className="bg-zinc-900/40 border border-zinc-800/60 p-6 rounded-2xl space-y-4">
                    <div className="mx-auto bg-green-950/50 border border-green-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-400" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Permohonan Terkirim</h4>
                      <p className="text-[11px] text-zinc-400">Silakan simpan nomor registrasi di bawah untuk melacak berkas:</p>
                    </div>
                    <div className="bg-zinc-950/80 py-3 rounded-xl border border-zinc-900 flex items-center justify-center gap-2">
                      <span className="text-2xl font-black text-blue-400 tracking-wider font-mono">{inSuccessRegNum}</span>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-zinc-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(inSuccessRegNum);
                          toast.success("Nomor registrasi disalin!");
                        }}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      setInSuccessRegNum(null);
                      setInName("");
                      setInNisn("");
                      setInOriginSchool("");
                      setInOriginAddress("");
                      setInParent("");
                      setInWhatsapp("");
                    }}
                    className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-[0.98]"
                  >
                    Buat Permohonan Baru
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleMutasiMasukSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-300">Nama Lengkap Siswa</label>
                    <Input 
                      placeholder="Masukkan nama sesuai akta lahir" 
                      value={inName}
                      onChange={(e) => setInName(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-300">NISN (10 digit)</label>
                      <Input 
                        placeholder="NISN" 
                        value={inNisn}
                        onChange={(e) => setInNisn(e.target.value)}
                        maxLength={10}
                        className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-300">Jenis Kelamin</label>
                      <Select value={inGender} onValueChange={(val: any) => setInGender(val)}>
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-850 text-white text-xs">
                          <SelectItem value="L">Laki-laki</SelectItem>
                          <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-300">Sekolah Asal</label>
                    <Input 
                      placeholder="Nama SD/MI asal" 
                      value={inOriginSchool}
                      onChange={(e) => setInOriginSchool(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-300">Alamat Lengkap Sekolah Asal</label>
                    <Input 
                      placeholder="Alamat sekolah asal" 
                      value={inOriginAddress}
                      onChange={(e) => setInOriginAddress(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-300">Tingkat Kelas Tujuan</label>
                      <Select value={inGrade} onValueChange={setInGrade}>
                        <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl">
                          <SelectValue placeholder="Pilih Kelas" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-900 border-zinc-850 text-white text-xs">
                          {["1", "2", "3", "4", "5", "6"].map((g) => (
                            <SelectItem key={g} value={g}>Kelas {g}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-300">Nama Orang Tua / Wali</label>
                      <Input 
                        placeholder="Nama wali murid" 
                        value={inParent}
                        onChange={(e) => setInParent(e.target.value)}
                        className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-300">Nomor WhatsApp Aktif</label>
                    <Input 
                      placeholder="Contoh: 081234567890" 
                      value={inWhatsapp}
                      onChange={(e) => setInWhatsapp(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-4 active:scale-[0.98]" disabled={inLoading}>
                    {inLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Kirim Permohonan Mutasi Masuk
                  </Button>
                </form>
              )
            )}

            {/* TAB 2: MUTASI KELUAR */}
            {mutationActiveTab === "keluar" && (
              outStep === "validate" && (
                <form onSubmit={handleMutasiKeluarValidate} className="space-y-4">
                  <div className="p-4 rounded-xl border border-blue-900/20 bg-blue-950/20 text-xs text-zinc-300 leading-relaxed">
                    Catatan: Fitur ini hanya berlaku untuk siswa aktif yang sudah terdaftar di pangkalan data {settings?.school_name || "UPTD SDN 1 Kenanga"}.
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">NISN Siswa (10 digit)</label>
                    <Input 
                      placeholder="Masukkan NISN siswa aktif" 
                      value={outNisn}
                      onChange={(e) => setOutNisn(e.target.value)}
                      maxLength={10}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">Tanggal Lahir Siswa</label>
                    <Input 
                      type="date"
                      value={outBirthDate}
                      onChange={(e) => setOutBirthDate(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-2 active:scale-[0.98]" disabled={outValidateLoading}>
                    {outValidateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Validasi Data Siswa
                  </Button>
                </form>
              )
            )}

            {mutationActiveTab === "keluar" && outStep === "form" && outStudentData && (
              <form onSubmit={handleMutasiKeluarSubmit} className="space-y-4">
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-2 text-xs">
                  <h5 className="font-bold text-white border-b border-zinc-800 pb-1 uppercase font-mono tracking-wide">Data Terverifikasi</h5>
                  <div><span className="text-zinc-500">Nama:</span> <strong className="text-zinc-300">{outStudentData.fullName}</strong></div>
                  <div><span className="text-zinc-500">Kelas:</span> <strong className="text-zinc-300">{outStudentData.className}</strong></div>
                  <div><span className="text-zinc-500">Wali:</span> <strong className="text-zinc-300">{outStudentData.parentName}</strong></div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Sekolah Tujuan</label>
                  <Input 
                    placeholder="Masukkan nama SD/MI sekolah tujuan" 
                    value={outDestinationSchool}
                    onChange={(e) => setOutDestinationSchool(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Alasan Pindah Sekolah</label>
                  <Select value={outReason} onValueChange={(val: any) => setOutReason(val)}>
                    <SelectTrigger className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl">
                      <SelectValue placeholder="Pilih Alasan" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-850 text-white text-xs">
                      <SelectItem value="domisili">Pindah Domisili</SelectItem>
                      <SelectItem value="tugas_orangtua">Mengikuti Tugas Orang Tua / Pekerjaan</SelectItem>
                      <SelectItem value="lainnya">Lainnya (Tulis detail di bawah)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300">Keterangan Tambahan / Alasan Detail</label>
                  <Input 
                    placeholder="Tulis alasan jika memilih Lainnya" 
                    value={outReasonDetail}
                    onChange={(e) => setOutReasonDetail(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                  />
                </div>

                <Button type="submit" className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all mt-4 active:scale-[0.98]" disabled={outSubmitLoading}>
                  {outSubmitLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Proses & Unduh Surat Permohonan
                </Button>
              </form>
            )}

            {mutationActiveTab === "keluar" && outStep === "success" && (
              <div className="space-y-6 text-center">
                <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl space-y-4">
                  <div className="mx-auto bg-green-950/50 border border-green-900/30 p-3 rounded-full w-14 h-14 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">Surat Permohonan Dibuat</h4>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Dokumen PDF permohonan mutasi keluar siswa telah berhasil diunduh ke perangkat Anda. <br />
                      Silakan serahkan cetakan surat bertanda tangan wali murid ke bagian Tata Usaha sekolah.
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    setOutStep("validate");
                    setOutNisn("");
                    setOutBirthDate("");
                    setOutStudentData(null);
                    setOutDestinationSchool("");
                    setOutReason("domisili");
                    setOutReasonDetail("");
                  }}
                  className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-[0.98]"
                >
                  Cek Data Siswa Lain
                </Button>
              </div>
            )}

            {/* TAB 3: LACAK STATUS MUTASI */}
            {mutationActiveTab === "lacak" && (
              <div className="space-y-6">
                <form onSubmit={handleTrackMutation} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">Nomor Registrasi Permohonan</label>
                    <Input 
                      placeholder="Contoh: MUT-2026-XXXXX" 
                      value={trackRegNum}
                      onChange={(e) => setTrackRegNum(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300">NISN Siswa (10 digit)</label>
                    <Input 
                      placeholder="Masukkan NISN siswa pendaftar" 
                      value={trackNisn}
                      onChange={(e) => setTrackNisn(e.target.value)}
                      maxLength={10}
                      className="bg-zinc-900/50 border-zinc-800 text-xs rounded-xl focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-11 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all active:scale-[0.98]" disabled={trackLoading}>
                    {trackLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Lacak Status Permohonan
                  </Button>
                </form>

                {trackResult && (
                  <div className="p-5 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 space-y-4">
                    <div className="flex justify-between items-center border-b border-zinc-850 pb-2.5">
                      <span className="text-[10px] font-mono text-zinc-500">{trackResult.registrationNumber}</span>
                      <Badge className={cn("text-[9px] font-bold py-0.5 px-2.5 rounded-full border", statusConfig[trackResult.statusApproval]?.color || "bg-zinc-800 text-zinc-400 border-zinc-700")}>
                        {statusConfig[trackResult.statusApproval]?.label || trackResult.statusApproval}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Nama Siswa</span>
                        <strong className="text-zinc-200">{trackResult.studentName}</strong>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Sekolah Asal</span>
                        <p className="text-zinc-300 leading-tight">{trackResult.originSchool}</p>
                      </div>
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Keterangan Tahap</span>
                        <p className="text-zinc-400 text-[10.5px] leading-relaxed pt-0.5">
                          {statusConfig[trackResult.statusApproval]?.desc || "Data sedang dikaji."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </SheetContent>
      </Sheet>

      {/* 11. SEJARAH DRAWER (SHEET) */}
      <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <History className="h-5 w-5 text-blue-400" /> Sejarah & Perjalanan Sekolah
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-6 space-y-6 pr-1 no-scrollbar pb-6">
            {/* Stats Achievements */}
            <div className="grid grid-cols-2 gap-3">
              {schoolAchievements.map((item: any, idx: number) => (
                <div key={idx} className="p-4 rounded-2xl border border-zinc-800/60 bg-zinc-900/40 text-center flex flex-col items-center justify-center space-y-1">
                  <div className="h-9 w-9 rounded-xl bg-blue-950/50 border border-blue-900/30 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-blue-400" />
                  </div>
                  <span className="text-lg font-black text-white block pt-1">{item.value}</span>
                  <span className="text-[10px] text-zinc-400 font-medium">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-blue-400 tracking-wider uppercase border-b border-zinc-900 pb-1">
                Linimasa Sejarah
              </h4>
              <div className="relative border-l border-zinc-800 pl-4 ml-2 space-y-6">
                {schoolTimeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-zinc-950" />
                    <div className="space-y-1">
                      <span className="font-mono text-[10px] font-black text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-900/20">
                        {item.year}
                      </span>
                      <h5 className="text-xs font-bold text-white pt-1">{item.title}</h5>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* 12. GURU & STAFF DRAWER (SHEET) */}
      <Sheet open={isStaffOpen} onOpenChange={setIsStaffOpen}>
        <SheetContent side="left" className="w-full sm:max-w-xl bg-zinc-950/95 border-r border-zinc-800/80 text-zinc-100 backdrop-blur-xl flex flex-col p-6 h-full">
          <SheetHeader className="pb-4 border-b border-zinc-800/60">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2 text-left">
              <Users className="h-5 w-5 text-blue-400" /> Guru & Staff Pengajar
            </SheetTitle>
          </SheetHeader>

          {/* Filters */}
          <div className="py-4 flex gap-1.5 overflow-x-auto pb-1 no-scrollbar shrink-0">
            {[
              { id: "all", label: "Semua" },
              { id: "guru", label: "Guru" },
              { id: "staff", label: "Staff & TU" },
              { id: "support", label: "Support" },
            ].map((item) => (
              <Button
                key={item.id}
                variant={staffFilter === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setStaffFilter(item.id as any)}
                className="rounded-full text-[10px] h-7 px-3 border-zinc-800 active:scale-95"
              >
                {item.label}
              </Button>
            ))}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 pb-6">
            {isStaffLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center py-20 text-xs text-zinc-500">
                Belum ada data staff untuk kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredStaff.map((staff: any) => (
                  <div key={staff.id} className="group relative rounded-2xl overflow-hidden border border-zinc-800/60 bg-zinc-900/40 flex flex-col">
                    <div className="aspect-[3/4] relative bg-zinc-950 overflow-hidden shrink-0">
                      <img 
                        src={staff.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.name}`}
                        alt={staff.name}
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-103 w-full h-full absolute inset-0"
                      />
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-1">
                      <div>
                        <h4 className="font-bold text-[11px] leading-tight text-white line-clamp-2">
                          {staff.name}{staff.degree ? `, ${staff.degree}` : ""}
                        </h4>
                        <span className="text-[9px] text-zinc-500 mt-0.5 block">{staff.position}</span>
                      </div>
                      {staff.quote && (
                        <p className="text-[9px] text-zinc-400 italic line-clamp-2 border-t border-zinc-900 pt-1.5 mt-1.5">
                          &quot;{staff.quote}&quot;
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
