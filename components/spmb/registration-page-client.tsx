"use client";

import { useState } from "react";
import Link from "next/link";
import RegistrationWizard from "@/components/spmb/registration-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap } from "lucide-react";
import type { RegistrationData } from "@/types/spmb";
import { siteConfig, getSPMBPeriodLabel } from "@/lib/config";

// Default school coordinates from config
const DEFAULT_SCHOOL_LAT = siteConfig.location.lat;
const DEFAULT_SCHOOL_LNG = siteConfig.location.lng;
const DEFAULT_MAX_DISTANCE_KM = siteConfig.location.maxDistanceKm;

interface RegistrationPageClientProps {
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
}

export function RegistrationPageClient({
  schoolLat,
  schoolLng,
  maxDistanceKm,
}: RegistrationPageClientProps) {
  const [schoolSettings] = useState({
    lat: schoolLat,
    lng: schoolLng,
    maxDistanceKm: maxDistanceKm,
  });

  // Handle form submission
  const handleSubmit = async (
    data: RegistrationData
  ): Promise<{ success: boolean; registrationNumber?: string; id?: string; error?: string; details?: Record<string, string> }> => {
    try {
      // Validate all data is present
      if (!data.student || !data.parent || !data.location) {
        return { success: false, error: "Data tidak lengkap" };
      }

      // Submit to API route
      const response = await fetch("/api/spmb/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data.student,
          student_nik: data.student.nik, 
          ...data.parent,
          ...data.location,
        }),
      });

      const result = await response.json();
      console.log("Registration API Result:", result); // DEBUG LOG

      if (!result.success) {
        // Handle case where error is an object (e.g. { message: "...", code: "..." })
        let errorMessage = "Terjadi kesalahan saat mendaftar";
        if (typeof result.error === "string") {
          errorMessage = result.error;
        } else if (typeof result.error === "object" && result.error?.message) {
          errorMessage = result.error.message;
        }

        return {
          success: false,
          error: errorMessage,
          details: result.error?.fields // Pass the 'fields' object if it exists
        };
      }

      // Handle document upload if any
      if (data.documents && result.data?.id) {
        const formData = new FormData();
        
        Object.entries(data.documents).forEach(([key, file]) => {
            if (file instanceof File) {
                formData.append("documents", file);
                formData.append("types", key);
            }
        });

        await fetch(`/api/spmb/upload?id=${result.data.id}`, {
          method: "POST",
          body: formData,
        });
      }

      return {
        success: true,
        registrationNumber: result.data?.registration_number,
        id: result.data?.id,
      };
    } catch (error: any) {
      console.error("Registration error:", error);
      // Ensure error is always a string to prevent React "Objects are not valid as a React child" error
      const errorMessage = typeof error === "string" 
        ? error 
        : error?.message || "Terjadi kesalahan saat mendaftar";

      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white pt-20 pb-8">
        <div className="container">
          <Link href="/spmb">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10 mb-4 -ml-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Kembali
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-white/20 flex items-center justify-center">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <Badge className="bg-white/20 mb-1">{getSPMBPeriodLabel()}</Badge>
              <h1 className="text-2xl md:text-3xl font-bold">
                Formulir Pendaftaran Siswa Baru
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container py-8">
        <RegistrationWizard
          schoolLat={schoolSettings.lat}
          schoolLng={schoolSettings.lng}
          maxDistanceKm={schoolSettings.maxDistanceKm}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
