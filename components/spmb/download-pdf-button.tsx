"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RegistrantDocument } from "./registrant-pdf"; // Adjust path
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import QRCode from "qrcode";

export function DownloadPdfButton({ registrant }: { registrant: any }) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Generate QR Code as Data URL
    const url = `${window.location.origin}/spmb/tracking?id=${registrant.registrationNumber}`;
    QRCode.toDataURL(url, { width: 200, margin: 0 }, (err, url) => {
      if (!err) setQrCodeUrl(url);
    });
  }, [registrant.registrationNumber]);

  if (!isClient || !qrCodeUrl) {
    return (
      <Button disabled variant="outline" className="gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan PDF...
      </Button>
    );
  }

  // Enriched data with QR
  const pdfData = { ...registrant, qrCodeUrl };

  return (
    <PDFDownloadLink
      document={<RegistrantDocument data={pdfData} />}
      fileName={`Bukti_Pendaftaran_${registrant.registrationNumber}.pdf`}
    >
      {({ blob, url, loading, error }) => (
        <Button disabled={loading} className="gap-2 bg-blue-700 hover:bg-blue-800 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {loading ? "Generating..." : "Download Bukti PDF"}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
