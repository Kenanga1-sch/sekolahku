import { redirect } from "next/navigation";

/**
 * Konfigurasi Provider AI dipindah ke Pengaturan → tab "AI & LLM"
 * (hanya bisa diakses admin/superadmin). File ini mempertahankan link lama
 * agar bookmark/navigasi lama tidak 404.
 */
export default function OldAIProviderPage() {
    redirect("/pengaturan");
}
