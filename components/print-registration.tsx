"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Printer, GraduationCap, MapPin, Phone, Mail, Calendar, User } from "lucide-react";
import type { SPMBRegistrant } from "@/types";

interface PrintRegistrationProps {
    registrant: SPMBRegistrant;
    schoolName?: string;
    schoolAddress?: string;
}

function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
        pending: "Menunggu Verifikasi",
        verified: "Terverifikasi",
        accepted: "Diterima",
        rejected: "Ditolak",
    };
    return labels[status] || status;
}

function getStatusColor(status: string) {
    const colors: Record<string, string> = {
        pending: "#f59e0b",
        verified: "#3b82f6",
        accepted: "#22c55e",
        rejected: "#ef4444",
    };
    return colors[status] || "#6b7280";
}

export function PrintRegistrationCard({ registrant, schoolName = "SD Negeri 1", schoolAddress }: PrintRegistrationProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bukti Pendaftaran - ${registrant.registration_number}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              padding: 20mm;
              background: white;
            }
            .card {
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              padding: 24px;
              max-width: 180mm;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 24px;
              padding-bottom: 16px;
              border-bottom: 2px solid #e5e7eb;
            }
            .logo {
              font-size: 32px;
              margin-bottom: 8px;
            }
            .school-name {
              font-size: 20px;
              font-weight: bold;
              color: #1e40af;
            }
            .school-address {
              font-size: 12px;
              color: #6b7280;
              margin-top: 4px;
            }
            .title {
              font-size: 16px;
              font-weight: 600;
              margin-top: 12px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .reg-number {
              font-size: 24px;
              font-weight: bold;
              font-family: monospace;
              margin: 16px 0;
              color: #1e40af;
              background: #eff6ff;
              padding: 8px 16px;
              border-radius: 8px;
              display: inline-block;
            }
            .status {
              display: inline-block;
              padding: 6px 16px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              color: white;
              background: ${getStatusColor(registrant.status)};
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin-top: 24px;
            }
            .info-item {
              padding: 12px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .info-label {
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 14px;
              font-weight: 500;
            }
            .full-width {
              grid-column: span 2;
            }
            .footer {
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px dashed #e5e7eb;
              display: flex;
              justify-content: space-between;
              font-size: 11px;
              color: #6b7280;
            }
            .qr-placeholder {
              width: 80px;
              height: 80px;
              background: #f3f4f6;
              border: 1px dashed #d1d5db;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: #9ca3af;
            }
            @media print {
              body { padding: 10mm; }
              .card { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="logo">🎓</div>
              <div class="school-name">${schoolName}</div>
              ${schoolAddress ? `<div class="school-address">${schoolAddress}</div>` : ""}
              <div class="title">Kartu Bukti Pendaftaran</div>
              <div class="reg-number">${registrant.registration_number}</div>
              <div><span class="status">${getStatusLabel(registrant.status)}</span></div>
            </div>
            
            <div class="info-grid">
              <div class="info-item full-width">
                <div class="info-label">Nama Lengkap</div>
                <div class="info-value">${registrant.student_name || registrant.full_name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">NIK</div>
                <div class="info-value">${registrant.student_nik || registrant.nik || "-"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Jenis Kelamin</div>
                <div class="info-value">${registrant.gender === "L" ? "Laki-laki" : "Perempuan"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Tempat/Tanggal Lahir</div>
                <div class="info-value">${registrant.birth_place || "-"}, ${registrant.birth_date ? new Date(registrant.birth_date).toLocaleDateString("id-ID") : "-"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Asal Sekolah</div>
                <div class="info-value">${registrant.previous_school || "-"}</div>
              </div>
              <div class="info-item full-width">
                <div class="info-label">Nama Orang Tua/Wali</div>
                <div class="info-value">${registrant.parent_name || "-"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">No. Telepon</div>
                <div class="info-value">${registrant.parent_phone || "-"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${registrant.parent_email || "-"}</div>
              </div>
              <div class="info-item full-width">
                <div class="info-label">Alamat</div>
                <div class="info-value">${registrant.address || registrant.home_address || "-"}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Jarak ke Sekolah</div>
                <div class="info-value">${registrant.distance_to_school?.toFixed(2) || "-"} km</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status Zonasi</div>
                <div class="info-value">${(registrant.is_in_zone || registrant.is_within_zone) ? "Dalam Zona ✓" : "Luar Zona"}</div>
              </div>
            </div>
            
            <div class="footer">
              <div>
                <strong>Tanggal Daftar:</strong> ${new Date(registrant.created).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              <div>
                Dicetak: ${new Date().toLocaleDateString("id-ID")}
              </div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
        printWindow.document.close();
    };

    return (
        <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak Kartu
        </Button>
    );
}
