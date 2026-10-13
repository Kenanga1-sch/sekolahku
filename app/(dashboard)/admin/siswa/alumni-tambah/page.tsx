"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, GraduationCap, Keyboard } from "lucide-react";
import Link from "next/link";
import { goPost } from "@/lib/api-client";
import { alumniFormSchema, type AlumniFormData } from "./alumni-tambah-schema";
import { AlumniIdentitasTab } from "./_components/identitas-tab";
import { AlumniAkademikTab } from "./_components/akademik-tab";
import { AlumniKeluargaTab } from "./_components/keluarga-tab";

export default function TambahAlumniPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [entryType, setEntryType] = useState<"tk" | "mutasi">("tk");
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<any>({
    resolver: zodResolver(alumniFormSchema),
    defaultValues: {
      status: "active",
      enrolledYear: new Date().getFullYear().toString(),
      citizenship: "WNI",
      dailyLanguage: "Bahasa Indonesia",
      livingWith: "Orangtua",
      siblingKandung: 0,
      siblingTiri: 0,
      siblingAngkat: 0,
    },
  });

  const studentStatus = watch("status");

  // Autofocus first input on step change
  useEffect(() => {
    const focusable = formRef.current?.querySelectorAll("input, select, textarea");
    if (focusable && focusable.length > 0) {
      // Find first visible input and focus it
      const first = Array.from(focusable).find(
        (el) => el.getAttribute("type") !== "hidden" && !(el as HTMLInputElement).disabled
      ) as HTMLElement;
      first?.focus();
    }
  }, [currentStep]);

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
      const newAlumni: any = await goPost("/api/alumni", data);

      if (newAlumni.error) {
        throw new Error(newAlumni.error || "Gagal menyimpan data");
      }

      router.push(`/admin/siswa/alumni-detail?id=${newAlumni.id}`);
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

  // Sanitize numeric fields (non-digits remover)
  const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof AlumniFormData) => {
    const val = e.target.value.replace(/\D/g, "");
    setValue(fieldName, val);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Link href="/admin/siswa" className="shrink-0">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 min-w-0">
              <GraduationCap className="h-6 w-6 text-primary shrink-0" />
              <span className="truncate">Tambah Data Buku Induk</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              Tambahkan data lengkap siswa ke dalam Buku Induk Sekolah
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
          <Keyboard className="h-4 w-4" />
          <span>Navigasi: <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Enter</kbd> (Lanjut) / <kbd className="font-sans font-semibold bg-white dark:bg-zinc-950 px-1 border rounded">Ctrl+Backsp</kbd> (Kembali)</span>
        </div>
      </div>

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
            <AlumniIdentitasTab
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              handleNumericInput={handleNumericInput}
            />
          </TabsContent>

          {/* STEP 2: STATUS & AKADEMIK */}
          <TabsContent value="akademik">
            <AlumniAkademikTab
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
            <AlumniKeluargaTab
              register={register}
              watch={watch}
              handleNumericInput={handleNumericInput}
            />
          </TabsContent>
        </Tabs>

        {/* Submit Button (desktop) */}
        <div className="hidden sm:flex justify-end gap-2 pt-4 border-t">
          <Link href="/admin/siswa">
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
                Simpan Data Buku Induk
              </>
            )}
          </Button>
        </div>

        {/* Submit Button (mobile — sticky) */}
        <div className="sm:hidden sticky bottom-0 z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-t flex gap-2">
          <Link href="/admin/siswa" className="flex-1">
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
                Simpan
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
