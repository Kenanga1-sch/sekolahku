"use client";

import { QRCodeSVG } from "qrcode.react";
import type { GtkCard } from "./use-cetak-kartu";
import { CARD_W_MM, CARD_H_MM } from "@/lib/kartu-print-layout";
import { resolveUploadUrl } from "@/lib/upload-url";

interface PreviewProps {
  card: GtkCard;
  schoolName: string;
  schoolAddress: string;
  schoolLogo: string | null;
  showPhoto: boolean;
  showNIP: boolean;
  showBackSide: boolean;
  forPrint?: boolean;
  printSide?: "front" | "back" | "combined";
}

/** Identitas utama untuk QR/caption: NIP → NUPTK → id (staff tanpa NIP). */
export function gtkCardIdentity(card: GtkCard): string {
  return card.nip || card.nuptk || card.id;
}

export function KartuGtkPreview({ card, schoolName, schoolAddress, schoolLogo, showPhoto, showNIP, showBackSide, forPrint, printSide = "combined" }: PreviewProps) {
  const showFront = printSide !== "back";
  const showBack = showBackSide && printSide !== "front";
  return (
    <div className="inline-flex gap-1.5" style={forPrint ? { breakInside: "avoid", pageBreakInside: "avoid", height: `${CARD_H_MM}mm`, alignItems: "flex-start" } : undefined}>
      {showFront && <GtkCardFront card={card} schoolName={schoolName} schoolAddress={schoolAddress} schoolLogo={schoolLogo} showPhoto={showPhoto} showNIP={showNIP} forPrint={forPrint} />}
      {showBack && <GtkCardBack card={card} schoolName={schoolName} schoolAddress={schoolAddress} forPrint={forPrint} />}
    </div>
  );
}

// ===================== KARTU IDENTITAS GTK - FRONT =====================
interface FrontProps {
  card: GtkCard; schoolName: string; schoolAddress: string; schoolLogo: string | null; showPhoto: boolean; showNIP: boolean; forPrint?: boolean;
}

