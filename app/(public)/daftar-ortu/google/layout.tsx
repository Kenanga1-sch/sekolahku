import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Selesaikan Pendaftaran Google",
  description:
    "Verifikasi NISN dan tanggal lahir anak untuk menyelesaikan pendaftaran akun orang tua dengan Google.",
  // Halaman ini hanya berguna dengan cookie tiket OAuth; jangan diindeks.
  robots: { index: false, follow: false },
};

export default function DaftarOrtuGoogleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
