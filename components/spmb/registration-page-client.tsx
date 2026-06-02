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
  ): Promise<{ success: boolean; registrationNumber?: string; id?: string; error?: string; details?: Record<string, string>; errorCode?: string; duplicateRegistrationNumber?: string }> => {
    try {
      // Validate all data is present
      if (!data.student || !data.parent || !data.location) {
        return { success: false, error: "Data tidak lengkap" };
      }

      const address = [
        data.parent.address_street,
        data.parent.address_rt ? `RT ${data.parent.address_rt}` : "",
        data.parent.address_rw ? `RW ${data.parent.address_rw}` : "",
        data.parent.address_village,
        data.parent.postal_code,
      ].filter(Boolean).join(", ");

      const payload = {
        fullName: data.student.full_name,
        full_name: data.student.full_name,
        nisn: data.student.nisn,
        studentNik: data.student.nik,
        student_nik: data.student.nik,
        kkNumber: data.student.kk_number,
        kk_number: data.student.kk_number,
        birthCertificateNo: data.student.birth_certificate_no,
        birth_certificate_no: data.student.birth_certificate_no,
        birthPlace: data.student.birth_place,
        birth_place: data.student.birth_place,
        birthDate: data.student.birth_date,
        birth_date: data.student.birth_date,
        gender: data.student.gender,
        religion: data.student.religion,
        specialNeeds: data.student.special_needs,
        special_needs: data.student.special_needs,
        livingArrangement: data.student.living_arrangement,
        living_arrangement: data.student.living_arrangement,
        transportMode: data.student.transport_mode,
        transport_mode: data.student.transport_mode,
        childOrder: data.student.child_order,
        child_order: data.student.child_order,
        hasKpsPkh: data.student.has_kps_pkh,
        has_kps_pkh: data.student.has_kps_pkh,
        hasKip: data.student.has_kip,
        has_kip: data.student.has_kip,
        previousSchool: data.student.previous_school,
        previous_school: data.student.previous_school,
        hobby: data.student.hobby,
        ambition: data.student.ambition,
        height: data.student.height,
        weight: data.student.weight,
        headCircumference: data.student.head_circumference,
        head_circumference: data.student.head_circumference,
        siblingCount: data.student.sibling_count,
        sibling_count: data.student.sibling_count,
        travelTime: data.student.travel_time,
        travel_time: data.student.travel_time,
        addressStreet: data.parent.address_street,
        address_street: data.parent.address_street,
        addressRt: data.parent.address_rt,
        address_rt: data.parent.address_rt,
        addressRw: data.parent.address_rw,
        address_rw: data.parent.address_rw,
        addressVillage: data.parent.address_village,
        address_village: data.parent.address_village,
        postalCode: data.parent.postal_code,
        postal_code: data.parent.postal_code,
        address,
        homeAddress: address,
        home_address: address,
        parentPhone: data.parent.parent_phone,
        parent_phone: data.parent.parent_phone,
        parentEmail: data.parent.parent_email,
        parent_email: data.parent.parent_email,
        fatherName: data.parent.father_name,
        father_name: data.parent.father_name,
        fatherNik: data.parent.father_nik,
        father_nik: data.parent.father_nik,
        fatherBirthYear: data.parent.father_birth_year,
        father_birth_year: data.parent.father_birth_year,
        fatherEducation: data.parent.father_education,
        father_education: data.parent.father_education,
        fatherJob: data.parent.father_job,
        father_job: data.parent.father_job,
        fatherIncome: data.parent.father_income,
        father_income: data.parent.father_income,
        motherName: data.parent.mother_name,
        mother_name: data.parent.mother_name,
        motherNik: data.parent.mother_nik,
        mother_nik: data.parent.mother_nik,
        motherBirthYear: data.parent.mother_birth_year,
        mother_birth_year: data.parent.mother_birth_year,
        motherEducation: data.parent.mother_education,
        mother_education: data.parent.mother_education,
        motherJob: data.parent.mother_job,
        mother_job: data.parent.mother_job,
        motherIncome: data.parent.mother_income,
        mother_income: data.parent.mother_income,
        guardianName: data.parent.guardian_name,
        guardian_name: data.parent.guardian_name,
        guardianNik: data.parent.guardian_nik,
        guardian_nik: data.parent.guardian_nik,
        guardianBirthYear: data.parent.guardian_birth_year,
        guardian_birth_year: data.parent.guardian_birth_year,
        guardianEducation: data.parent.guardian_education,
        guardian_education: data.parent.guardian_education,
        guardianJob: data.parent.guardian_job,
        guardian_job: data.parent.guardian_job,
        guardianIncome: data.parent.guardian_income,
        guardian_income: data.parent.guardian_income,
        homeLat: data.location.home_lat,
        home_lat: data.location.home_lat,
        homeLng: data.location.home_lng,
        home_lng: data.location.home_lng,
        distanceToSchool: data.location.distance_to_school,
        distance_to_school: data.location.distance_to_school,
        isWithinZone: data.location.is_within_zone,
        is_within_zone: data.location.is_within_zone,
      };

      // Submit to API route
      const response = await fetch("/api/public/spmb/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
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
          details: result.error?.fields,
          errorCode: result.error?.code,
          duplicateRegistrationNumber: result.error?.registration_number || result.data?.registration_number,
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
