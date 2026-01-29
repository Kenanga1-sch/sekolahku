"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { HandMetal, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface DocumentType {
  id: string;
  name: string;
  code: string;
}

interface PickupFormProps {
  alumniId: string;
  onPickupComplete?: () => void;
}

const RELATION_OPTIONS = [
  { value: "alumni", label: "Alumni (Sendiri)" },
  { value: "orang_tua", label: "Orang Tua" },
  { value: "wali", label: "Wali" },
  { value: "keluarga", label: "Keluarga" },
  { value: "lainnya", label: "Lainnya" },
];

export function PickupForm({ alumniId, onPickupComplete }: PickupFormProps) {
  const [open, setOpen] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [documentTypeId, setDocumentTypeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientRelation, setRecipientRelation] = useState("");
  const [recipientIdNumber, setRecipientIdNumber] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [pickupDate, setPickupDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await fetch("/api/alumni/document-types");
        const data = await response.json();
        setDocumentTypes(data);
      } catch (err) {
        console.error("Error fetching document types:", err);
      }
    };

    if (open) {
      fetchDocumentTypes();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!recipientName) {
      setError("Nama penerima wajib diisi");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/alumni/${alumniId}/pickups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTypeId: (documentTypeId && documentTypeId !== "unspecified") ? documentTypeId : null,
          recipientName,
          recipientRelation,
          recipientIdNumber,
          recipientPhone,
          pickupDate,
          notes,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to record pickup");
      }

      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
        onPickupComplete?.();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDocumentTypeId("");
    setRecipientName("");
    setRecipientRelation("");
    setRecipientIdNumber("");
    setRecipientPhone("");
    setPickupDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setError(null);
    setSuccess(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <HandMetal className="h-4 w-4 mr-1" />
          Catat Pengambilan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catat Pengambilan Dokumen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Pengambilan berhasil dicatat!</AlertDescription>
            </Alert>
          )}

          {/* Document Type */}
          <div className="space-y-2">
            <Label>Jenis Dokumen</Label>
            <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis dokumen (opsional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unspecified">Semua Dokumen</SelectItem>
                {documentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recipient Name */}
          <div className="space-y-2">
            <Label>Nama Penerima *</Label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Nama lengkap penerima"
            />
          </div>

          {/* Recipient Relation */}
          <div className="space-y-2">
            <Label>Hubungan dengan Alumni</Label>
            <Select value={recipientRelation} onValueChange={setRecipientRelation}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih hubungan" />
              </SelectTrigger>
              <SelectContent>
                {RELATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* ID Number */}
            <div className="space-y-2">
              <Label>Nomor KTP/Identitas</Label>
              <Input
                value={recipientIdNumber}
                onChange={(e) => setRecipientIdNumber(e.target.value)}
                placeholder="Nomor identitas"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label>Telepon</Label>
              <Input
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="Nomor telepon"
              />
            </div>
          </div>

          {/* Pickup Date */}
          <div className="space-y-2">
            <Label>Tanggal Pengambilan</Label>
            <Input
              type="date"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={loading}
            >
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={loading || !recipientName}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
