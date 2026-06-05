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
import { goPost } from "@/lib/api-client";
import { showSuccess, showError } from "@/lib/toast";

interface StudentCard {
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
  const [cardType, setCardType] = useState<"pelajar" | "nisn" | "kip">("pelajar");
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
      link.download = `kartu-${cardType}-${studentName.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error downloading card:', error);
      toast.error('Gagal mengunduh kartu');
    }
  }, [cardType]);

  // Download all cards as ZIP
  const downloadAllCards = useCallback(async () => {
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`kartu-${cardType}`);
      
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
        const fileName = `kartu-${cardType}-${card.fullName.replace(/\s+/g, '-').toLowerCase()}.png`;
        folder?.file(fileName, base64Data, { base64: true });
      }
      
      // Generate and download ZIP
      const blob = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `kartu-${cardType}-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      toast.success(`${cards.length} kartu berhasil diunduh sebagai ZIP`);
    } catch (error) {
      console.error('Error downloading cards:', error);
      toast.error('Gagal mengunduh kartu');
    } finally {
      setDownloading(false);
    }
  }, [cards, cardType]);

  useEffect(() => {
    const fetchCards = async () => {
      const ids = searchParams.get("ids");
      if (!ids) {
        toast.error("Tidak ada siswa yang dipilih");
        router.push("/peserta-didik");
        return;
      }

      try {
        const response: any = await goPost("/api/master/students/print", {
          studentIds: ids.split(","),
        });

        if (response.success) {
          setCards(response.data);
        } else {
          showError(response.error || "Gagal memuat data");
          router.push("/peserta-didik");
        }
      } catch {
        showError("Terjadi kesalahan saat memproses data");
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
  const schoolLogo = settings?.school_logo 
    ? (settings.school_logo.startsWith("http") || settings.school_logo.startsWith("/") 
      ? settings.school_logo 
      : `/uploads/${settings.school_logo}`) 
    : "/logo.png";

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
            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Cetak Kartu Peserta Didik</h1>
            <p className="text-muted-foreground text-sm">
              {cards.length} data siswa siap dicetak
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={downloadAllCards} className="gap-2" disabled={downloading}>
              <FolderDown className="h-4 w-4" />
              {downloading ? 'Mengunduh...' : 'Unduh Semua (PNG)'}
            </Button>
            <Button onClick={handlePrint} className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-md">
              <Printer className="h-4 w-4" />
              Cetak / Simpan PDF
            </Button>
          </div>
        </div>
        
        {/* PDF Hint */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 text-sm text-blue-700 dark:text-blue-300 shadow-sm">
          <Download className="h-4 w-4 flex-shrink-0" />
          <span>
            <strong>Tips Cetak:</strong> Untuk menyimpan sebagai PDF, pilih opsi <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono text-xs">"Save as PDF"</code> atau <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/50 rounded font-mono text-xs">"Microsoft Print to PDF"</code> pada dialog cetak.
          </span>
        </div>

        {/* Settings */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
              <Settings2 className="h-5 w-5 text-violet-500" />
              Pengaturan Cetak
            </CardTitle>
            <CardDescription className="text-xs">
              Sesuaikan tipe kartu, tata letak, dan detail sebelum diunduh atau dicetak
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-5 items-end">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tipe Kartu</Label>
                <Select value={cardType} onValueChange={(v: any) => setCardType(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pelajar">Kartu Pelajar</SelectItem>
                    <SelectItem value="nisn">Kartu NISN</SelectItem>
                    <SelectItem value="kip">Kartu KIP (Kartu Indonesia Pintar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Kartu per Baris</Label>
                <Select value={cardsPerRow} onValueChange={setCardsPerRow}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Kartu</SelectItem>
                    <SelectItem value="2">2 Kartu</SelectItem>
                    <SelectItem value="3">3 Kartu</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 py-2">
                <Switch checked={showPhoto} onCheckedChange={setShowPhoto} id="showPhoto" />
                <Label htmlFor="showPhoto" className="cursor-pointer text-sm">Tampilkan Foto</Label>
              </div>

              {cardType === "pelajar" && (
                <div className="flex items-center gap-3 py-2">
                  <Switch checked={showNIS} onCheckedChange={setShowNIS} id="showNIS" />
                  <Label htmlFor="showNIS" className="cursor-pointer text-sm">Tampilkan NIS</Label>
                </div>
              )}

              <div className="flex items-center gap-3 py-2">
                <Switch checked={showBackSide} onCheckedChange={setShowBackSide} id="showBackSide" />
                <Label htmlFor="showBackSide" className="cursor-pointer text-sm">Tampilkan Sisi Belakang</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">Pratinjau Kartu</CardTitle>
            <CardDescription className="text-xs">
              {showBackSide ? 'Halaman depan & belakang (siap cetak bolak-balik / dilipat)' : 'Halaman depan kartu saja'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              {cards.map((student) => (
                <div key={student.id} className="space-y-2 border-b pb-6 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{student.fullName}</span>
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
                    className="inline-flex gap-1.5 bg-white p-2 rounded-xl border border-slate-150 shadow-sm"
                  >
                    {cardType === "pelajar" && (
                      <StudentCardPreview
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                        schoolLogo={schoolLogo}
                        showPhoto={showPhoto}
                        showNIS={showNIS}
                      />
                    )}
                    {cardType === "nisn" && (
                      <NISNCardPreview
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                        showPhoto={showPhoto}
                      />
                    )}
                    {cardType === "kip" && (
                      <KIPCardPreview
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                        showPhoto={showPhoto}
                      />
                    )}
                    {showBackSide && cardType === "pelajar" && (
                      <StudentCardBack
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                      />
                    )}
                    {showBackSide && cardType === "nisn" && (
                      <NISNCardBack
                        student={student}
                        schoolName={schoolName}
                        schoolAddress={schoolAddress}
                      />
                    )}
                    {showBackSide && cardType === "kip" && (
                      <KIPCardBack
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
          className="grid gap-6 p-4"
          style={{
            gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
          }}
        >
          {cards.map((student) => (
            <div key={student.id} className="flex gap-1.5 break-inside-avoid page-break-inside-avoid">
              {cardType === "pelajar" && (
                <StudentCardPreview
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  schoolLogo={schoolLogo}
                  showPhoto={showPhoto}
                  showNIS={showNIS}
                  forPrint
                />
              )}
              {cardType === "nisn" && (
                <NISNCardPreview
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  showPhoto={showPhoto}
                  forPrint
                />
              )}
              {cardType === "kip" && (
                <KIPCardPreview
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  showPhoto={showPhoto}
                  forPrint
                />
              )}
              {showBackSide && cardType === "pelajar" && (
                <StudentCardBack
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  forPrint
                />
              )}
              {showBackSide && cardType === "nisn" && (
                <NISNCardBack
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  forPrint
                />
              )}
              {showBackSide && cardType === "kip" && (
                <KIPCardBack
                  student={student}
                  schoolName={schoolName}
                  schoolAddress={schoolAddress}
                  forPrint
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ==========================================
// Kartu Pelajar - Front
// ==========================================

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
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #e2e8f0",
      }}
    >
      {/* Header - Navy Gold style */}
      <div 
        className="relative px-3 py-2 flex items-center gap-2.5 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        }}
      >
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
            <span className="text-xs font-bold text-slate-300">SD</span>
          )}
        </div>

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

      {/* Main Content */}
      <div className="flex flex-1" style={{ height: "calc(100% - 56px)" }}>
        <div className="flex-1 p-3 flex gap-3 relative overflow-hidden">
          <div 
            className="absolute inset-0 opacity-[0.02] pointer-events-none"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, #64748b 1px, transparent 0)`,
              backgroundSize: "16px 16px",
            }}
          />
          
          <div className="absolute -right-6 -bottom-6 opacity-[0.03] pointer-events-none">
            <span style={{ fontSize: "72px", fontWeight: 800, color: "#0f172a" }}>SD</span>
          </div>

          {showPhoto && (
            <div className="flex-shrink-0 relative">
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
                <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-l-2 border-t-2 border-amber-400 rounded-tl" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-r-2 border-t-2 border-amber-400 rounded-tr" />
                <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-l-2 border-b-2 border-amber-400 rounded-bl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-r-2 border-b-2 border-amber-400 rounded-br" />
                
                <div className="w-full h-full overflow-hidden rounded-sm bg-slate-50">
                  {student.photo ? (
                    <img
                      src={student.photo.startsWith('http') || student.photo.startsWith('/') ? student.photo : `/uploads/${student.photo}`}
                      alt={student.fullName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
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

          <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
            <div className="mb-2">
              <p className="uppercase tracking-widest font-semibold mb-0.5 text-[6px] text-slate-400">
                Nama Lengkap
              </p>
              <h3 
                className="font-bold leading-tight text-slate-800"
                style={{ 
                  fontSize: "13px", 
                  letterSpacing: "0.3px",
                  wordBreak: "break-word",
                  lineHeight: "1.2",
                }}
              >
                {student.fullName}
              </h3>
            </div>
            
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <div>
                <p className="uppercase tracking-widest font-semibold text-[6px] text-slate-400">NISN</p>
                <p className="font-mono font-semibold text-[9px] text-slate-700">{student.nisn || "-"}</p>
              </div>
              
              <div>
                <p className="uppercase tracking-widest font-semibold text-[6px] text-slate-400">Kelas</p>
                <p className="font-bold text-[10px] text-slate-700">{student.className || "-"}</p>
              </div>

              {showNIS && (
                <div>
                  <p className="uppercase tracking-widest font-semibold text-[6px] text-slate-400">NIS</p>
                  <p className="font-mono text-[9px] text-slate-700">{student.nis || "-"}</p>
                </div>
              )}

              <div>
                <p className="uppercase tracking-widest font-semibold text-[6px] text-slate-400">L / P</p>
                <p className="text-[9px] text-slate-700">
                  {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div 
          className="flex flex-col items-center justify-center relative"
          style={{
            width: "38%",
            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
            borderLeft: "1px solid #e2e8f0",
          }}
        >
          <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-slate-300" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-slate-300" />

          <div 
            className="bg-white p-2 rounded-lg border border-slate-200"
          >
            <QRCodeSVG 
              value={student.qrCode} 
              size={90} 
              level="H"
              includeMargin={false}
            />
          </div>
          
          <div className="mt-1 text-center">
            <p className="uppercase tracking-widest font-semibold text-[6px] text-slate-400">Pindai</p>
            <p 
              className="font-mono font-bold mt-0.5 px-2 py-0.5 rounded"
              style={{ 
                fontSize: "7px", 
                color: "#475569",
                background: "#e2e8f0",
              }}
            >
              {student.qrCode.slice(-8).toUpperCase()}
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
        <p className="font-semibold text-[7px] text-amber-950">
          Berlaku Tahun Ajaran {academicYear}
        </p>
        <p className="font-mono font-bold text-[7px] text-amber-950">
          ID: {student.id.slice(-6).toUpperCase()}
        </p>
      </div>
    </div>
  );
}

// ==========================================
// Kartu Pelajar - Back
// ==========================================

interface StudentCardBackProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  forPrint?: boolean;
}

function StudentCardBack({
  student,
  schoolName,
  schoolAddress,
  forPrint,
}: StudentCardBackProps) {
  const rules = [
    "Kartu ini adalah identitas resmi peserta didik UPTD SDN 1 Kenanga.",
    "Wajib dibawa saat berada di lingkungan sekolah.",
    "Jika hilang segera melapor ke pihak sekolah.",
    "Tidak boleh dipindahtangankan.",
  ];

  return (
    <div
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div 
        className="relative px-3 py-2 flex items-center justify-center overflow-hidden"
        style={{
          height: "28px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
        }}
      >
        <p className="text-white font-bold uppercase tracking-wider text-[8.5px]">
          {schoolName}
        </p>
      </div>

      <div className="flex" style={{ height: "calc(100% - 28px - 18px)" }}>
        <div className="flex-1 p-2.5 flex flex-col justify-center border-r border-slate-100">
          <p className="uppercase tracking-widest font-bold mb-1 text-[7px] text-slate-400">
            Ketentuan Penggunaan
          </p>
          <ul className="space-y-0.5">
            {rules.map((rule, idx) => (
              <li 
                key={idx} 
                className="flex items-start gap-1 text-[7.5px] text-slate-600 leading-snug"
              >
                <span className="text-amber-500 font-bold">•</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 pt-1 border-t border-dashed border-slate-100 text-[6.5px] text-slate-400">
            Harap kembalikan ke: {schoolAddress}
          </div>
        </div>

        <div 
          className="flex flex-col items-center justify-center px-4 bg-slate-50"
          style={{ width: "40%" }}
        >
          <div className="border border-slate-200 p-1.5 bg-white rounded-lg">
            <QRCodeSVG value={`VALID: ${student.fullName} (${student.nisn || student.nis})`} size={70} level="M" />
          </div>
          <span className="text-[6px] uppercase tracking-widest font-bold text-slate-400 mt-1">VERIFIED</span>
        </div>
      </div>

      <div 
        className="flex items-center justify-center text-white text-[7px]"
        style={{
          height: "18px",
          background: "linear-gradient(to right, #0f172a, #1e293b)",
        }}
      >
        <span>SDN 1 KENANGA - BERBUAT NYATA UNTUK BANGSA</span>
      </div>
    </div>
  );
}

// ==========================================
// Kartu NISN - Front
// ==========================================
interface NISNCardPreviewProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  showPhoto: boolean;
  forPrint?: boolean;
}

function NISNCardPreview({
  student,
  schoolName,
  schoolAddress,
  showPhoto,
  forPrint,
}: NISNCardPreviewProps) {
  const tutWuriBase64 = "data:image/svg+xml;base64," + btoa(
    `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" fill="#1b75bb" stroke="#ffffff" strokeWidth="2"/>
      <circle cx="50" cy="50" r="38" fill="#ffffff"/>
      <polygon points="50,22 76,42 66,74 34,74 24,42" fill="#1b75bb" stroke="#fbbf24" strokeWidth="1.5"/>
      <path d="M50,26 L64,46 L58,46 L50,34 L42,46 L36,46 Z" fill="#ffffff"/>
      <path d="M50,38 L62,56 L55,56 L50,47 L45,56 L38,56 Z" fill="#ffffff" opacity="0.9"/>
      <path d="M50,20 C52,28 48,32 50,38 C52,32 48,28 50,20" fill="#ef4444"/>
      <path d="M30,68 C40,64 50,68 50,68 C50,68 60,64 70,68 L70,74 C60,70 50,74 50,74 C50,74 40,70 30,74 Z" fill="#fbbf24"/>
      <path d="M50,68 L50,74" stroke="#ffffff" strokeWidth="1"/>
    </svg>`
  );

  return (
    <div
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #c0d8f0",
      }}
    >
      {/* Background Watermark & Gradients (100% matched swoops & crescent curves) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <svg viewBox="0 0 380 240" className="w-full h-full" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Base light blue gradient */}
          <rect width="380" height="240" fill="url(#bg-grad-nisn)"/>
          {/* Top left white crescent curve */}
          <path d="M-10,-10 C50,30 140,0 160,-20 L-20,-20 Z" fill="#ffffff" opacity="0.4"/>
          {/* Right side swooping curves */}
          <path d="M380,240 L240,240 C280,170 310,100 380,60 Z" fill="url(#swoop-grad-nisn)" opacity="0.6"/>
          {/* Watermark of Tut Wuri Handayani on the right */}
          <g opacity="0.045">
            <circle cx="270" cy="130" r="50" stroke="#1b75bb" strokeWidth="2.5"/>
            <polygon points="270,88 296,104 286,138 254,138 244,104" stroke="#1b75bb" strokeWidth="2"/>
            <path d="M270,110 L270,134" stroke="#1b75bb" strokeWidth="2"/>
            <circle cx="270" cy="102" r="5" fill="#1b75bb"/>
          </g>
          <defs>
            <linearGradient id="bg-grad-nisn" x1="0" y1="0" x2="380" y2="240" gradientUnits="userSpaceOnUse">
              <stop stopColor="#eef8ff"/>
              <stop offset="0.6" stopColor="#d0ebff"/>
              <stop offset="1.0" stopColor="#bce3fd"/>
            </linearGradient>
            <linearGradient id="swoop-grad-nisn" x1="240" y1="240" x2="380" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff"/>
              <stop offset="1.0" stopColor="#a5d8ff"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Header Container (White background, matches reference exactly) */}
      <div 
        className="relative z-10 px-3 py-1 flex items-center justify-between bg-white border-b-2 border-[#00a2e8] shadow-xs"
        style={{ height: "44px" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-[30px] h-[30px] flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#1b75bb" stroke="#ffffff" strokeWidth="2"/>
              <circle cx="50" cy="50" r="38" fill="#ffffff"/>
              <polygon points="50,22 76,42 66,74 34,74 24,42" fill="#1b75bb" stroke="#fbbf24" strokeWidth="1.5"/>
              <path d="M50,26 L64,46 L58,46 L50,34 L42,46 L36,46 Z" fill="#ffffff"/>
              <path d="M50,38 L62,56 L55,56 L50,47 L45,56 L38,56 Z" fill="#ffffff" opacity="0.9"/>
              <path d="M50,20 C52,28 48,32 50,38 C52,32 48,28 50,20" fill="#ef4444"/>
              <path d="M30,68 C40,64 50,68 50,68 C50,68 60,64 70,68 L70,74 C60,70 50,74 50,74 C50,74 40,70 30,74 Z" fill="#fbbf24"/>
              <path d="M50,68 L50,74" stroke="#ffffff" strokeWidth="1"/>
              <text x="50" y="85" fill="#1b75bb" fontSize="7" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">TUT WURI</text>
            </svg>
          </div>
          <div className="flex flex-col text-left justify-center">
            <div className="font-bold flex items-center leading-none tracking-tight text-[11px]">
              <span style={{ color: "#1b75bb" }}>Kemen</span>
              <span style={{ color: "#f58220" }}>dik</span>
              <span style={{ color: "#1b75bb" }}>dasmen</span>
            </div>
            <span className="text-[4px] leading-tight text-[#58595b] font-bold" style={{ marginTop: "1px" }}>
              Kementerian Pendidikan Dasar dan Menengah
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col justify-center">
          <h2 className="font-black text-[12.5px] leading-none tracking-wide text-[#1b75bb]">
            KARTU NISN
          </h2>
          <span className="text-[4.2px] font-bold text-[#58595b] tracking-wider mt-0.5 uppercase">
            Nomor Induk Siswa Nasional
          </span>
        </div>
      </div>

      {/* Main Body */}
      <div className="relative z-10 flex gap-3 px-3" style={{ height: "calc(100% - 44px - 34px)" }}>
        {showPhoto && (
          <div className="flex-shrink-0 relative mt-4">
            {/* NISN Shield Emblem */}
            <div className="absolute -top-3.5 left-[16px] z-20 flex flex-col items-center">
              <svg viewBox="0 0 100 100" className="w-[20px] h-[20px] drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10,20 L50,8 L90,20 C90,55 70,80 50,92 C30,80 10,55 10,20 Z" fill="#1b75bb" stroke="#fbbf24" strokeWidth="2.5"/>
                <circle cx="50" cy="40" r="20" fill="#bae6fd" stroke="#ffffff" strokeWidth="1"/>
                <path d="M30,40 L70,40 M50,20 A20,20 0 0,0 50,60 M50,20 A10,20 0 0,0 50,60 M50,20 A10,20 0 0,1 50,60" stroke="#ffffff" strokeWidth="0.8" fill="none"/>
                <path d="M22,62 Q50,56 78,62 L78,72 Q50,66 22,72 Z" fill="#f97316" stroke="#ffffff" strokeWidth="0.8"/>
                <path d="M50,58 L50,70" stroke="#ffffff" strokeWidth="1.2"/>
                <path d="M15,80 L85,80 L75,90 L25,90 Z" fill="#fbbf24" stroke="#ffffff" strokeWidth="0.8"/>
              </svg>
              <span className="font-extrabold text-[5px] text-[#1b75bb] leading-none tracking-wider bg-white/95 px-1 py-0.5 rounded shadow-xs mt-0.5" style={{ transform: "scale(0.85)" }}>
                NISN
              </span>
            </div>

            {/* Photo frame */}
            <div 
              style={{ 
                width: forPrint ? "17mm" : "64px", 
                height: forPrint ? "22mm" : "82px",
                padding: "2px",
                background: "white",
                borderRadius: "2px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
              className="mt-1"
            >
              <div className="w-full h-full overflow-hidden bg-[#d32f2f] relative">
                {student.photo ? (
                  <img
                    src={student.photo.startsWith('http') || student.photo.startsWith('/') ? student.photo : `/uploads/${student.photo}`}
                    alt={student.fullName}
                    className="w-full h-full object-cover relative z-10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex flex-col items-center justify-end pb-1 bg-[#d32f2f] ${student.photo ? 'hidden' : ''}`}>
                  <svg viewBox="0 0 100 100" className="w-[80%] h-[80%] fill-white/80 opacity-90">
                    <circle cx="50" cy="35" r="20" />
                    <path d="M15,85 C15,65 30,55 50,55 C70,55 85,65 85,85 Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Data Fields */}
        <div className="flex-1 flex flex-col justify-center text-slate-800 font-sans pl-1 mt-4">
          <div 
            className="grid gap-y-0.5 text-[#231f20]"
            style={{ 
              gridTemplateColumns: "max-content 4px auto",
              fontSize: forPrint ? "2.2mm" : "9.5px",
              lineHeight: "1.25",
            }}
          >
            <div className="font-semibold text-slate-700">NISN</div>
            <div className="text-slate-500">:</div>
            <div className="font-bold text-[#1b75bb] font-mono tracking-wide">{student.nisn || "-"}</div>

            <div className="font-semibold text-slate-700">Nama</div>
            <div className="text-slate-500">:</div>
            <div className="font-bold truncate max-w-[170px] uppercase text-[9px]">{student.fullName}</div>

            <div className="font-semibold text-slate-700">Tempat Lahir</div>
            <div className="text-slate-500">:</div>
            <div className="font-medium truncate max-w-[170px]">{student.birthPlace || "-"}</div>

            <div className="font-semibold text-slate-700">Tanggal Lahir</div>
            <div className="text-slate-500">:</div>
            <div className="font-medium">
              {student.birthDate ? new Date(student.birthDate).toLocaleDateString("id-ID", {day: "2-digit", month: "long", year: "numeric"}) : "-"}
            </div>

            <div className="font-semibold text-slate-700">Jenis Kelamin</div>
            <div className="text-slate-500">:</div>
            <div className="font-medium">
              {student.gender === "L" ? "Laki-laki" : student.gender === "P" ? "Perempuan" : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between z-10" style={{ height: "30px" }}>
        {/* DAPODIK Logo */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col text-left justify-center leading-none">
            <span className="font-black text-[9px] text-[#1b75bb] tracking-tight">DAPODIK</span>
            <span className="text-[3.8px] font-bold text-[#58595b] tracking-wider mt-0.5 uppercase">
              Data Pokok Pendidikan
            </span>
          </div>
          <div className="w-[14px] h-[14px] flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="15" fill="#1b75bb"/>
              <path d="M25,25 L75,25 L75,50 L50,50 L50,75 L25,75 Z" fill="#f58220"/>
              <rect x="38" y="38" width="24" height="24" fill="#ffffff"/>
            </svg>
          </div>
        </div>

        {/* QR Code */}
        <div className="bg-white p-0.5 rounded border border-[#1b75bb]/20 shadow-xs">
          <QRCodeSVG 
            value={student.nisn || student.qrCode} 
            size={forPrint ? 28 : 34} 
            level="H"
            includeMargin={false}
            imageSettings={{
              src: tutWuriBase64,
              x: undefined,
              y: undefined,
              height: forPrint ? 7 : 9,
              width: forPrint ? 7 : 9,
              excavate: true,
            }}
          />
        </div>
      </div>
    </div>
  );
}

interface NISNCardBackProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  forPrint?: boolean;
}

function NISNCardBack({
  student,
  schoolName,
  schoolAddress,
  forPrint,
}: NISNCardBackProps) {
  return (
    <div
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #c0d8f0",
      }}
    >
      {/* Background Watermark & Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 60%, #a5f3fc 100%)",
      }}>
        <svg viewBox="0 0 100 100" className="absolute right-0 bottom-0 w-[60%] h-[100%] opacity-30" preserveAspectRatio="none">
          <path d="M100,0 C70,40 50,80 100,100 Z" fill="#ffffff" />
        </svg>
        <svg viewBox="0 0 100 100" className="absolute left-[30%] top-[15%] w-[40%] h-[70%] opacity-[0.06]" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="48" stroke="#1b75bb" strokeWidth="2"/>
          <polygon points="50,18 80,42 68,78 32,78 20,42" fill="none" stroke="#1b75bb" strokeWidth="2"/>
          <circle cx="50" cy="40" r="8" fill="#1b75bb"/>
          <path d="M35,62 C35,50 65,50 65,62 L60,68 C60,60 40,60 40,68 Z" fill="#1b75bb"/>
          <path d="M50,48 L50,78" stroke="#1b75bb" strokeWidth="3"/>
        </svg>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full py-2.5 px-3 text-center">
        {/* Top Header */}
        <div className="flex flex-col items-center">
          <div className="w-[30px] h-[30px] mb-1">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#1b75bb" stroke="#ffffff" strokeWidth="2"/>
              <circle cx="50" cy="50" r="38" fill="#ffffff"/>
              <polygon points="50,22 76,42 66,74 34,74 24,42" fill="#1b75bb" stroke="#fbbf24" strokeWidth="1.5"/>
              <path d="M50,26 L64,46 L58,46 L50,34 L42,46 L36,46 Z" fill="#ffffff"/>
              <path d="M50,38 L62,56 L55,56 L50,47 L45,56 L38,56 Z" fill="#ffffff" opacity="0.9"/>
              <path d="M50,20 C52,28 48,32 50,38 C52,32 48,28 50,20" fill="#ef4444"/>
              <path d="M30,68 C40,64 50,68 50,68 C50,68 60,64 70,68 L70,74 C60,70 50,74 50,74 C50,74 40,70 30,74 Z" fill="#fbbf24"/>
              <path d="M50,68 L50,74" stroke="#ffffff" strokeWidth="1"/>
            </svg>
          </div>
          <div className="font-bold flex items-center leading-none tracking-tight text-[11px] mb-0.5 justify-center">
            <span style={{ color: "#1b75bb" }}>Kemen</span>
            <span style={{ color: "#f58220" }}>dik</span>
            <span style={{ color: "#1b75bb" }}>dasmen</span>
          </div>
          <span className="text-[4.5px] leading-none text-[#58595b] font-bold">
            Pusat Data dan Teknologi Informasi
          </span>
        </div>

        {/* Middle Stripe */}
        <div 
          className="w-full py-1.5 flex flex-col items-center justify-center my-1"
          style={{
            background: "linear-gradient(90deg, #4c5e5e 0%, #5e7070 50%, #4c5e5e 100%)",
            borderTop: "1px solid #708a8a",
            borderBottom: "1px solid #708a8a",
          }}
        >
          <h3 className="font-extrabold text-[12px] leading-none text-white tracking-widest">
            KARTU NISN
          </h3>
          <span className="text-[4.5px] font-bold text-[#e1e7e7] tracking-widest uppercase mt-0.5">
            NOMOR INDUK SISWA NASIONAL
          </span>
        </div>

        {/* Links and Credits */}
        <div className="flex flex-col items-center gap-0.5 text-[#231f20]">
          <span className="text-[4px] text-slate-500 font-bold leading-none">Link Resmi NISN :</span>
          <a href="https://nisn.data.kemdikbud.go.id" target="_blank" rel="noreferrer" className="text-[5.5px] text-[#1b75bb] font-bold underline leading-none mb-1">
            https://nisn.data.kemdikbud.go.id
          </a>
          <span className="text-[3.5px] text-slate-400 font-medium leading-none">didukung oleh :</span>
          <span className="text-[4.5px] text-slate-600 font-bold leading-none">www.mastiokdr.com</span>
        </div>

        {/* Bottom DAPODIK Logo */}
        <div className="flex flex-col items-center mt-1">
          <div className="flex items-center gap-1 justify-center leading-none">
            <span className="font-black text-[9px] text-[#1b75bb] tracking-tight">DAPODIK</span>
            <svg viewBox="0 0 100 100" className="w-[12px] h-[12px] flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="15" fill="#1b75bb"/>
              <path d="M25,25 L75,25 L75,50 L50,50 L50,75 L25,75 Z" fill="#f58220"/>
              <rect x="38" y="38" width="24" height="24" fill="#ffffff"/>
            </svg>
          </div>
          <span className="text-[4.5px] text-[#1b75bb] font-bold mt-0.5 font-mono">
            dapo.kemendikdasmen.go.id
          </span>
        </div>
      </div>
    </div>
  );
}

interface KIPCardPreviewProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  showPhoto: boolean;
  forPrint?: boolean;
}

function KIPCardPreview({
  student,
  schoolName,
  schoolAddress,
  showPhoto,
  forPrint,
}: KIPCardPreviewProps) {
  const releaseYear = student.enrolledAt 
    ? (student.enrolledAt > 3000 ? new Date(student.enrolledAt).getFullYear() : student.enrolledAt)
    : student.createdAt 
      ? new Date(student.createdAt).getFullYear() 
      : new Date().getFullYear();

  return (
    <div
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #1a082e", // Thin dark border around card
      }}
    >
      {/* Background Watermark (Detailed Indonesia Map vector) */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-white">
        <svg viewBox="0 0 400 150" className="absolute left-[5%] top-[25%] w-[90%] h-[60%] opacity-[0.07]" fill="#7c7c7c">
          <path d="M20,30 L60,60 L80,85 L70,95 L40,80 L10,45 Z" />
          <path d="M85,110 L150,115 L190,120 L190,125 L85,120 Z" />
          <path d="M110,50 L140,40 L160,55 L165,85 L145,95 L115,90 L105,75 Z" />
          <path d="M190,60 L215,60 L215,75 L200,75 L200,90 L220,95 L215,105 L185,100 L185,75 Z" />
          <path d="M310,75 L330,70 L360,75 L380,60 L390,75 L380,95 L340,105 L310,95 Z" />
          <circle cx="230" cy="65" r="4" />
          <circle cx="240" cy="80" r="3" />
          <circle cx="250" cy="95" r="3" />
          <path d="M200,123 L250,125 L280,125" stroke="#7c7c7c" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      {/* Header - Purple/Magenta Gradient */}
      <div 
        className="relative z-10 px-3 py-2 flex items-center justify-between"
        style={{
          background: "linear-gradient(90deg, #491a70 0%, #2d084d 100%)",
          height: "44px",
        }}
      >
        <div className="flex items-center gap-2">
          {/* Gold Garuda Logo (High Fidelity) */}
          <div className="w-[30px] h-[30px] flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M50,10 Q53,20 62,22 Q72,22 80,16 L76,28 Q84,33 86,45 L74,45 Q70,55 64,60 Q64,72 50,82 Q36,72 36,60 Q30,55 26,45 L14,45 Q16,33 24,28 L20,16 Q28,22 38,22 Q47,20 50,10 Z" fill="#d4af37"/>
              <polygon points="50,38 60,43 58,58 42,58 40,43" fill="#d4af37" stroke="#ffffff" strokeWidth="0.8"/>
            </svg>
          </div>
          <div className="flex flex-col text-left justify-center">
            <h2 
              className="font-bold tracking-wide text-white text-[13.5px] leading-none"
              style={{ textShadow: "0 0.5px 1px rgba(0,0,0,0.5)" }}
            >
              Kartu Indonesia Pintar
            </h2>
          </div>
        </div>

        {/* Graduation Cap Logo */}
        <div className="w-[32px] h-[32px] flex-shrink-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-[26px] h-[26px]" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,15 90,35 50,55 10,35" fill="#ffffff" stroke="#ffffff" strokeWidth="1"/>
            <path d="M25,43 L25,65 Q50,78 75,65 L75,43" fill="#ffffff" stroke="#ffffff" strokeWidth="1"/>
            <path d="M85,35 L85,60 C85,60 83,63 80,63 C77,63 75,60 75,60 L75,39" fill="#ffffff" stroke="#ffffff" strokeWidth="1"/>
          </svg>
        </div>
      </div>

      {/* Main Body */}
      <div className="relative z-10 flex px-3 pt-2.5 pb-2" style={{ height: "calc(100% - 44px)" }}>
        {/* Left Side: Data and Ketentuan */}
        <div className="flex-1 flex flex-col justify-between pr-2 text-slate-800">
          {/* Data Fields */}
          <div 
            className="grid gap-y-0.5 text-[#231f20] font-sans"
            style={{ 
              gridTemplateColumns: "max-content 4px auto",
              fontSize: forPrint ? "2.1mm" : "9.2px",
              lineHeight: "1.2",
            }}
          >
            <div className="font-semibold text-slate-600">Nomor KIP</div>
            <div className="text-slate-500">:</div>
            <div className="font-bold text-slate-900 font-mono tracking-wider">
              {student.kip || "KIP-" + (student.nisn || student.id.slice(-8).toUpperCase())}
            </div>

            <div className="font-semibold text-slate-600">Nama Siswa</div>
            <div className="text-slate-500">:</div>
            <div className="font-bold uppercase truncate max-w-[170px]">{student.fullName}</div>

            <div className="font-semibold text-slate-600">NISN</div>
            <div className="text-slate-500">:</div>
            <div className="font-semibold font-mono">{student.nisn || "-"}</div>

            <div className="font-semibold text-slate-600">NIK</div>
            <div className="text-slate-500">:</div>
            <div className="font-semibold font-mono">{student.nik || "-"}</div>

            <div className="font-semibold text-slate-600">Tahun Terbit</div>
            <div className="text-slate-500">:</div>
            <div className="font-semibold font-mono">{releaseYear}</div>
          </div>

          {/* Ketentuan box */}
          <div className="mt-1 flex flex-col justify-end">
            <span className="font-bold text-[5.2px] text-slate-500 uppercase leading-none">Ketentuan:</span>
            <ol className="list-decimal pl-2.5 text-[4.8px] leading-tight text-slate-600 font-medium mt-0.5 space-y-0.2">
              <li>Nama yang tercantum adalah penerima KIP sesuai hasil pemadanan Dapodik dengan DTSEN.</li>
              <li>Status berlaku KIP dapat diketahui dengan cara memindai QR Code.</li>
              <li>Penyalahgunaan KIP ini dapat dikenakan sanksi.</li>
            </ol>
            {/* Ministry Hotline / Laman */}
            <div className="mt-1.5 pt-1 border-t border-slate-100 flex flex-col text-[4.6px] leading-tight text-slate-500 font-semibold">
              <span className="uppercase text-[#2d084d] font-bold">Kementerian Pendidikan Dasar dan Menengah</span>
              <div className="flex gap-2.5 mt-0.2">
                <span>Hotline: 177</span>
                <span>Laman: pip.kemendikdasmen.go.id</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code and optional photo */}
        <div 
          className="flex flex-col items-center justify-end flex-shrink-0"
          style={{ width: "80px" }}
        >
          {/* QR Code Container */}
          <div className="bg-white p-1 rounded border border-purple-800/10 shadow-xs mb-2">
            <QRCodeSVG 
              value={student.kip || student.qrCode} 
              size={forPrint ? 42 : 48} 
              level="M"
              includeMargin={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface KIPCardBackProps {
  student: StudentCard;
  schoolName: string;
  schoolAddress: string;
  forPrint?: boolean;
}

function KIPCardBack({
  student,
  schoolName,
  schoolAddress,
  forPrint,
}: KIPCardBackProps) {
  return (
    <div
      className="student-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800"
      style={{
        width: forPrint ? "85.6mm" : "380px",
        height: forPrint ? "54mm" : "240px",
        borderRadius: forPrint ? "2mm" : "10px",
        border: "1px solid #1a082e",
      }}
    >
      {/* Background Watermark & Gradients */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{
        background: "linear-gradient(135deg, #fdf4ff 0%, #fae8ff 60%, #f3e8ff 100%)",
      }}>
        <svg viewBox="0 0 100 100" className="absolute right-0 bottom-0 w-[60%] h-[100%] opacity-20" preserveAspectRatio="none">
          <path d="M100,0 C70,40 50,80 100,100 Z" fill="#fdf4ff" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col justify-between h-full py-2.5 px-3 text-center">
        {/* Top Header */}
        <div className="flex flex-col items-center">
          <div className="w-[30px] h-[30px] mb-1">
            <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="46" fill="#4a1874" stroke="#ffffff" strokeWidth="2"/>
              <polygon points="50,18 80,42 68,78 32,78 20,42" fill="#ffffff" stroke="#d4af37" strokeWidth="1.5"/>
              <circle cx="50" cy="40" r="8" fill="#d4af37"/>
              <path d="M35,62 C35,50 65,50 65,62 L60,68 C60,60 40,60 40,68 Z" fill="#4a1874"/>
              <path d="M50,48 L50,78" stroke="#4a1874" strokeWidth="2"/>
            </svg>
          </div>
          <div className="font-bold flex items-center leading-none tracking-tight text-[11px] mb-0.5 justify-center">
            <span style={{ color: "#4a1874" }}>Kemen</span>
            <span style={{ color: "#d4af37" }}>dik</span>
            <span style={{ color: "#4a1874" }}>dasmen</span>
          </div>
          <span className="text-[4.5px] leading-none text-[#58595b] font-bold">
            Pusat Data dan Teknologi Informasi
          </span>
        </div>

        {/* Middle Stripe */}
        <div 
          className="w-full py-1.5 flex flex-col items-center justify-center my-1"
          style={{
            background: "linear-gradient(90deg, #2d084d 0%, #4a1874 50%, #2d084d 100%)",
            borderTop: "1px solid #c084fc",
            borderBottom: "1px solid #c084fc",
          }}
        >
          <h3 className="font-extrabold text-[12px] leading-none text-white tracking-widest">
            KARTU INDONESIA PINTAR
          </h3>
          <span className="text-[4.5px] font-bold text-[#f5d0fe] tracking-widest uppercase mt-0.5">
            PROGRAM INDONESIA PINTAR
          </span>
        </div>

        {/* Links and Credits */}
        <div className="flex flex-col items-center gap-0.5 text-[#231f20]">
          <span className="text-[4px] text-slate-500 font-bold leading-none">Laman Resmi KIP :</span>
          <a href="https://pip.kemdikbud.go.id" target="_blank" rel="noreferrer" className="text-[5.5px] text-[#4a1874] font-bold underline leading-none mb-1">
            https://pip.kemdikbud.go.id
          </a>
          <span className="text-[4px] text-slate-400 font-semibold leading-none">Hubungi Layanan Pengaduan:</span>
          <span className="text-[4.5px] text-slate-600 font-bold leading-none">Hotline: 177</span>
        </div>

        {/* Bottom DAPODIK Logo */}
        <div className="flex flex-col items-center mt-1">
          <div className="flex items-center gap-1 justify-center leading-none">
            <span className="font-black text-[9px] text-[#4a1874] tracking-tight">PIP</span>
            <svg viewBox="0 0 100 100" className="w-[12px] h-[12px] flex-shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="100" height="100" rx="15" fill="#4a1874"/>
              <path d="M30,30 L70,30 L70,50 L50,50 L50,70 L30,70 Z" fill="#d4af37"/>
              <rect x="42" y="42" width="16" height="16" fill="#ffffff"/>
            </svg>
          </div>
          <span className="text-[4.5px] text-[#4a1874] font-bold mt-0.5 font-mono">
            pip.kemendikdasmen.go.id
          </span>
        </div>
      </div>
    </div>
  );
}
