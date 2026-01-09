"use client";

import { useState } from "react";
import Link from "next/link";
import RegistrationWizard from "@/components/spmb/registration-wizard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { pb, generateRegistrationNumber, createRegistration, getActiveSPMBPeriod } from "@/lib/pocketbase";
import type { StudentFormValues, ParentFormValues, LocationFormValues } from "@/lib/validations/spmb";

// Default school coordinates (will be fetched from PocketBase in production)
const DEFAULT_SCHOOL_LAT = Number(process.env.NEXT_PUBLIC_DEFAULT_LAT) || -6.200000;
const DEFAULT_SCHOOL_LNG = Number(process.env.NEXT_PUBLIC_DEFAULT_LNG) || 106.816666;
const DEFAULT_MAX_DISTANCE_KM = 3;

interface RegistrationData {
  student: StudentFormValues | null;
  parent: ParentFormValues | null;
  location: LocationFormValues | null;
  documents: File[];
}

export default function RegistrationPage() {
  const [schoolSettings] = useState({
    lat: DEFAULT_SCHOOL_LAT,
    lng: DEFAULT_SCHOOL_LNG,
    maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
  });

  // Handle form submission
  const handleSubmit = async (
    data: RegistrationData
  ): Promise<{ success: boolean; registrationNumber?: string; error?: string }> => {
    try {
      // Validate all data is present
      if (!data.student || !data.parent || !data.location) {
        return { success: false, error: "Data tidak lengkap" };
      }

      // Generate registration number
      const registrationNumber = await generateRegistrationNumber();

      // Get active period
      const activePeriod = await getActiveSPMBPeriod();

      // Create FormData for file upload
      const formData = new FormData();

      // Add all fields
      formData.append("registration_number", registrationNumber);
      if (activePeriod) {
        formData.append("period", activePeriod.id);
      }

      // Student data
      formData.append("full_name", data.student.full_name);
      formData.append("nik", data.student.nik);
      formData.append("birth_place", data.student.birth_place);
      formData.append("birth_date", data.student.birth_date);
      formData.append("gender", data.student.gender);
      formData.append("previous_school", data.student.previous_school);

      // Parent data
      formData.append("parent_name", data.parent.parent_name);
      formData.append("parent_phone", data.parent.parent_phone);
      formData.append("parent_email", data.parent.parent_email);
      formData.append("home_address", data.parent.home_address);

      // Location data
      formData.append("home_lat", data.location.home_lat.toString());
      formData.append("home_lng", data.location.home_lng.toString());
      formData.append("distance_to_school", data.location.distance_to_school.toString());
      formData.append("is_within_zone", data.location.is_within_zone.toString());

      // Status
      formData.append("status", "pending");

      // Add documents
      data.documents.forEach((file) => {
        formData.append("documents", file);
      });

      // Submit to PocketBase
      await pb.collection("spmb_registrants").create(formData);

      return {
        success: true,
        registrationNumber,
      };
    } catch (error) {
      console.error("Registration error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Terjadi kesalahan saat mendaftar",
      };
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white py-8">
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
              <Badge className="bg-white/20 mb-1">SPMB 2024/2025</Badge>
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
