import {
    studentFormSchema,
    parentFormSchema,
    locationFormSchema,
    documentFormSchema,
} from "@/lib/validations/spmb";
import { z } from "zod";

export const DOCUMENT_LABELS: Record<string, string> = {
    kk: "Kartu Keluarga",
    akte: "Akta Kelahiran",
    ktp_ayah: "KTP Ayah",
    ktp_ibu: "KTP Ibu",
    pas_foto: "Pas Foto",
    ijazah: "Ijazah / SKL",
    kip: "Kartu Indonesia Pintar (KIP)",
    kps: "Kartu Perlindungan Sosial (KPS/PKH)",
    other: "Dokumen Lainnya"
};

export type StudentFormValues = z.infer<typeof studentFormSchema>;
export type ParentFormValues = z.infer<typeof parentFormSchema>;
export type LocationFormValues = z.infer<typeof locationFormSchema>;
export type DocumentFormValues = z.infer<typeof documentFormSchema>;

export interface RegistrationData {
    student: StudentFormValues | null;
    parent: ParentFormValues | null;
    location: LocationFormValues | null;
    documents: DocumentFormValues | null;
}
