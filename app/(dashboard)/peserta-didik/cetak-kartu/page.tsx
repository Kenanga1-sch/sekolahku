"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Download, RefreshCw, Settings2, Image as ImageIcon, FolderDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as htmlToImage from "html-to-image";
import JSZip from "jszip";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";

interface StudentCard {
  id: string;
  fullName: string;
  nisn: string | null;
  nis: string | null;
  className: string | null;
  photo: string | null;
  qrCode: string;
  gender: "L" | "P" | null;
  birthPlace: string | null;
  birthDate: string | null;
}

export default function CetakKartuPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const printRef = useRef<HTMLDivElement>(null);
  const { settings } = useSchoolSettings();
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cards, setCards] = useState<StudentCard[]>([]);
  const [cardsPerRow, setCardsPerRow] = useState("2");
  const [showPhoto, setShowPhoto] = useState(true);
  const [showNIS, setShowNIS] = useState(true);
  const [showBackSide, setShowBackSide] = useState(true);

  // Download single card as image
  const downloadCard = useCallback(async (studentId: string, studentName: string) => {
    const element = cardRefs.current.get(studentId);
    if (!element) return;

    try {
      const dataUrl = await htmlToImage.toPng(element, {
        quality: 1,
        pixelRatio: 3, // High resolution
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.download = `kartu-${studentName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error downloading card:', error);
      toast.error('Gagal mengunduh kartu');
    }
  }, []);

  // Download all cards as ZIP
  const downloadAllCards = useCallback(async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("kartu-siswa");
      
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const element = cardRefs.current.get(card.id);
        if (!element) continue;
        
        toast.info(`Memproses kartu ${i + 1}/${cards.length}...`);
        
        const dataUrl = await htmlToImage.toPng(element, {
          quality: 1,
          pixelRatio: 3,
          backgroundColor: '#ffffff',
        });
        
        // Convert base64 to blob
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const fileName = `kartu-${card.fullName.replace(/\s+/g, '-').toLowerCase()}.png`;
        folder?.file(fileName, base64Data, { base64: true });
      }
      
      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `kartu-siswa-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      toast.success(`${cards.length} kartu berhasil diunduh sebagai ZIP`);
    } catch (error) {
      console.error('Error downloading cards:', error);
      toast.error('Gagal mengunduh kartu');
    } finally {
      setDownloading(false);
    }
  }, [cards]);

  useEffect(() => {
    const fetchCards = async () => {
      const ids = searchParams.get("ids");
      if (!ids) {
        toast.error("Tidak ada siswa yang dipilih");
        router.push("/peserta-didik");
        return;
      }

      try {
        const response = await fetch("/api/students/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: ids.split(",") }),
        });

        const data = await response.json();

        if (response.ok) {
          setCards(data.data);
        } else {
          toast.error(data.error || "Gagal memuat data");
          router.push("/peserta-didik");
        }
      } catch {
        toast.error("Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [searchParams, router]);

  const handlePrint = () => {
    window.print();
  };

  const schoolName = settings?.school_name || "UPTD SDN 1 KENANGA";
  const schoolAddress = settings?.school_address || "Jl. Pendidikan No. 1";
  const schoolLogo = settings?.school_logo ? `/uploads/${settings.school_logo}` : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      {/* Screen UI - Hidden when printing */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Cetak Kartu Peserta Didik</h1>
            <p className="text-muted-foreground">
              {cards.length} kartu siap dicetak
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadAllCards} className="gap-2" disabled={downloading}>
              <FolderDown className="h-4 w-4" />
              {downloading ? 'Mengunduh...' : 'Unduh Semua (PNG)'}
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Cetak / Simpan PDF
            </Button>
          </div>
        </div>
        
        {/* PDF Hint */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <Download className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Tips:</strong> Untuk menyimpan sebagai PDF, pilih <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs">"Save as PDF"</code> atau <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded text-xs">"Microsoft Print to PDF"</code> pada dialog cetak.
          </span>
        </div>

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Pengaturan Cetak
            </CardTitle>
            <CardDescription>
              Sesuaikan tampilan kartu sebelum mencetak
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="space-y-2">
                <Label>Kartu per Baris</Label>
                <Select value={cardsPerRow} onValueChange={setCardsPerRow}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Kartu</SelectItem>
                    <SelectItem value="2">2 Kartu</SelectItem>
                    <SelectItem value="3">3 Kartu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={showPhoto} onCheckedChange={setShowPhoto} id="showPhoto" />
                <Label htmlFor="showPhoto">Tampilkan Foto</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={showNIS} onCheckedChange={setShowNIS} id="showNIS" />
                <Label htmlFor="showNIS">Tampilkan NIS</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={showBackSide} onCheckedChange={setShowBackSide} id="showBackSide" />
                <Label htmlFor="showBackSide">Tampilkan Sisi Belakang</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview Kartu</CardTitle>
            <CardDescription>
              {showBackSide ? 'Kartu depan + belakang (untuk dilipat)' : 'Tampilan kartu sebelum dicetak'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {cards.map((student) => (
                <div key={student.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{student.fullName}</span>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1.5"
                      onClick={() => downloadCard(student.id, student.fullName)}
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      Unduh PNG
                    </Button>
                  </div>
                  <div 
                    ref={(el) => {
                      if (el) cardRefs.current.set(student.id, el);
                      else cardRefs.current.delete(student.id);
                    }}
                    className="inline-flex gap-0.5 bg-white p-1 rounded-lg border shadow-sm"
                  >
                    <StudentCardPreview
                      student={student}
                      schoolName={schoolName}
                      schoolAddress={schoolAddress}
                      schoolLogo={schoolLogo}
                      showPhoto={showPhoto}
                      showNIS={showNIS}
                    />
                    {showBackSide && (
                      <StudentCardBack
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print Layout - Only visible when printing */}
      <div className="hidden print:block" ref={printRef}>
        <style jsx global>{`
          @media print {
            @page {
              size: A4;
              margin: 8mm;
            }
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .student-card {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
        `}</style>
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
          }}
        >
          {cards.map((student) => (
            <StudentCardPreview
              key={student.id}
              student={student}
              schoolName={schoolName}
              schoolAddress={schoolAddress}
              schoolLogo={schoolLogo}
              showPhoto={showPhoto}
              showNIS={showNIS}
              forPrint
            />
          ))}
        </div>
      </div>
    </>
  );
}

interface StudentCardPreviewProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  schoolLogo: string | null;
  showPhoto: boolean;
  showNIS: boolean;
  forPrint?: boolean;
}

function StudentCardPreview({
  student,
  schoolName,
  schoolAddress,
  schoolLogo,
  showPhoto,
  showNIS,
  forPrint,
}: StudentCardPreviewProps) {
  const initials = student.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}/${currentYear + 1}`;

  return (
    <div
      className="student-card relative overflow-hidden bg-white"
      style={{
        aspectRatio: "85.6/54",
        width: forPrint ? "85.6mm" : "100%",
        minWidth: forPrint ? "85.6mm" : "320px",
        maxWidth: forPrint ? "85.6mm" : "420px",
        borderRadius: "10px",
        boxShadow: forPrint 
          ? "none" 
          : "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* Header - Dark Navy with Gold Accent */}
      <div 
        className="relative px-3 py-2 flex items-center gap-2.5 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        }}
      >
        {/* Decorative Gold Stripe */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-20"
          style={{ 
            background: "linear-gradient(to left, #fbbf24, #f59e0b)",
            clipPath: "polygon(30% 0%, 100% 0%, 100% 100%, 0% 100%)",
          }} 
        />
        <div 
          className="absolute right-16 top-0 bottom-0 w-1"
          style={{ background: "rgba(255,255,255,0.15)" }} 
        />

        {/* School Logo */}
        <div 
          className="relative h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{
            background: schoolLogo ? "white" : "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 100%)",
            border: "1.5px solid rgba(251,191,36,0.4)",
          }}
        >
          {schoolLogo ? (
            <img src={schoolLogo} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <span className="text-xl">🎓</span>
          )}
        </div>

        {/* School Identity */}
        <div className="relative flex-1 min-w-0 z-10">
          <h2 
            className="font-bold uppercase tracking-wider leading-tight"
            style={{ 
              fontSize: "10px",
              color: "#fbbf24",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            {schoolName}
          </h2>
          <p 
            className="leading-tight truncate mt-0.5"
            style={{ fontSize: "7px", color: "rgba(203,213,225,0.9)" }}
          >
            {schoolAddress}
          </p>
        </div>

        {/* Card Type Badge */}
        <div 
          className="relative z-10 px-2.5 py-1 rounded-md flex-shrink-0"
          style={{ 
            background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(251,191,36,0.3)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span 
            className="font-bold tracking-widest"
            style={{ fontSize: "7px", color: "#fbbf24" }}
          >
            KARTU PELAJAR
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1" style={{ height: "calc(100% - 56px)" }}>
        {/* Left Side: Photo & Personal Info */}
        <div className="flex-1 p-3 flex gap-3 relative overflow-hidden">
          {/* Subtle Pattern Background */}
          <div 
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #64748b 1px, transparent 0)`,
              backgroundSize: "16px 16px",
            }}
          />
          
          {/* Watermark */}
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none">
            <span style={{ fontSize: "100px" }}>🎓</span>
          </div>

          {/* Photo with Premium Frame */}
          {showPhoto && (
            <div className="flex-shrink-0 relative">
              {/* Photo Frame with Corner Accents */}
              <div 
                className="relative"
                style={{ 
                  width: "60px", 
                  height: "78px",
                  padding: "3px",
                  background: "linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)",
                  borderRadius: "4px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              >
                {/* Corner Accents */}
                <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-l-2 border-t-2 border-amber-400 rounded-tl" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-r-2 border-t-2 border-amber-400 rounded-tr" />
                <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-l-2 border-b-2 border-amber-400 rounded-bl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-r-2 border-b-2 border-amber-400 rounded-br" />
                
                <div className="w-full h-full overflow-hidden rounded-sm bg-slate-50">
                  {student.photo ? (
                    <img
                      src={student.photo}
                      alt={student.fullName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to initials on error
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${student.photo ? 'hidden' : ''}`}>
                    <span className="font-bold text-slate-400" style={{ fontSize: "18px" }}>
                      {initials}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Details */}
          <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
            {/* Name */}
            <div className="mb-2">
              <p 
                className="uppercase tracking-widest font-semibold mb-0.5"
                style={{ fontSize: "7px", color: "#64748b" }}
              >
                Nama Lengkap
              </p>
              <h3 
                className="font-bold leading-tight"
                style={{ 
                  fontSize: "14px", 
                  color: "#0f172a",
                  letterSpacing: "0.3px",
                  wordBreak: "break-word",
                  lineHeight: "1.2",
                }}
              >
                {student.fullName}
              </h3>
            </div>
            
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              <div>
                <p 
                  className="uppercase tracking-widest font-semibold"
                  style={{ fontSize: "7px", color: "#64748b" }}
                >
                  NISN
                </p>
                <p 
                  className="font-mono font-semibold"
                  style={{ fontSize: "9px", color: "#1e293b" }}
                >
                  {student.nisn || "—"}
                </p>
              </div>
              
              <div>
                <p 
                  className="uppercase tracking-widest font-semibold"
                  style={{ fontSize: "7px", color: "#64748b" }}
                >
                  Kelas
                </p>
                <p 
                  className="font-bold"
                  style={{ fontSize: "11px", color: "#1e293b" }}
                >
                  {student.className || "—"}
                </p>
              </div>

              {showNIS && (
                <div>
                  <p 
                    className="uppercase tracking-widest font-semibold"
                    style={{ fontSize: "6px", color: "#64748b" }}
                  >
                    NIS
                  </p>
                  <p 
                  className="font-mono"
                  style={{ fontSize: "11px", color: "#1e293b" }}
                >
                  {student.nis || "—"}
                </p>
                </div>
              )}

              <div>
                <p 
                  className="uppercase tracking-widest font-semibold"
                  style={{ fontSize: "6px", color: "#64748b" }}
                >
                  L / P
                </p>
                <p style={{ fontSize: "9px", color: "#1e293b" }}>
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code Section */}
        <div 
          className="flex flex-col items-center justify-center relative"
          style={{
            width: "38%",
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            borderLeft: "1px solid #e2e8f0",
          }}
        >
          {/* Decorative Corner Lines */}
          <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-slate-300" />
          <div className="absolute top-2 right-2 w-3 h-3 border-r border-t border-slate-300" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-l border-b border-slate-300" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-slate-300" />

          {/* QR Code Container */}
          <div 
            className="bg-white p-2 rounded-lg relative"
            style={{
              boxShadow: "0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <QRCodeSVG 
              value={student.qrCode} 
              size={95} 
              level="H"
              includeMargin={false}
            />
          </div>
          
          {/* Scan Label */}
          <div className="mt-2 text-center">
            <p 
              className="uppercase tracking-widest font-semibold"
              style={{ fontSize: "6px", color: "#94a3b8" }}
            >
              Pindai Kode
            </p>
            <p 
              className="font-mono font-bold mt-0.5 px-2 py-0.5 rounded"
              style={{ 
                fontSize: "7px", 
                color: "#475569",
                background: "#e2e8f0",
              }}
            >
              {student.qrCode.slice(-10).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Footer - Academic Year & Validity */}
      <div 
        className="flex items-center justify-between px-3"
        style={{
          height: "18px",
          background: "linear-gradient(to right, #fbbf24, #f59e0b)",
        }}
      >
        <p 
          className="font-semibold"
          style={{ fontSize: "7px", color: "#78350f" }}
        >
          Berlaku Tahun Ajaran {academicYear}
        </p>
        <p 
          className="font-mono font-bold"
          style={{ fontSize: "7px", color: "#78350f" }}
        >
          ID: {student.id.slice(-6).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// ==========================================
// Back Side of Student Card
// ==========================================

interface StudentCardBackProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
}

function StudentCardBack({
  student,
  schoolName,
  schoolAddress,
}: StudentCardBackProps) {
  const currentYear = new Date().getFullYear();
  const academicYear = `${currentYear}/${currentYear + 1}`;

  const rules = [
    "Kartu ini adalah identitas resmi peserta didik",
    "Wajib dibawa saat berada di lingkungan sekolah",
    "Jika hilang segera melapor ke pihak sekolah",
    "Tidak boleh dipindahtangankan",
  ];

  return (
    <div
      className="student-card relative overflow-hidden bg-white"
      style={{
        aspectRatio: "85.6/54",
        width: "100%",
        minWidth: "320px",
        maxWidth: "420px",
        borderRadius: "10px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.1)",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* Header */}
      <div 
        className="relative px-3 py-2 flex items-center justify-center overflow-hidden"
        style={{
          height: "28px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        }}
      >
        <p 
          className="text-white font-bold uppercase tracking-wider"
          style={{ fontSize: "9px" }}
        >
          {schoolName}
        </p>
      </div>

      {/* Content - Two columns */}
      <div 
        className="flex"
        style={{ height: "calc(100% - 28px - 18px)" }}
      >
        {/* Left Side: Rules */}
        <div 
          className="flex-1 p-2 flex flex-col justify-center"
          style={{ borderRight: "1px solid #e2e8f0" }}
        >
          <p 
            className="uppercase tracking-widest font-bold mb-1.5"
            style={{ fontSize: "8px", color: "#64748b" }}
          >
            Ketentuan Penggunaan
          </p>
          <ul className="space-y-1">
            {rules.map((rule, idx) => (
              <li 
                key={idx} 
                className="flex items-start gap-1"
                style={{ fontSize: "8px", color: "#475569" }}
              >
                <span className="text-amber-500 font-bold">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-1.5" style={{ borderTop: "1px dashed #e2e8f0" }}>
            <p style={{ fontSize: "7px", color: "#94a3b8" }}>
              Jika menemukan kartu ini, harap mengembalikan ke:
            </p>
            <p style={{ fontSize: "7px", color: "#64748b" }}>
              {schoolAddress}
            </p>
          </div>
        </div>

        {/* Right Side: Large QR Code */}
        <div 
          className="flex flex-col items-center justify-center px-4"
          style={{
            width: "45%",
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
          }}
        >
          {/* Decorative Corner Lines */}
          <div className="absolute top-2 right-2 w-3 h-3 border-r border-t border-slate-300" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-slate-300" />

          {/* QR Code Container */}
          <div 
            className="bg-white p-2.5 rounded-lg relative"
            style={{
              boxShadow: "0 2px 10px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.08)",
              border: "1px solid #e2e8f0",
            }}
          >
            <QRCodeSVG 
              value={student.qrCode} 
              size={100} 
              level="H"
              includeMargin={false}
            />
          </div>
          
          {/* Scan Label */}
          <div className="mt-1.5 text-center">
            <p 
              className="font-mono font-bold px-2 py-0.5 rounded"
              style={{ 
                fontSize: "8px", 
                color: "#475569",
                background: "#e2e8f0",
              }}
            >
              {student.qrCode.slice(-10).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div 
        className="flex items-center justify-between px-3"
        style={{
          height: "18px",
          background: "linear-gradient(to right, #fbbf24, #f59e0b)",
        }}
      >
        <p 
          className="font-semibold"
          style={{ fontSize: "7px", color: "#78350f" }}
        >
          Berlaku TA {academicYear}
        </p>
        <p 
          className="font-semibold"
          style={{ fontSize: "7px", color: "#78350f" }}
        >
          {student.fullName}
        </p>
      </div>
    </div>
  );
}
