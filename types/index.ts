// ==========================================
// PocketBase Collection Types
// ==========================================

import { RecordModel } from "pocketbase";

// Base record with common fields
export interface BaseRecord extends RecordModel {
  id: string;
  created: string;
  updated: string;
}

// ==========================================
// User & Profile Types
// ==========================================

export type UserRole =
  | "superadmin"
  | "admin"
  | "guru"
  | "siswa"
  | "calon_siswa";

export interface User extends BaseRecord {
  username: string;
  email: string;
  role: UserRole;
  avatar?: string;
  verified: boolean;
}

export interface Profile extends BaseRecord {
  user: string; // relation to users
  full_name: string;
  nip_nisn?: string;
  phone?: string;
  address?: string;
}

// ==========================================
// School Settings Type (Single Record)
// ==========================================

export interface SchoolSettings extends BaseRecord {
  school_name: string;
  school_npsn?: string;
  school_address?: string;
  school_phone?: string;
  school_email?: string;
  school_logo?: string;
  school_lat: number;
  school_lng: number;
  max_distance_km: number;
  spmb_is_open: boolean;
}

// ==========================================
// SPMB Types
// ==========================================

export interface SPMBPeriod extends BaseRecord {
  academic_year: string;
  name: string;
  start_date: string;
  end_date: string;
  quota: number;
  is_active: boolean;
}

export type SPMBStatus =
  | "draft"
  | "pending"
  | "verified"
  | "accepted"
  | "rejected";
export type Gender = "L" | "P";

export interface SPMBRegistrant extends BaseRecord {
  registration_number: string;
  period: string; // relation to spmb_periods
  full_name: string;
  nik: string;
  birth_place?: string;
  birth_date?: string;
  gender?: Gender;
  previous_school?: string;
  home_address?: string;
  home_lat?: number;
  home_lng?: number;
  distance_to_school?: number;
  is_within_zone?: boolean;
  parent_name?: string;
  parent_phone?: string;
  parent_email?: string;
  documents?: string[];
  status: SPMBStatus;
  notes?: string;
  verified_by?: string; // relation to users
  verified_at?: string;
}

// ==========================================
// Announcements Type
// ==========================================

export type AnnouncementCategory = "berita" | "pengumuman" | "spmb";

export interface Announcement extends BaseRecord {
  title: string;
  slug: string;
  content: string;
  thumbnail?: string;
  category: AnnouncementCategory;
  is_published: boolean;
  published_at?: string;
  author: string; // relation to users
}

// ==========================================
// Form Types (for registration wizard)
// ==========================================

export interface StudentFormData {
  full_name: string;
  nik: string;
  birth_place: string;
  birth_date: string;
  gender: Gender;
  previous_school: string;
}

export interface ParentFormData {
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  home_address: string;
}

export interface LocationFormData {
  home_lat: number;
  home_lng: number;
  distance_to_school: number;
  is_within_zone: boolean;
}

export interface DocumentFormData {
  documents: File[];
}

export interface RegistrationFormData
  extends StudentFormData,
    ParentFormData,
    LocationFormData {
  documents: File[];
}

// ==========================================
// Map Types
// ==========================================

export interface MapPickerProps {
  schoolLat: number;
  schoolLng: number;
  maxDistanceKm: number;
  initialHomeLat?: number;
  initialHomeLng?: number;
  onLocationChange: (
    lat: number,
    lng: number,
    distance: number,
    isWithinZone: boolean
  ) => void;
}

export interface Coordinates {
  lat: number;
  lng: number;
}
