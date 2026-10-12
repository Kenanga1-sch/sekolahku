"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyBookings, cancelBooking } from "@/lib/library/booking";
import { showSuccess, showError } from "@/lib/toast";

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const result = await getMyBookings();
      setBookings(result.items || []);
    } catch (error) {
      console.error("Failed to load bookings:", error);
      showError("Gagal memuat booking Anda");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Yakin ingin membatalkan booking ini?")) return;

    try {
      await cancelBooking(id);
      showSuccess("Booking berhasil dibatalkan");
      loadBookings();
    } catch (error: any) {
      console.error("Cancel error:", error);
      showError(error?.response?.data?.error || "Gagal membatalkan booking");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-300">Pending</Badge>;
      case "confirmed":
        return <Badge variant="secondary">Dikonfirmasi</Badge>;
      case "ready":
        return <Badge variant="default" className="bg-green-600">Siap Diambil</Badge>;
      case "completed":
        return <Badge variant="outline" className="text-green-700 bg-green-50 border-green-300">Selesai</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Dibatalkan</Badge>;
      case "expired":
        return <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">Kadaluarsa</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Memuat booking Anda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/katalog-buku" className="shrink-0">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">Booking Saya</h1>
          <p className="text-muted-foreground">Kelola pemesanan buku perpustakaan Anda</p>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{bookings.length}</div>
              <div className="text-muted-foreground">Total Booking</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {bookings.filter(b => b.status === 'pending').length}
              </div>
              <div className="text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {bookings.filter(b => b.status === 'ready' || b.status === 'completed').length}
              </div>
              <div className="text-muted-foreground">Ready/Selesai</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Belum ada booking</h3>
            <p className="text-muted-foreground mb-4">Mulai booking buku dari katalog perpustakaan</p>
            <Link href="/katalog-buku">
              <Button>Browse Katalog Buku</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Book Info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{booking.item?.title || "Buku"}</h3>
                      {getStatusBadge(booking.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="block text-xs">Tanggal Pinjam</span>
                        {new Date(booking.borrowDate).toLocaleDateString('id-ID')}
                      </div>
                      <div>
                        <span className="block text-xs">Jatuh Tempo</span>
                        {new Date(booking.dueDate).toLocaleDateString('id-ID')}
                      </div>
                      <div>
                        <span className="block text-xs">Nama Peminjam</span>
                        {booking.borrowerName}
                      </div>
                      {booking.notes && (
                        <div>
                          <span className="block text-xs">Catatan</span>
                          {booking.notes.substring(0, 30)}...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleCancel(booking.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Batalkan
                      </Button>
                    )}
                    {booking.status === 'ready' && (
                      <Link href={`/katalog-buku/detail?id=${booking.assetId}`} className="w-full sm:w-auto">
                        <Button size="sm" className="w-full sm:w-auto">
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Detail Buku
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
