"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, 
  Check, 
  ChevronsUpDown, 
  Users, 
  User, 
  FileText,
  ChevronRight,
  ArrowRight,
  X,
  Download,
} from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useSchoolSettings } from "@/lib/hooks/use-settings";
import { generateDocument, createDocumentBlob } from "@/lib/docx";
import { LETTER_TYPES } from "@/lib/constants/letter-types";

// Helper to extract manual variables {{...}} from content
const extractVariables = (content: string) => {
    if (!content) return [];
    const regex = /{{(.*?)}}/g;
    const matches = content.match(regex);
    if (!matches) return [];
    
    // Remove duplicates
    return [...new Set(matches.map(m => m.replace(/{{|}}/g, '')))];
};

export default function LetterGeneratorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTemplateId = searchParams.get("templateId");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Data
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Target
  const [targetType, setTargetType] = useState<"STUDENT" | "STAFF" | "MANUAL">("STUDENT");
  const [recipientMode, setRecipientMode] = useState<"SINGLE" | "MULTIPLE" | "CLASS">("SINGLE");
  
  // Student selection
  const [selectedStudents, setSelectedStudents] = useState<any[]>([]);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [isStudentSearchOpen, setIsStudentSearchOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");

  // Manual Inputs
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  // School Settings
  // School Settings
  const { settings: schoolSettings, refresh: refreshSettings } = useSchoolSettings();

  // Numbering State
  const [nextSequence, setNextSequence] = useState(0);
  const [selectedLetterType, setSelectedLetterType] = useState<any>(null);
  const [classificationCode, setClassificationCode] = useState<string | null>(null);

  // Load Templates
  useEffect(() => {
    fetch("/api/letters/templates?limit=100")
      .then(res => res.json())
      .then(data => {
        setTemplates(data.data);
        if (initialTemplateId) {
            const tpl = data.data.find((t: any) => t.id === initialTemplateId);
            if (tpl) handleSelectTemplate(tpl);
        }
      })
      .finally(() => setLoading(false));
  }, [initialTemplateId]);

  // Helper: Roman Numerals for Month
  const romanMonths = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

  // Logic: When Letter Type Changes
  useEffect(() => {
     if (selectedLetterType) {
         setClassificationCode(selectedLetterType.kode_klasifikasi);
         
         const date = new Date();
         const month = date.getMonth() + 1;
         const year = date.getFullYear();
         
         // Fetch next number for this code
         fetch("/api/letters/numbering", {
             method: "POST",
             body: JSON.stringify({ classificationCode: selectedLetterType.kode_klasifikasi, date: date.toISOString() })
         })
         .then(res => res.json())
         .then(res => {
             const seq = res.nextSequence || 1;
             setNextSequence(seq);
             
             let fmt = selectedLetterType.format_nomor;
             fmt = fmt.replace(/{kode_klasifikasi}/g, selectedLetterType.kode_klasifikasi);
             fmt = fmt.replace(/{nomor_urut}/g, String(seq).padStart(3, '0'));
             fmt = fmt.replace(/{bulan_romawi}/g, romanMonths[month]);
             fmt = fmt.replace(/{tahun}/g, String(year));
             
             setManualInputs(prev => ({
                 ...prev,
                 nomor_surat_otomatis: fmt
             }));
         })
         .catch(err => console.error("Failed to fetch number", err));

     } else if (schoolSettings && schoolSettings.last_letter_number !== undefined) {
          // Fallback to Global Settings Logic if No Type Selected (Legacy)
          const next = (schoolSettings.last_letter_number || 0) + 1;
          setNextSequence(next);
          setClassificationCode(null);
          
          if (schoolSettings.letter_number_format) {
              const date = new Date();
              const month = date.getMonth() + 1;
              const year = date.getFullYear();
              
              let fmt = schoolSettings.letter_number_format;
              fmt = fmt.replace(/{nomor}/g, String(next).padStart(3, '0')); 
              fmt = fmt.replace(/{bulan}/g, romanMonths[month]);
              fmt = fmt.replace(/{tahun}/g, String(year));
              
              setManualInputs(prev => {
                  if (!prev.nomor_surat_otomatis) return { ...prev, nomor_surat_otomatis: fmt };
                  return prev;
              });
          }
      }
  }, [schoolSettings, selectedLetterType, step]);

  // Load Students for Search
  const searchStudents = async (query: string) => {
      const res = await fetch(`/api/students/simple-search?q=${query}`);
      const data = await res.json();
      setStudentsList(data.data);
  };

  const fetchClassStudents = async (className: string) => {
      if (!className) return;
      setLoading(true);
      try {
          const res = await fetch(`/api/students/simple-search?className=${className}`);
          const data = await res.json();
          setSelectedStudents(data.data); // Replace selection with class
          toast.success(`Berhasil memuat ${data.data.length} siswa dari Kelas ${className}`);
      } catch (e) {
          toast.error("Gagal memuat data kelas");
      } finally {
          setLoading(false);
      }
  };

  const handleSelectTemplate = async (tpl: any) => {
      setLoading(true);
      try {
          const res = await fetch(`/api/letters/templates/${tpl.id}`);
          if (!res.ok) throw new Error("Failed to load template");
          const fullTpl = await res.json();
          
          setSelectedTemplate(fullTpl);
          if (fullTpl.category === 'STAFF') setTargetType('STAFF');
          else if (fullTpl.category === 'STUDENT') setTargetType('STUDENT');
          setStep(2);
      } catch (error) {
          console.error(error);
          toast.error("Gagal memuat detail template");
      } finally {
          setLoading(false);
      }
  };

  const handleSelectStudent = (id: string) => {
      const s = studentsList.find((x) => x.id === id);
      if (!s) return;

      if (recipientMode === 'SINGLE') {
          setSelectedStudents([s]);
          setIsStudentSearchOpen(false);
      } else {
          // Multiple: toggle
          setSelectedStudents(prev => {
              if (prev.find(x => x.id === id)) return prev.filter(x => x.id !== id);
              return [...prev, s];
          });
      }
  };

  const handleRemoveStudent = (id: string) => {
      setSelectedStudents(prev => prev.filter(x => x.id !== id));
  };
  
  const [generatedData, setGeneratedData] = useState<any>(null);

  const mergeStudentData = (data: any, student: any) => {
      data.siswa_nama = student.name || "";
      data.siswa_nis = student.nis || "-";
      data.siswa_nisn = student.nisn || "-";
      data.siswa_kelas = student.className || "";
      data.siswa_jenis_kelamin = student.gender === 'L' ? 'Laki-laki' : 'Perempuan';
      data.siswa_tempat_lahir = student.birthPlace || "";
      
      if (student.birthDate) {
          const birthDate = new Date(student.birthDate);
          if (!isNaN(birthDate.getTime())) {
              const formatted = format(birthDate, "d MMMM yyyy", { locale: id });
              data.siswa_tanggal_lahir = formatted;
              data.siswa_tanggal_lahir_indo = formatted;
          } else {
              data.siswa_tanggal_lahir = student.birthDate;
              data.siswa_tanggal_lahir_indo = student.birthDate;
          }
      } else {
          data.siswa_tanggal_lahir = "";
          data.siswa_tanggal_lahir_indo = "";
      }

      data.siswa_alamat = student.address || "";
      data.siswa_nama_wali = student.parentName || "";
      data.siswa_no_hp_wali = student.parentPhone || "";
  };

  const handleGeneratePreview = async () => {
      if (!selectedTemplate) return;

      if (targetType === 'STUDENT' && selectedStudents.length === 0) {
          toast.error("Mohon pilih minimal satu siswa.");
          return;
      }

      // Build Base Data
      const baseData: any = {};
      
      // School Variables
      if (schoolSettings) {
          baseData.sekolah_nama = schoolSettings.school_name || "";
          baseData.sekolah_npsn = schoolSettings.school_npsn || "";
          baseData.sekolah_alamat = schoolSettings.school_address || "";
          baseData.sekolah_kota = "Sungai Penuh"; 
          baseData.sekolah_telepon = schoolSettings.school_phone || "";
          baseData.sekolah_email = schoolSettings.school_email || "";
          baseData.sekolah_website = schoolSettings.school_website || "";
          baseData.kepala_sekolah_nama = schoolSettings.principal_name || ""; 
          baseData.kepala_sekolah_nip = schoolSettings.principal_nip || "";
      }

      // Manual Inputs
      Object.entries(manualInputs).forEach(([key, val]) => {
          baseData[key] = val;
      });

      // System Variables
      const today = format(new Date(), "d MMMM yyyy", { locale: id });
      baseData.tanggal_hari_ini = today;
      baseData.tanggal_surat = today;
      baseData.tahun_ajaran = schoolSettings?.current_academic_year || "2025/2026";

      // If student target, merge ONE student for preview
      if (targetType === 'STUDENT' && selectedStudents.length > 0) {
          mergeStudentData(baseData, selectedStudents[0]);
      }

      setGeneratedData(baseData);
      setStep(3);
  };

  const logLetterIncrement = async (letterNumber: string, recipient: string) => {
      await fetch("/api/letters/increment", {
          method: "POST",
          body: JSON.stringify({
              letterNumber,
              sequenceNumber: nextSequence,
              templateId: selectedTemplate?.id,
              recipient,
              classificationCode: classificationCode || undefined
          })
      });
      // Refresh global settings just in case, though independent
      refreshSettings();
  };

  const handleDownloadDocx = async () => {
      if (!selectedTemplate?.filePath || !generatedData) {
          toast.error("Data tidak lengkap.");
          return;
      }
      
      setLoading(true);
      try {
          if (targetType === 'STUDENT' && selectedStudents.length > 1) {
              const zip = new JSZip();
              const folder = zip.folder(`Surat_Batch_${format(new Date(), "yyyyMMdd_HHmm")}`);
              
              // We need to re-generate data for each student
              // Base data is current generatedData MINUS overwritten student props
              // But easiest is to rebuild or just overlay.
              // Note: generatedData ALREADY contains student[0] data. We must overwrite it clean.
              
              // Let's strip student keys? Or just overwriting is sufficient.
              // mergeStudentData overwrites all 'siswa_' keys. So it should be fine.
              
              let loggedOnce = false;

              for (const student of selectedStudents) {
                  const studentData = { ...generatedData }; // Start with preview data
                  mergeStudentData(studentData, student); // Overwrite with current student
                  
                  const blob = await createDocumentBlob(selectedTemplate.filePath, studentData);
                  if (folder) folder.file(`${student.name.replace(/[^a-zA-Z0-9]/g, "_")}.docx`, blob);
              }
              
              const zipBlob = await zip.generateAsync({ type: "blob" });
              saveAs(zipBlob, `Surat_Batch.zip`);
              
              // Log ONE increment for the batch (as discussed)
              if (generatedData.nomor_surat_otomatis && nextSequence > 0) {
                  await logLetterIncrement(
                      generatedData.nomor_surat_otomatis, 
                      `Batch (${selectedStudents.length} Siswa) - ${selectedStudents[0].className || "Mix"}`
                  );
                  refreshSettings();
              }
              
              toast.success(`Berhasil mengunduh ${selectedStudents.length} surat dalam ZIP.`);

          } else {
             // Single Download
             const fileName = `Surat-${generatedData.siswa_nama || "Output"}.docx`;
             await generateDocument(selectedTemplate.filePath, generatedData, fileName);
             
             if (generatedData.nomor_surat_otomatis && nextSequence > 0) {
                  await logLetterIncrement(generatedData.nomor_surat_otomatis, generatedData.siswa_nama || "Siswa");
                  refreshSettings();
             }
             toast.success("Dokumen berhasil diunduh.");
          }
      } catch (error) {
          console.error(error);
          toast.error("Gagal generate dokumen.");
      } finally {
          setLoading(false);
      }
  };

  // Variable extraction logic
  let templateVars: string[] = [];
  if (selectedTemplate?.type === "UPLOAD" && selectedTemplate?.content) {
      try {
          templateVars = JSON.parse(selectedTemplate.content);
          if (!Array.isArray(templateVars)) templateVars = [];
      } catch (e) {
          console.error("Failed to parse variables", e);
          templateVars = [];
      }
  } else if (selectedTemplate?.content) {
      templateVars = extractVariables(selectedTemplate.content);
  }
  
  const manualVars = templateVars.filter(v => 
      !v.startsWith("siswa_") && 
      !v.startsWith("guru_") && 
      !v.startsWith("orangtua_") &&
      !['tanggal_hari_ini', 'tahun_ajaran', 'kepala_sekolah_nama', 'kepala_sekolah_nip'].includes(v)
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
       <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
           <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Buat Surat Baru</h1>
           <p className="text-muted-foreground">Generator surat otomatis dari template.</p>
        </div>
       </div>

       {/* Stepper */}
       <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground border-b pb-4">
          <div className={cn("flex items-center gap-2", step >= 1 && "text-blue-600")}>
             <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">1</div>
             Pilih Template
          </div>
          <ChevronRight className="h-4 w-4" />
          <div className={cn("flex items-center gap-2", step >= 2 && "text-blue-600")}>
             <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">2</div>
             Isi Data
          </div>
          <ChevronRight className="h-4 w-4" />
          <div className={cn("flex items-center gap-2", step >= 3 && "text-blue-600")}>
             <div className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">3</div>
             Preview & Cetak
          </div>
       </div>

       {/* Step 1: Template Selection */}
       {step === 1 && (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? <div className="col-span-3 text-center py-8">Memuat template...</div> : 
             templates.map((tpl) => (
               <Card 
                  key={tpl.id} 
                  className="cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => handleSelectTemplate(tpl)}
               >
                  <CardHeader>
                     <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center mb-2">
                        <FileText className="h-5 w-5 text-zinc-500" />
                     </div>
                     <CardTitle className=" text-base">{tpl.name}</CardTitle>
                     <CardDescription>{tpl.category}</CardDescription>
                  </CardHeader>
               </Card>
             ))
            }
         </div>
       )}

       {/* Step 2: Data Input */}
       {step === 2 && selectedTemplate && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="md:col-span-2 space-y-6">
                 {/* Classification Selection */}
                 <Card>
                    <CardHeader>
                       <CardTitle>Klasifikasi Surat</CardTitle>
                       <CardDescription>Pilih jenis surat untuk penomoran otomatis sesuai standar.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="space-y-2">
                          <Label>Jenis Surat</Label>
                          <Popover>
                             <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                   {selectedLetterType ? selectedLetterType.jenis_surat : "Pilih jenis surat..."}
                                   <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                             </PopoverTrigger>
                             <PopoverContent className="w-[400px] p-0">
                                <Command>
                                   <CommandInput placeholder="Cari jenis surat..." />
                                   <CommandList>
                                      <CommandEmpty>Tidak ditemukan.</CommandEmpty>
                                      {LETTER_TYPES.map((type) => (
                                         <CommandItem 
                                            key={type.id} 
                                            value={type.jenis_surat}
                                            onSelect={() => {
                                                setSelectedLetterType(type);
                                                // Trigger update handled by useEffect
                                            }}
                                         >
                                            <Check className={cn("mr-2 h-4 w-4", selectedLetterType?.id === type.id ? "opacity-100" : "opacity-0")} />
                                            <div className="flex flex-col">
                                                <span>{type.jenis_surat}</span>
                                                <span className="text-xs text-muted-foreground">{type.kode_klasifikasi} • {type.kategori}</span>
                                            </div>
                                         </CommandItem>
                                      ))}
                                   </CommandList>
                                </Command>
                             </PopoverContent>
                          </Popover>
                       </div>
                    </CardContent>
                 </Card>

                 {/* Target Selection */}
                 <Card>
                    <CardHeader>
                       <CardTitle>Target Penerima</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="space-y-2">
                          <Label>Jenis Target</Label>
                          <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                             <SelectTrigger>
                                <SelectValue />
                             </SelectTrigger>
                             <SelectContent>
                                <SelectItem value="STUDENT">Siswa</SelectItem>
                                <SelectItem value="STAFF">Guru / Staff</SelectItem>
                                <SelectItem value="MANUAL">Manual (Ketik Nama)</SelectItem>
                             </SelectContent>
                          </Select>
                       </div>

                       {targetType === 'STUDENT' && (
                          <div className="space-y-4">
                             {/* Mode Selection */}
                             <div>
                               <div className="flex rounded-lg border p-1 bg-zinc-100 dark:bg-zinc-800">
                                  {["SINGLE", "MULTIPLE", "CLASS"].map((m) => (
                                     <button
                                        key={m}
                                        onClick={() => {
                                            setRecipientMode(m as any);
                                            setSelectedStudents([]); // Reset on mode change
                                            if (m === 'CLASS') setSelectedClass("");
                                        }}
                                        className={cn(
                                            "flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-all",
                                            recipientMode === m ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600" : "text-muted-foreground hover:text-foreground"
                                        )}
                                     >
                                         {m === 'SINGLE' && "Perorangan"}
                                         {m === 'MULTIPLE' && "Pilih Banyak"}
                                         {m === 'CLASS' && "Satu Kelas"}
                                     </button>
                                  ))}
                               </div>
                             </div>

                             {recipientMode === 'CLASS' && (
                                 <div className="space-y-2">
                                     <Label>Pilih Kelas</Label>
                                     <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); fetchClassStudents(v); }}>
                                         <SelectTrigger>
                                             <SelectValue placeholder="Pilih kelas..." />
                                         </SelectTrigger>
                                         <SelectContent>
                                             {[1, 2, 3, 4, 5, 6].map(c => (
                                                 <SelectItem key={c} value={String(c)}>Kelas {c}</SelectItem>
                                             ))}
                                         </SelectContent>
                                     </Select>
                                     <p className="text-xs text-muted-foreground">
                                         {selectedStudents.length} siswa terpilih.
                                     </p>
                                 </div>
                             )}

                             {(recipientMode === 'SINGLE' || recipientMode === 'MULTIPLE') && (
                                <div className="space-y-2">
                                    <Label>Cari Siswa</Label>
                                    <Popover open={isStudentSearchOpen} onOpenChange={(open) => {
                                        setIsStudentSearchOpen(open);
                                        if (open && studentsList.length === 0) searchStudents(""); 
                                    }}>
                                        <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" className="w-full justify-between">
                                            {recipientMode === 'SINGLE' && selectedStudents.length > 0
                                                ? selectedStudents[0].name
                                                : "Ketik nama siswa..."}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0">
                                        <Command shouldFilter={false}>
                                            <CommandInput 
                                                placeholder="Cari siswa..." 
                                                onValueChange={searchStudents}
                                            />
                                            <CommandList>
                                                {studentsList.length === 0 && <CommandEmpty>Tidak ditemukan.</CommandEmpty>}
                                                {studentsList.map((student) => (
                                                    <CommandItem key={student.id} value={student.id} onSelect={() => handleSelectStudent(student.id)}>
                                                    <Check className={cn("mr-2 h-4 w-4", selectedStudents.find(s => s.id === student.id) ? "opacity-100" : "opacity-0")} />
                                                    <div className="flex flex-col">
                                                        <span>{student.name}</span>
                                                        <span className="text-xs text-muted-foreground">{student.nisn || "-"} • Kelas {student.className}</span>
                                                    </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandList>
                                        </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                             )}

                             {/* Selected Chips */}
                             {selectedStudents.length > 0 && recipientMode !== 'SINGLE' && (
                                 <div className="flex flex-wrap gap-2 pt-2">
                                     {selectedStudents.map(s => (
                                         <div key={s.id} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-xs px-2 py-1 rounded-full border">
                                             {s.name}
                                             {recipientMode === 'MULTIPLE' && (
                                                 <button onClick={() => handleRemoveStudent(s.id)} className="text-muted-foreground hover:text-red-500">
                                                     <X className="h-3 w-3" />
                                                 </button>
                                             )}
                                         </div>
                                     ))}
                                     {recipientMode === 'CLASS' && selectedStudents.length > 10 && (
                                         <span className="text-xs text-muted-foreground self-center">...dan lainnya</span>
                                     )}
                                 </div>
                             )}
                          </div>
                       )}
                    </CardContent>
                 </Card>
                 
                 {/* Manual Variables Input */}
                 <Card>
                    <CardHeader>
                       <CardTitle>Isi Variabel Surat</CardTitle>
                       <CardDescription>Lengkapi data yang kosong di bawah ini.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {manualVars.length === 0 ? (
                           <div className="text-center py-6 space-y-3">
                               <p className="text-muted-foreground italic text-sm">Tidak ada variabel manual.</p>
                           </div>
                       ) : (
                           manualVars.map((v) => (
                               <div key={v} className="space-y-2">
                                   <Label className="capitalize">{v.replace(/_/g, " ")}</Label>
                                   <Input 
                                      placeholder={`Masukkan ${v.replace(/_/g, " ")}`}
                                      value={manualInputs[v] || ""}
                                      onChange={(e) => setManualInputs({...manualInputs, [v]: e.target.value})}
                                   />
                               </div>
                           ))
                       )}
                    </CardContent>
                    <CardFooter className="justify-end gap-2">
                        <Button variant="ghost" onClick={() => setStep(1)}>Kembali</Button>
                        <Button onClick={handleGeneratePreview} className="bg-blue-600">
                           Lanjut Preview <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                 </Card>
             </div>
             
             {/* Info Sidebar */}
             <div className="space-y-4">
                 <Card>
                    <CardHeader>
                       <CardTitle>Template Info</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                       <div className="flex justify-between">
                          <span className="text-muted-foreground">Nama:</span>
                          <span className="font-medium">{selectedTemplate.name}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-muted-foreground">Kategori:</span>
                          <span className="font-medium">{selectedTemplate.category}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-muted-foreground">Penerima:</span>
                          <span className="font-medium">{selectedStudents.length} Orang</span>
                       </div>
                    </CardContent>
                 </Card>
             </div>
          </div>
       )}

       {/* Step 3: Preview */}
       {step === 3 && (
          <div className="space-y-6">
              <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-800 p-4 rounded-lg">
                  <div className="flex items-center gap-4">
                      <Button variant="outline" onClick={() => setStep(2)}>
                         <ArrowLeft className="mr-2 h-4 w-4" /> Edit Data
                      </Button>
                      <div className="flex flex-col">
                          <span className="text-sm font-medium">
                              {selectedStudents.length > 1 ? `Siap unduh untuk ${selectedStudents.length} siswa` : "Siap diunduh"}
                          </span>
                          <span className="text-xs text-muted-foreground">Pastikan data sudah benar.</span>
                      </div>
                  </div>
                  <Button onClick={handleDownloadDocx} size="lg" className="bg-blue-600 hover:bg-blue-700">
                      <Download className="mr-2 h-4 w-4" /> 
                      {selectedStudents.length > 1 ? "Download ZIP (Semua)" : "Download Dokumen (.docx)"}
                  </Button>
              </div>

             <div className="flex justify-center bg-zinc-200 dark:bg-zinc-950 p-8 rounded-lg overflow-auto">
                 <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg shadow-sm max-w-lg text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                        {selectedStudents.length > 1 ? <Users className="h-8 w-8" /> : <Check className="h-8 w-8" />}
                    </div>
                    <h3 className="text-xl font-semibold">Dokumen Siap</h3>
                    {selectedStudents.length > 1 ? (
                        <p className="text-muted-foreground">
                            Anda akan mengunduh <strong>{selectedStudents.length} dokumen</strong> sekaligus dalam format ZIP.<br/>
                            Nomor surat akan dicatat sebagai satu batch.
                        </p>
                    ) : (
                        <p className="text-muted-foreground">
                            Data <strong>{generatedData?.siswa_nama}</strong> telah digabungkan.<br/>
                            Silakan unduh file sekarang.
                        </p>
                    )}
                 </div>
             </div>
          </div>
       )}
    </div>
  );
}
