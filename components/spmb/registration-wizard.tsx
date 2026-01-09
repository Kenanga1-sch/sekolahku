"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";

import StudentForm from "./student-form";
import ParentForm from "./parent-form";
import LocationForm from "./location-form";
import DocumentForm from "./document-form";
import ReviewStep from "./review-step";
import StepIndicator from "./step-indicator";

import {
  studentFormSchema,
  parentFormSchema,
  locationFormSchema,
  type StudentFormValues,
  type ParentFormValues,
  type LocationFormValues,
} from "@/lib/validations/spmb";

// ==========================================
// Types
// ==========================================

interface RegistrationData {
  student: StudentFormValues | null;
  parent: ParentFormValues | null;
  location: LocationFormValues | null;
  documents: File[];
}

interface RegistrationWizardProps {
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
  onSubmit: (data: RegistrationData) => Promise<{ success: boolean; registrationNumber?: string; error?: string }>;
}

const STEPS = [
  { id: 1, title: "Data Siswa", description: "Informasi calon siswa" },
  { id: 2, title: "Data Orang Tua", description: "Informasi ayah/ibu" },
  { id: 3, title: "Lokasi Rumah", description: "Pilih titik di peta" },
  { id: 4, title: "Dokumen", description: "Upload berkas" },
  { id: 5, title: "Review", description: "Cek ulang data" },
];

export default function RegistrationWizard({
  schoolLat,
  schoolLng,
  maxDistanceKm,
  onSubmit,
}: RegistrationWizardProps) {
  // Current step
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    registrationNumber?: string;
    error?: string;
  } | null>(null);

  // Form data storage
  const [registrationData, setRegistrationData] = useState<RegistrationData>({
    student: null,
    parent: null,
    location: null,
    documents: [],
  });

  // Forms for each step
  const studentForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: { full_name: "", nik: "", birth_place: "", birth_date: "", gender: undefined, previous_school: "" },
  });

  const parentForm = useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: { parent_name: "", parent_phone: "", parent_email: "", home_address: "" },
  });

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: { home_lat: schoolLat + 0.005, home_lng: schoolLng + 0.005, distance_to_school: 0, is_within_zone: true },
  });

  // ==========================================
  // Step Navigation
  // ==========================================

  const handleNext = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await studentForm.trigger();
        if (isValid) setRegistrationData(prev => ({ ...prev, student: studentForm.getValues() }));
        break;
      case 2:
        isValid = await parentForm.trigger();
        if (isValid) setRegistrationData(prev => ({ ...prev, parent: parentForm.getValues() }));
        break;
      case 3:
        isValid = await locationForm.trigger();
        if (isValid) setRegistrationData(prev => ({ ...prev, location: locationForm.getValues() }));
        break;
      case 4:
        isValid = registrationData.documents.length > 0;
        break;
      case 5:
        await handleSubmit();
        return;
    }

    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ==========================================
  // Form Submission
  // ==========================================

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(registrationData);
      setSubmitResult(result);
    } catch (error) {
      setSubmitResult({
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // Handlers
  // ==========================================
  
  const handleDocumentsChange = (files: File[]) => {
    setRegistrationData(prev => ({ ...prev, documents: files }));
  };

  const handleLocationChange = (lat: number, lng: number, distance: number, isWithinZone: boolean) => {
    locationForm.setValue("home_lat", lat);
    locationForm.setValue("home_lng", lng);
    locationForm.setValue("distance_to_school", distance);
    locationForm.setValue("is_within_zone", isWithinZone);
  };

  // ==========================================
  // Render
  // ==========================================

  // Success State
  if (submitResult?.success) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="max-w-xl mx-auto border-none shadow-2xl bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xl">
          <CardContent className="pt-12 pb-12 flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
              <Check className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-green-600 dark:text-green-400">Pendaftaran Berhasil!</h2>
              <p className="text-muted-foreground text-lg">
                Data Anda telah kami terima untuk verifikasi.
              </p>
            </div>

            <div className="bg-zinc-100 dark:bg-zinc-800 p-6 rounded-2xl w-full max-w-sm">
              <p className="text-sm text-muted-foreground mb-1">Nomor Registrasi</p>
              <p className="text-3xl font-mono font-bold tracking-wider">{submitResult.registrationNumber}</p>
            </div>

            <Button 
              size="lg" 
              className="mt-4 gap-2 rounded-full px-8"
              onClick={() => window.location.href = "/spmb/tracking"}
            >
              Cek Status Pendaftaran <ChevronRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Error State
  if (submitResult && !submitResult.success) {
    return (
      <Card className="max-w-xl mx-auto border-red-200 bg-red-50 dark:bg-red-900/10">
        <CardContent className="pt-8 text-center space-y-4">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-700">Terjadi Kesalahan</h2>
          <p className="text-muted-foreground">{submitResult.error}</p>
          <Button variant="outline" onClick={() => setSubmitResult(null)}>Kembali</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      {/* Step Indicator */}
      <div className="px-4">
        <StepIndicator steps={STEPS} currentStep={currentStep} />
      </div>

      {/* Main Form Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <Card className="border-none shadow-xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl overflow-hidden">
             {/* Header Stripe */}
             <div className="h-1.5 w-full bg-gradient-to-r from-primary to-blue-400" />
             
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">{STEPS[currentStep - 1].title}</h2>
                <p className="text-muted-foreground">{STEPS[currentStep - 1].description}</p>
              </div>

              {currentStep === 1 && <Form {...studentForm}><StudentForm form={studentForm} /></Form>}
              {currentStep === 2 && <Form {...parentForm}><ParentForm form={parentForm} /></Form>}
              {currentStep === 3 && (
                <LocationForm
                  form={locationForm}
                  schoolLat={schoolLat}
                  schoolLng={schoolLng}
                  maxDistanceKm={maxDistanceKm}
                  onLocationChange={handleLocationChange}
                />
              )}
              {currentStep === 4 && (
                <DocumentForm
                  documents={registrationData.documents}
                  onDocumentsChange={handleDocumentsChange}
                />
              )}
              {currentStep === 5 && (
                <ReviewStep
                  data={registrationData}
                  onEdit={(step) => setCurrentStep(step)}
                />
              )}
            </CardContent>

            {/* Floating Action Bar */}
            <div className="p-4 md:p-6 bg-zinc-50/50 dark:bg-zinc-800/50 border-t backdrop-blur flex justify-between items-center">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 1 || isSubmitting}
                className="gap-2 rounded-full px-6"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>

              <Button
                onClick={handleNext}
                disabled={isSubmitting || (currentStep === 4 && registrationData.documents.length === 0)}
                className="gap-2 rounded-full px-8 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing
                  </>
                ) : currentStep === STEPS.length ? (
                  <>
                    Submit Application <Send className="h-4 w-4 ml-1" />
                  </>
                ) : (
                  <>
                    Next Step <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
