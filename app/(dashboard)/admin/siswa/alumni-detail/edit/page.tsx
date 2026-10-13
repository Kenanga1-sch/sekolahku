"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, GraduationCap, Keyboard } from "lucide-react";
import Link from "next/link";
import { PhotoUpload } from "@/components/alumni/photo-upload";
import { goGet, goPut } from "@/lib/api-client";
import { alumniFormSchema, type AlumniFormData } from "./alumni-edit-schema";
import { IdentitasTab } from "./_components/identitas-tab";
import { AkademikTab } from "./_components/akademik-tab";
import { KeluargaTab } from "./_components/keluarga-tab";

export default function EditAlumniPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const alumniId = searchParams.get('id');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alumniName, setAlumniName] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [entryType, setEntryType] = useState<"tk" | "mutasi">("tk");
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<any>({
    resolver: zodResolver(alumniFormSchema),
  });

  const studentStatus = watch("status");

  // Fetch existing data
  useEffect(() => {
    const fetchAlumni = async () => {
      try {
        const resData: any = await goGet(`/api/alumni/${alumniId}`);
        const data = resData?.data || resData;
        setAlumniName(data.fullName || "");
        setCurrentPhoto(data.photo || null);
        
        // Detect entry type
        if (data.mutasiMasukAsalSekolah || data.mutasiMasukDariKelas) {
          setEntryType("mutasi");
        } else {
          setEntryType("tk");
        }

        reset({
          fullName: data.fullName || "",
          nickname: data.nickname || "",
          nisn: data.nisn || "",
          nis: data.nis || "",
          nik: data.nik || "",
          gender: data.gender || undefined,
          birthPlace: data.birthPlace || "",
          birthDate: data.birthDate ? data.birthDate.split("T")[0] : "",
          religion: data.religion || "",
          citizenship: data.citizenship || "WNI",
          siblingKandung: data.siblingKandung || 0,
          siblingTiri: data.siblingTiri || 0,
          siblingAngkat: data.siblingAngkat || 0,
          dailyLanguage: data.dailyLanguage || "Bahasa Indonesia",
          livingWith: data.livingWith || "Orangtua",
          status: data.status || "active",
          enrolledYear: data.enrolledYear || "",
          finalClass: data.finalClass || "",
          previousSchool: data.previousSchool || "",
          previousSchoolAddress: data.previousSchoolAddress || "",
          previousSchoolCertNo: data.previousSchoolCertNo || "",
          previousSchoolCertDate: data.previousSchoolCertDate ? data.previousSchoolCertDate.split("T")[0] : "",
          mutasiMasukAsalSekolah: data.mutasiMasukAsalSekolah || "",
          mutasiMasukDariKelas: data.mutasiMasukDariKelas || "",
          mutasiMasukDiterimaTanggal: data.mutasiMasukDiterimaTanggal ? data.mutasiMasukDiterimaTanggal.split("T")[0] : "",
          mutasiMasukDiKelas: data.mutasiMasukDiKelas || "",
          graduationYear: data.graduationYear || "",
          graduationDate: data.graduationDate ? data.graduationDate.split("T")[0] : "",
          nextSchool: data.nextSchool || "",
          mutationOutClass: data.mutationOutClass || "",
          mutationOutToSchool: data.mutationOutToSchool || "",
          mutationOutToClass: data.mutationOutToClass || "",
          mutationOutDate: data.mutationOutDate ? data.mutationOutDate.split("T")[0] : "",
          droppedOutDate: data.droppedOutDate ? data.droppedOutDate.split("T")[0] : "",
          droppedOutReason: data.droppedOutReason || "",
          parentName: data.parentName || "",
          parentPhone: data.parentPhone || "",
          currentAddress: data.currentAddress || "",
          currentPhone: data.currentPhone || "",
          currentEmail: data.currentEmail || "",
          notes: data.notes || "",
           fatherName: data.fatherName || "",
           fatherNik: data.fatherNik || "",
           fatherEducation: data.fatherEducation || "",
           fatherJob: data.fatherJob || "",
           motherName: data.motherName || "",
           motherNik: data.motherNik || "",
           motherEducation: data.motherEducation || "",
           motherJob: data.motherJob || "",
           guardianName: data.guardianName || "",
           guardianNik: data.guardianNik || "",
           guardianRelation: data.guardianRelation || "",
           guardianEducation: data.guardianEducation || "",
           guardianJob: data.guardianJob || "",
           guardianPhone: data.guardianPhone || "",
           ijazahNo: data.ijazahNo || "",
           ijazahDate: data.ijazahDate ? data.ijazahDate.split("T")[0] : "",
           skhunNo: data.skhunNo || "",
           skhunDate: data.skhunDate ? data.skhunDate.split("T")[0] : "",
           fatherIncome: data.fatherIncome || "",
           motherIncome: data.motherIncome || "",
           guardianIncome: data.guardianIncome || "",
           parentAddress: data.parentAddress || "",
           scholarshipInfo: data.scholarshipInfo || "",
          bukuFisikNo: data.bukuFisikNo || "",
          registerNo: data.registerNo ?? "",
          siblingCount: data.siblingCount ?? "",
          childOrder: data.childOrder ?? "",
          address: data.address || "",
          weight: data.weight ?? "",
          height: data.height ?? "",
          bloodType: data.bloodType || "",
          medicalNotes: data.medicalNotes || "",
          specialNeeds: data.specialNeeds || "",
          finalGradeAvg: data.finalGradeAvg ?? "",
          currentOccupation: data.currentOccupation || "",
          currentInstitution: data.currentInstitution || "",
          lastEducationLevel: data.lastEducationLevel || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        setFetching(false);
      }
    };

    if (alumniId) {
      fetchAlumni();
    }
  }, [alumniId, reset]);

  // Autofocus first input on step change
  useEffect(() => {
    if (fetching) return;
    const focusable = formRef.current?.querySelectorAll("input, select, textarea");
    if (focusable && focusable.length > 0) {
      const first = Array.from(focusable).find(
        (el) => el.getAttribute("type") !== "hidden" && !(el as HTMLInputElement).disabled
      ) as HTMLElement;
      first?.focus();
    }
  }, [currentStep, fetching]);

  // Keyboard Navigation: Ctrl+Enter (Next), Ctrl+Backspace (Prev)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (currentStep < 3) {
          handleNext();
        } else {
          formRef.current?.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
      if (e.ctrlKey && e.key === "Backspace") {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, studentStatus]);

  // Focus shifts linearly on Enter press
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "submit" && e.target.type !== "textarea") {
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(form.elements).filter(
        (el) => el.getAttribute("type") !== "hidden" && !(el as HTMLInputElement).disabled
      ) as HTMLElement[];
      const index = elements.indexOf(e.target as HTMLElement);
      if (index > -1 && index + 1 < elements.length) {
        elements[index + 1].focus();
      }
    }
  };

  const onSubmit = async (data: AlumniFormData) => {
    setLoading(true);
    setError(null);

    try {
      const result: any = await goPut(`/api/alumni/${alumniId}`, data);

      if (result.error) {
        throw new Error(result.error || "Gagal memperbarui data");
      }

      router.push(`/admin/siswa/alumni-detail?id=${alumniId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    let fieldsToValidate: any[] = [];
    if (currentStep === 1) {
      fieldsToValidate = ["fullName", "nisn", "nis", "nik", "birthPlace", "birthDate"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["status", "enrolledYear", "finalClass"];
      if (studentStatus === "graduated") {
        fieldsToValidate.push("graduationYear");
      }
    }

    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      if (currentStep < 3) {
        setCurrentStep((prev) => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AlumniFormData) => {
    const val = e.target.value.replace(/\D/g, "");
    setValue(fieldName, val);
  };

  if (fetching) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href={`/admin/siswa/alumni-detail?id=${alumniId}`} className="shrink-0">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 min-w-0">
              <GraduationCap className="h-6 w-6 text-primary shrink-0" />
              <span className="truncate">Edit Data Buku Induk: {alumniName}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Perbarui detail lengkap siswa di master Buku Induk
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
          <Keyboard className="h-4 w-4" />
          <span>Navigasi: <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Enter</kbd> (Lanjut) / <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Backsp</kbd> (Kembali)</span>
        </div>
      </div>

      {/* Profile Photo Upload */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="py-4">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <PhotoUpload
              alumniId={alumniId || ""}
              currentPhoto={currentPhoto}
              alumniName={alumniName}
              onPhotoChange={(newPhoto) => {
                setCurrentPhoto(newPhoto);
                router.refresh();
              }}
            />
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-zinc-200">Pas Foto Profil Buku Induk</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Disarankan menggunakan foto berukuran 3x4 dengan seragam sekolah formal. Format JPG/PNG, maksimal 2 MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs Layout */}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form ref={formRef} onKeyDown={handleFormKeyDown} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="identitas" className="w-full space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
            <TabsTrigger value="identitas">Identitas Siswa</TabsTrigger>
            <TabsTrigger value="akademik">Status & Akademik</TabsTrigger>
            <TabsTrigger value="keluarga">Orang Tua & Wali</TabsTrigger>
          </TabsList>
          
          <TabsContent value="identitas">
            <IdentitasTab
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              handleNumericInput={handleNumericInput}
            />
          </TabsContent>

          {/* STEP 2: STATUS & AKADEMIK */}
          <TabsContent value="akademik">
            <AkademikTab
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              entryType={entryType}
              setEntryType={setEntryType}
              studentStatus={studentStatus}
            />
          </TabsContent>

          {/* STEP 3: ORANG TUA & WALI */}
          <TabsContent value="keluarga" className="space-y-6">
            <KeluargaTab
              register={register}
              watch={watch}
              handleNumericInput={handleNumericInput}
            />
          </TabsContent>
        </Tabs>

        {/* Submit Button (desktop) */}
        <div className="hidden sm:flex justify-end gap-2 pt-4 border-t">
          <Link href={`/admin/siswa/alumni-detail?id=${alumniId}`}>
            <Button type="button" variant="ghost" className="h-9">
              Batal
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="h-9 flex items-center gap-1">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Perbarui Buku Induk
              </>
            )}
          </Button>
        </div>

        {/* Submit Button (mobile — sticky agar selalu terjangkau jempol) */}
        <div className="sm:hidden sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t flex gap-2">
          <Link href={`/admin/siswa/alumni-detail?id=${alumniId}`} className="flex-1">
            <Button type="button" variant="outline" className="h-11 w-full">
              Batal
            </Button>
          </Link>
          <Button type="submit" disabled={loading} className="h-11 flex-[2] flex items-center justify-center gap-1">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Perbarui
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
