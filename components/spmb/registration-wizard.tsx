"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, Loader2, Send, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { BackgroundGradient } from "@/components/ui/background-gradient";

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
} from "@/lib/validations/spmb";
import { documentFormSchema } from "@/lib/validations/spmb";
import { 
  type RegistrationData, 
  type StudentFormValues, 
  type ParentFormValues, 
  type LocationFormValues,
  type DocumentFormValues
} from "@/types/spmb";

interface RegistrationWizardProps {
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
  onSubmit: (data: RegistrationData) => Promise<{ success: boolean; registrationNumber?: string; id?: string; error?: string; details?: Record<string, string> }>;
}

const STEPS = [
  { id: 1, title: "Data Siswa", description: "Informasi calon siswa" },
  { id: 2, title: "Data Orang Tua", description: "Informasi ayah/ibu" },
  { id: 3, title: "Lokasi Rumah", description: "Pilih titik di peta" },
  { id: 4, title: "Dokumen", description: "Upload berkas" },
  { id: 5, title: "Review", description: "Cek ulang data" },
];

/**
 * Inner Component: Renders forms with GUARANTEED initial data
 */
function RegistrationWizardContent({
  schoolLat,
  schoolLng,
  maxDistanceKm,
  onSubmit,
  initialData,
}: RegistrationWizardProps & { initialData: RegistrationData & { lastStep?: number } }) {
  
  const [currentStep, setCurrentStep] = useState(initialData.lastStep || 1);
  const [activeParentTab, setActiveParentTab] = useState("father");
  const [activeDocumentTab, setActiveDocumentTab] = useState("required");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    registrationNumber?: string;
    id?: string;
    error?: string;
    details?: Record<string, string>;
  } | null>(null);

  const [registrationData, setRegistrationData] = useState<RegistrationData>(initialData);

  // Forms with explicit default values from props (Sync initialization)
  const studentForm = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema) as any,
    defaultValues: initialData.student || {
      full_name: "", nik: "", kk_number: "", birth_place: "", birth_date: "",
      gender: undefined, religion: undefined, special_needs: "Tidak",
      living_arrangement: undefined, transport_mode: undefined, child_order: 1,
      has_kps_pkh: false, has_kip: false, previous_school: "", nisn: "", birth_certificate_no: ""
    } as any, // Cast to any because undefined is not assignable to enum types in strictly typed forms
  });

  const parentForm = useForm<ParentFormValues>({
    resolver: zodResolver(parentFormSchema),
    defaultValues: initialData.parent || {
      parent_phone: "", parent_email: "", address_street: "", address_rt: "",
      address_rw: "", address_village: "", postal_code: "",
      father_name: "", father_nik: "", father_birth_year: "", father_education: undefined,
      father_job: undefined, father_income: undefined,
      mother_name: "", mother_nik: "", mother_birth_year: "", mother_education: undefined,
      mother_job: undefined, mother_income: undefined,
      guardian_name: "", guardian_nik: "", guardian_birth_year: "", guardian_education: "",
      guardian_job: "", guardian_income: "",
    },
  });

  const locationForm = useForm<LocationFormValues>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: initialData.location || {
      home_lat: schoolLat + 0.005,
      home_lng: schoolLng + 0.005,
      distance_to_school: 0,
      is_within_zone: true,
    },
  });

  // Real-time Persistence (Watcher)
  const studentValues = studentForm.watch();
  const parentValues = parentForm.watch();
  const locationValues = locationForm.watch();

  useEffect(() => {
    // Only save if NOT submitting
    if (isSubmitting) return;

    const timer = setTimeout(() => {
      const currentData = {
        student: studentValues,
        parent: parentValues,
        location: locationValues,
        lastStep: currentStep
      };
      localStorage.setItem("spmb_registration_progress", JSON.stringify(currentData));
      
      // Also update local state for review step
      setRegistrationData(prev => ({
        ...prev,
        student: studentValues,
        parent: parentValues,
        location: locationValues
      }));
    }, 800);

    return () => clearTimeout(timer);
  }, [studentValues, parentValues, locationValues, currentStep, isSubmitting]);

  // Tab Validation Fields
  const PARENT_TAB_FIELDS: Record<string, (keyof ParentFormValues)[]> = {
    father: ["father_name", "father_nik", "father_birth_year", "father_education", "father_job", "father_income"],
    mother: ["mother_name", "mother_nik", "mother_birth_year", "mother_education", "mother_job", "mother_income"],
    guardian: ["guardian_name", "guardian_nik", "guardian_birth_year", "guardian_education", "guardian_job", "guardian_income"],
    contact: ["parent_phone", "parent_email", "address_street", "address_rt", "address_rw", "address_village", "postal_code"],
  };

  // Step Navigation
  const handleNext = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = await studentForm.trigger();
        break;
      case 2:
        // Parent Form with Tabs
        const currentTabFields = PARENT_TAB_FIELDS[activeParentTab];
        isValid = await parentForm.trigger(currentTabFields);
        
        if (isValid) {
          if (activeParentTab === "father") {
            setActiveParentTab("mother");
            return;
          }
          if (activeParentTab === "mother") {
            setActiveParentTab("guardian");
            return;
          }
           if (activeParentTab === "guardian") {
            setActiveParentTab("contact");
            return;
          }
          // If contact tab is valid, proceed to next step
        } else {
             // If validation failed, stop here
             return;
        }
        break;
      case 3:
        isValid = await locationForm.trigger();
        break;
      case 4:
        // Document Form with Tabs
        // Validate required docs
        if (activeDocumentTab === "required") {
             const docs = registrationData.documents || {} as any;
             const requiredFilled = docs.kk && docs.akte && docs.ktp_ayah && docs.ktp_ibu;
             if (!requiredFilled) {
                 // Trigger global validation to show errors if we use Zod schema directly or show alert
                 // Since we use manual check here for simplicity as documents are not in react-hook-form
                 // Let's use the schema to validate
                 const result = documentFormSchema.safeParse(docs);
                 if (!result.success) {
                     // We can't easily show errors on specific fields without form context or passing errors down
                     // But the DocumentForm shows "Required" and visual feedback
                     // Let's force check
                     if (!docs.kk || !docs.akte || !docs.ktp_ayah || !docs.ktp_ibu) {
                         alert("Mohon lengkapi dokumen wajib terlebih dahulu.");
                         return;
                     }
                 }
             }
             setActiveDocumentTab("optional");
             return;
        }
        // If on optional tab, check if we can proceed (always yes for optional)
        isValid = documentFormSchema.safeParse(registrationData.documents || {}).success;
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
    // Logic backwards
    if (currentStep === 2) {
         if (activeParentTab === "contact") {
             setActiveParentTab("guardian");
             return;
         }
         if (activeParentTab === "guardian") {
             setActiveParentTab("mother");
             return;
         }
         if (activeParentTab === "mother") {
             setActiveParentTab("father");
             return;
         }
    }
    
    if (currentStep === 4) {
         if (activeDocumentTab === "optional") {
             setActiveDocumentTab("required");
             return;
         }
    }

    setCurrentStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStepClick = (stepId: number) => {
    // Only allow jumping backwards to completed steps
    if (stepId < currentStep) {
      setCurrentStep(stepId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await onSubmit(registrationData);
      setSubmitResult(result);
      
      if (result.success) {
        localStorage.removeItem("spmb_registration_progress");
      }
    } catch (error) {
      setSubmitResult({
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDocumentsChange = (docs: DocumentFormValues) => {
    setRegistrationData(prev => ({ ...prev, documents: docs }));
  };

  const handleLocationChange = (lat: number, lng: number, distance: number, isWithinZone: boolean) => {
    locationForm.setValue("home_lat", lat);
    locationForm.setValue("home_lng", lng);
    locationForm.setValue("distance_to_school", distance);
    locationForm.setValue("is_within_zone", isWithinZone);
  };

  // Render Success
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
              className="mt-4 gap-2 rounded-full px-8 w-full sm:w-auto"
              onClick={() => window.location.href = "/spmb/tracking"}
            >
              Cek Status Pendaftaran <ChevronRight className="h-4 w-4" />
            </Button>
            
            {submitResult.registrationNumber && submitResult.id && (
                <Button 
                  variant="outline"
                  size="lg" 
                  className="mt-2 gap-2 rounded-full px-8 w-full sm:w-auto"
                  onClick={() => window.open(`/spmb/bukti/${submitResult.id}`, '_blank')}
                >
                  <Printer className="h-4 w-4" /> Cetak Bukti Pendaftaran
                </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Render Error
  if (submitResult && !submitResult.success) {
    return (
      <Card className="max-w-xl mx-auto border-red-200 bg-red-50 dark:bg-red-900/10">
        <CardContent className="pt-8 text-center space-y-4">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-700">Terjadi Kesalahan</h2>
          <p className="text-muted-foreground">
            {typeof submitResult.error === 'string' 
              ? submitResult.error 
              : (submitResult.error as any)?.message || "Terjadi kesalahan yang tidak diketahui"}
          </p>

          {submitResult.details && Object.keys(submitResult.details).length > 0 && (
            <div className="bg-red-100/50 p-4 rounded-lg text-left text-sm space-y-1 max-h-48 overflow-y-auto">
              <p className="font-semibold text-red-800 mb-2">Detail Error:</p>
              {Object.entries(submitResult.details).map(([field, msg]) => (
                <div key={field} className="text-red-700 flex gap-2">
                  <span className="font-mono text-xs bg-red-200/50 px-1 rounded">{field}</span>
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          <Button variant="outline" onClick={() => setSubmitResult(null)}>Kembali</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="px-4">
        <StepIndicator 
          steps={STEPS} 
          currentStep={currentStep} 
          onStepClick={handleStepClick}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <BackgroundGradient containerClassName="rounded-[24px]" className="rounded-[22px] bg-white dark:bg-zinc-900 h-full">
            <Card className="border-none shadow-none bg-transparent overflow-hidden h-full flex flex-col">
             <div className="h-1.5 w-full bg-gradient-to-r from-primary to-blue-400" />
             
            <CardContent className="p-6 md:p-8 space-y-6 flex-1">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">{STEPS[currentStep - 1].title}</h2>
                <p className="text-muted-foreground">{STEPS[currentStep - 1].description}</p>
              </div>

              {currentStep === 1 && <Form {...studentForm}><StudentForm form={studentForm as any} /></Form>}
              {currentStep === 2 && (
                <Form {...parentForm}>
                  <ParentForm 
                    form={parentForm} 
                    activeTab={activeParentTab} 
                    onTabChange={setActiveParentTab} 
                  />
                </Form>
              )}
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
                  activeTab={activeDocumentTab}
                  onTabChange={setActiveDocumentTab}
                />
              )}
              {currentStep === 5 && (
                <ReviewStep
                  data={registrationData}
                  onEdit={(step) => setCurrentStep(step)}
                />
              )}
            </CardContent>

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
                disabled={isSubmitting || (currentStep === 4 && !registrationData.documents)}
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
          </BackgroundGradient>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/**
 * Main Wrapper: Handles Hydration from LocalStorage
 */
export default function RegistrationWizard(props: RegistrationWizardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [initialData, setInitialData] = useState<RegistrationData & { lastStep?: number }>({
    student: null,
    parent: null,
    location: null,
    documents: null,
    lastStep: 1,
  });

  useEffect(() => {
    const savedData = localStorage.getItem("spmb_registration_progress");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setInitialData({
          student: parsed.student || null,
          parent: parsed.parent || null,
          location: parsed.location || null,
          documents: null, // Files not persisted
          lastStep: parsed.lastStep || 1
        });
      } catch (e) {
        console.error("Failed to parse saved registration data", e);
      }
    }
    setIsLoaded(true);
  }, []);

  if (!isLoaded) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Memuat formulir...</p>
        </div>
      </div>
    );
  }

  return <RegistrationWizardContent {...props} initialData={initialData} />;
}