function GtkCardFront({ card, schoolName, schoolAddress, schoolLogo, showPhoto, showNIP, forPrint }: FrontProps) {
  const initials = card.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const identity = gtkCardIdentity(card);

  return (
    <div className="gtk-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800 flex flex-col" style={{ width: forPrint ? `${CARD_W_MM}mm` : "380px", height: forPrint ? `${CARD_H_MM}mm` : "250px", borderRadius: forPrint ? "2mm" : "10px", border: "1px solid #e2e8f0", breakInside: "avoid", pageBreakInside: "avoid" }}>
      <div className="relative px-3 py-2 flex items-center gap-2.5 overflow-hidden flex-shrink-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)" }}>
        <div className="relative h-12 w-12 flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: schoolLogo ? "white" : "linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.1) 100%)", border: "1.5px solid rgba(251,191,36,0.4)", borderRadius: "8px" }}>
          {schoolLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={schoolLogo} alt="Logo Sekolah" width={40} height={40} className="h-10 w-10 object-contain" />
          ) : <span className="text-xs font-bold text-slate-300">SD</span>}
        </div>
        <div className="relative flex-1 min-w-0 max-w-[220px] z-10">
          <h2 className="font-bold uppercase tracking-wider leading-tight" style={{ fontSize: "11.5px", color: "#fbbf24", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{schoolName}</h2>
          <p className="leading-[1.2] mt-0.5 pr-2" style={{ fontSize: "7.5px", color: "rgba(203,213,225,0.9)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{schoolAddress}</p>
        </div>
        <div className="relative z-10 text-right flex-shrink-0">
          <p className="font-bold uppercase tracking-widest leading-tight" style={{ fontSize: "8px", color: "#fbbf24" }}>Kartu Identitas</p>
          <p className="font-semibold uppercase tracking-wider leading-tight" style={{ fontSize: "7.5px", color: "rgba(203,213,225,0.95)" }}>GTK</p>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className={`flex-1 ${forPrint ? "p-1.5" : "p-3"} flex ${forPrint ? "gap-2.5" : "gap-3"} relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #64748b 1px, transparent 0)", backgroundSize: "16px 16px" }} />
          {showPhoto && (
            <div className="flex-shrink-0 relative">
              <div className="relative" style={{ width: forPrint ? "54px" : "60px", height: forPrint ? "70px" : "78px", padding: "3px", background: "linear-gradient(135deg, #e2e8f0 0%, #f1f5f9 100%)", borderRadius: "4px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-l-2 border-t-2 border-amber-400 rounded-tl" />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-r-2 border-t-2 border-amber-400 rounded-tr" />
                <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-l-2 border-b-2 border-amber-400 rounded-bl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-r-2 border-b-2 border-amber-400 rounded-br" />
                <div className="w-full h-full overflow-hidden rounded-sm bg-slate-50">
                  {card.photoUrl ? <img src={resolveUploadUrl(card.photoUrl)} alt={card.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextElementSibling?.classList.remove("hidden"); }} /> : null}
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${card.photoUrl ? "hidden" : ""}`}><span className="font-bold text-black" style={{ fontSize: forPrint ? "16px" : "18px" }}>{initials}</span></div>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
            <div className="mb-2">
              <p className="uppercase tracking-widest font-semibold leading-none text-[7.5px] text-black">Nama</p>
              <h3
                className="font-bold text-slate-800"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.3px",
                  wordBreak: "break-word",
                  lineHeight: "1.15",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {card.name}
              </h3>
            </div>
            <div className="grid gap-y-1 leading-tight" style={{ gridTemplateColumns: "max-content 4px auto" }}>
              {showNIP && card.nip && (
                <>
                  <p className="uppercase tracking-widest font-semibold text-[7.5px] text-black">NIP</p>
                  <p className="text-[7.5px] text-black">:</p>
                  <p className="font-mono font-semibold text-[9.5px] text-black">{card.nip}</p>
                </>
              )}
              {card.nuptk && (
                <>
                  <p className="uppercase tracking-widest font-semibold text-[7.5px] text-black">NUPTK</p>
                  <p className="text-[7.5px] text-black">:</p>
                  <p className="font-mono text-[9.5px] text-black">{card.nuptk}</p>
                </>
              )}
              <p className="uppercase tracking-widest font-semibold text-[7.5px] text-black">Jabatan</p>
              <p className="text-[7.5px] text-black">:</p>
              <p className="text-[9.5px] text-black">{card.jobType || "-"}</p>
              <p className="uppercase tracking-widest font-semibold text-[7.5px] text-black">Status</p>
              <p className="text-[7.5px] text-black">:</p>
              <p className="text-[9.5px] text-black">{card.employmentStatus || "-"}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center relative" style={{ width: forPrint ? "30%" : "32%", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", borderLeft: "1px solid #e2e8f0" }}>
          <div className="absolute top-2 left-2 w-3 h-3 border-l border-t border-slate-300" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-r border-b border-slate-300" />
          <div className="bg-white p-2 rounded-lg border border-slate-200"><QRCodeSVG value={identity} size={forPrint ? 76 : 90} level="H" includeMargin={false} /></div>
          <div className="mt-1 text-center">
            <p className="uppercase tracking-widest font-semibold text-[7.5px] text-black">Pindai</p>
            <p className="font-mono font-bold mt-0.5 px-2 py-0.5 rounded" style={{ fontSize: "8px", color: "#000000", background: "#e2e8f0" }}>{identity.slice(-8).toUpperCase()}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-3 flex-shrink-0" style={{ height: "18px", background: "linear-gradient(to right, #fbbf24, #f59e0b)" }}>
        <p className="font-semibold text-[8.5px] text-amber-950">Identitas resmi pegawai sekolah</p>
        <p className="font-mono font-bold text-[8.5px] text-amber-950">ID: {identity.slice(-8).toUpperCase()}</p>
      </div>
    </div>
  );
}

// ===================== KARTU IDENTITAS GTK - BACK =====================
interface BackProps { card: GtkCard; schoolName: string; schoolAddress: string; forPrint?: boolean; }

function GtkCardBack({ card, schoolName, schoolAddress, forPrint }: BackProps) {
  const identity = gtkCardIdentity(card);
  const rules = [
    `Kartu ini adalah identitas resmi pegawai ${schoolName}.`,
    "Wajib dibawa saat bertugas di lingkungan sekolah.",
    "Jika hilang segera melapor ke pihak sekolah.",
    "Tidak boleh dipindahtangankan.",
  ];
  return (
    <div className="gtk-card relative overflow-hidden bg-white flex-shrink-0 text-slate-800 flex flex-col" style={{ width: forPrint ? `${CARD_W_MM}mm` : "380px", height: forPrint ? `${CARD_H_MM}mm` : "250px", borderRadius: forPrint ? "2mm" : "10px", border: "1px solid #e2e8f0" }}>
      <div className="relative px-3 py-2 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ height: "28px", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)" }}>
        <p className="text-white font-bold uppercase tracking-wider text-[9.5px]">{schoolName}</p>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 p-2 flex flex-col justify-center border-r border-slate-100">
          <p className="uppercase tracking-widest font-bold mb-0.5 text-[7.5px] text-black">Ketentuan Penggunaan</p>
          <ul className="space-y-0.5">{rules.map((rule, idx) => (<li key={idx} className="flex items-start gap-1 text-[8.5px] text-black leading-snug"><span className="text-amber-500 font-bold">•</span><span>{rule}</span></li>))}</ul>
          <div
            className="mt-1 pt-1 border-t border-dashed border-slate-100 text-[7.5px] text-black"
            style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            Alamat sekolah: {schoolAddress}
          </div>
        </div>
        <div className="flex flex-col items-center justify-center px-2 bg-slate-50" style={{ width: "45%" }}>
          <div className="border border-slate-200 p-1.5 bg-white rounded-lg"><QRCodeSVG value={identity} size={forPrint ? 118 : 150} level="H" /></div>
          <span className="text-[6.5px] uppercase tracking-widest font-bold text-black mt-1">GTK</span>
        </div>
      </div>
      <div className="flex items-center justify-center text-white text-[8.5px] flex-shrink-0" style={{ height: "18px", background: "linear-gradient(to right, #0f172a, #1e293b)" }}>
        <span>{card.category === "guru" ? "Guru" : card.category === "kepsek" ? "Kepala Sekolah" : card.category === "staff" ? "Tenaga Administrasi" : card.category === "support" ? "Tenaga Support" : "GTK"} · {identity.slice(-8).toUpperCase()}</span>
      </div>
    </div>
  );
}
