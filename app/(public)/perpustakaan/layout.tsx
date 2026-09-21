import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PerpustakaanPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top navigation - home link */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm">
              &larr; Kembali ke Beranda
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">
            Katalog Buku Perpustakaan Sekolah
          </span>
        </div>
      </nav>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Perpustakaan Sekolahku. Semua hak dilindungi.</p>
        </div>
      </footer>
    </div>
  );
}