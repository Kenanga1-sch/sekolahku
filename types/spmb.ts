import type { z } from "zod";
import type { 
  studentFormSchema, 
  parentFormSchema, 
  locationFormSchema, 
  documentFormSchema 
} from "@/lib/validations/spmb";

// Re-export inferred types from Zod schemas
export type StudentFormValues = z.infer<typeof studentFormSchema>;
export type ParentFormValues = z.infer<typeof parentFormSchema>;
export type LocationFormValues = z.infer<typeof locationFormSchema>;
export type DocumentFormValues = z.infer<typeof documentFormSchema>;

// Composite Interface for the Wizard State
export interface RegistrationData {
  student: StudentFormValues | null;
  parent: ParentFormValues | null;
  location: LocationFormValues | null;
  documents: DocumentFormValues | null;
}

// API Payload (Derived from Zod Schema)
export type RegisterApiPayload = z.infer<typeof import("@/lib/validations/spmb").registerApiSchema>;

// API Response Standard
export interface RegisterApiResponse {
  success: boolean;
  data?: {
    registration_number: string;
    id: string;
    status: string;
    is_in_zone: boolean;
  };
  error?: string;
  details?: Record<string, string>;
}
