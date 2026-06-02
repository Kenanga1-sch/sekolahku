"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, CalendarPlus } from "lucide-react";
import { goGet, goPost } from "@/lib/api-client";

interface ClassOption {
  id: string;
  name: string;
}

export default function BuatSesiPresensiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);

  // Form state
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    // Fetch available classes
    const fetchClasses = async () => {
      try {
        const response: any = await goGet("/api/classes");
        const data = response?.data || response;
        setClasses(data);
      } catch (error) {
        console.error("Error fetching classes:", error);
      }
    };
    fetchClasses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!className) {
      setError("Pilih kelas terlebih dahulu");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data: any = await goPost("/api/attendance/sessions", {
        className,
        teacherName,
        notes,
      });

      router.push(`/presensi/sesi/detail?id=${data.id || data.data?.id}`);
    } catch (err: any) {
      if (err.status === 409) {
        // Session already exists
        setError("Sesi untuk kelas ini sudah ada hari ini");
        if (err.data?.existing) {
          setTimeout(() => {
            router.push(`/presensi/sesi/detail?id=${err.data.existing.id}`);
          }, 2000);
        }
      } else {
        setError(err.message || "Terjadi kesalahan");
      }
    } finally {
      setLoading(false);
    }
  };

  // Default class options if no API
  const defaultClasses = [
    "1A", "1B", "2A", "2B", "3A", "3B",
    "4A", "4B", "5A", "5B", "6A", "6B",
  ];

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/presensi">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarPlus className="h-6 w-6 text-primary" />
            Buat Sesi Presensi
          </h1>
          <p className="text-muted-foreground">
            Buat sesi presensi baru untuk hari ini
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Detail Sesi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="className">Kelas *</Label>
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas" />
                </SelectTrigger>
                <SelectContent>
                  {(classes.length > 0
                    ? classes.map((c) => c.name)
                    : defaultClasses
                  ).map((cls) => (
                    <SelectItem key={cls} value={cls}>
                      Kelas {cls}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teacherName">Nama Guru (Opsional)</Label>
              <Input
                id="teacherName"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="Nama wali kelas"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (Opsional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-4">
              <Link href="/presensi">
                <Button type="button" variant="outline">
                  Batal
                </Button>
              </Link>
              <Button type="submit" disabled={loading || !className}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Membuat...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Buat Sesi
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

