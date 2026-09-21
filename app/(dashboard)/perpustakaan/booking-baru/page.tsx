"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { createBooking } from "@/lib/library/booking";
import { showSuccess, showError } from "@/lib/toast";

export default function NewBookingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    borrowDate: "",
    dueDate: "",
    borrowerName: "",
    borrowerEmail: "",
    borrowerPhone: "",
    studentClass: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate dates
    if (!formData.borrowDate || !formData.dueDate) {
      showError("Tanggal pinjam dan jatuh tempo wajib diisi");
      return;
    }

    // Convert to Unix ms
    const borrowDateMs = new Date(formData.borrowDate).getTime() / 1000 * 1000;
    const dueDateMs = new Date(formData.dueDate).getTime() / 1000 * 1000;

    // Validate dates not in past
    if (borrowDateMs < Date.now()) {
      showError("Tanggal pinjam tidak boleh di masa lalu");
      return;
    }

    if (dueDateMs <= borrowDateMs) {
      showError("Jatuh tempo harus setelah tanggal pinjam");
      return;
    }

    setLoading(true);

    try {
      await createBooking({
        assetId: params.id,
        borrowDate: borrowDateMs,
        dueDate: dueDateMs,
        borrowerName: formData.borrowerName,
        borrowerEmail: formData.borrowerEmail || undefined,
        borrowerPhone: formData.borrowerPhone || undefined,
        studentClass: formData.studentClass || undefined,
        notes: formData.notes || undefined,
      });

      showSuccess("Booking berhasil dibuat!");
      router.push("/perpustakaan/saya/booking-an");
    } catch (error: any) {
      console.error("Booking error:", error);
      showError(error?.response?.data?.error || "Gagal membuat booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/perpustakaan">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Booking Buku</h1>
          <p className="text-muted-foreground">
            Pesan buku yang ingin Anda pinjam dari perpustakaan
          </p>
        </div>
      </div>

      {/* Alert Card */}
      <Card>
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Proses Booking:</p>
            <ol className="list-decimal list-inside text-muted-foreground">
              <li>Susun detail booking ini</li>
              <li>Perpustakaan akan mengonfirmasi dalam 1x24 jam</li>
              <li>Buku siap diambil saat status "Ready"</li>
              <li>Ambil sebelum tanggal jatuh tempo</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            {/* Book info placeholder - in real app would fetch book details */}
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Buku yang akan dibooking</p>
              <code className="text-xs bg-background px-2 py-1 rounded">ID: {params.id}</code>
            </div>

            {/* Dates */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="borrowDate">Tanggal Pinjam *</Label>
                <Input
                  id="borrowDate"
                  type="date"
                  value={formData.borrowDate}
                  onChange={(e) => setFormData({ ...formData, borrowDate: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  required
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Kapan Anda akan mengambil buku
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Jatuh Tempo *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  min={formData.borrowDate || new Date().toISOString().split("T")[0]}
                  required
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Batas akhir pengembalian
                </p>
              </div>
            </div>

            {/* Borrower Info */}
            <div className="space-y-4">
              <h3 className="font-semibold border-b pb-2">Informasi Peminjam</h3>
              
              <div className="space-y-2">
                <Label htmlFor="borrowerName">Nama Lengkap *</Label>
                <Input
                  id="borrowerName"
                  placeholder="Contoh: Budi Santoso"
                  value={formData.borrowerName}
                  onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="borrowerEmail">Email (Opsional)</Label>
                  <Input
                    id="borrowerEmail"
                    type="email"
                    placeholder="budi@example.com"
                    value={formData.borrowerEmail}
                    onChange={(e) => setFormData({ ...formData, borrowerEmail: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="borrowerPhone">Telepon (Opsional)</Label>
                  <Input
                    id="borrowerPhone"
                    type="tel"
                    placeholder="0812..."
                    value={formData.borrowerPhone}
                    onChange={(e) => setFormData({ ...formData, borrowerPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentClass">Kelas (Opsional)</Label>
                <Input
                  id="studentClass"
                  placeholder="Contoh: X-A"
                  value={formData.studentClass}
                  onChange={(e) => setFormData({ ...formData, studentClass: e.target.value })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (Opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Ada keperluan khusus atau permintaan tambahan?"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4 border-t">
              <Link href="/perpustakaan">
                <Button variant="outline" type="button">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                {loading && (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Ajukan Booking
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
