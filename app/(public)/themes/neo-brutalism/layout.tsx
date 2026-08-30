"use client";

import React from "react";
import { useLanding } from "../../use-landing";
import Link from "next/link";
import { ArrowRight, BookOpen, Calendar, MapPin, Phone, Mail, Sparkles, CheckCircle2, ChevronRight, Bell } from "lucide-react";

export default function NeoBrutalismLayout() {
  const ctx = useLanding();
  if (!ctx.mounted) return null;

  const schoolName = ctx.settings?.school_name || "Sekolah Dasar";
  const schoolTagline = ctx.schoolTagline || "Membangun Generasi Unggul Berkarakter";
  const schoolDescription = ctx.schoolDescription || ctx.landingTexts?.profile_desc || "";

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-black font-sans selection:bg-[#FFE600] selection:text-black">
      {/* Neo-Brutalist Marquee / Top Alert Bar */}
      <div className="bg-[#FFE600] border-b-4 border-black py-2.5 px-4 font-mono text-xs sm:text-sm font-bold uppercase tracking-wider overflow-hidden whitespace-nowrap">
        <div className="inline-block animate-marquee">
          ⚡ PENDAFTARAN SPMB TAHUN AJARAN BARU TELAH DIBUKA! &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp; DAFTARKAN PUTRA-PUTRI ANDA SEKARANG &nbsp;&nbsp;&nbsp;✦&nbsp;&nbsp;&nbsp; SEKOLAH BERBASIS DIGITAL & KARAKTER
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-8 py-12 lg:py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#0055FF] text-white px-4 py-1.5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono text-xs font-bold uppercase">
              <Sparkles className="w-4 h-4 text-[#FFE600]" /> Resmi & Terakreditasi A
            </div>
            
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight leading-[1.05]">
              {schoolName}
            </h1>

            <p className="text-lg sm:text-xl font-medium text-zinc-800 max-w-2xl border-l-4 border-black pl-4 py-1 bg-zinc-100">
              {schoolTagline}
            </p>

            <p className="text-zinc-600 text-base leading-relaxed">
              {schoolDescription}
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link 
                href="/spmb/daftar"
                className="bg-[#FFE600] text-black font-bold px-6 py-3.5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2 uppercase tracking-wider text-sm"
              >
                Daftar SPMB <ArrowRight className="w-5 h-5" />
              </Link>
              <button 
                onClick={() => ctx.handleScrollTo("profil")}
                className="bg-white text-black font-bold px-6 py-3.5 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase tracking-wider text-sm"
              >
                Jelajahi Profil
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#FF3366] p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rotate-1 hover:rotate-0 transition-transform">
              <div className="bg-white border-3 border-black p-6 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="font-mono text-xs uppercase font-bold bg-[#FFE600] px-2 py-1 inline-block border-2 border-black">
                  Informasi Penting
                </div>
                <h3 className="text-xl font-black uppercase">Penerimaan Siswa Baru</h3>
                <p className="text-sm text-zinc-700">
                  Sistem seleksi transparan, adil, dan terintegrasi zonasi kelurahan secara real-time.
                </p>
                <div className="pt-2 border-t-2 border-dashed border-zinc-300 flex items-center justify-between">
                  <span className="text-xs font-mono font-bold">STATUS: BUKA</span>
                  <Link href="/spmb" className="text-xs font-black underline hover:text-[#0055FF]">
                    LIHAT DETAIL &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visi Misi Section */}
      <section id="profil" className="border-t-4 border-black bg-zinc-100 py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="bg-[#00FF66] text-black font-mono text-xs font-bold px-3 py-1 border-2 border-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Profil Sekolah
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">Visi & Misi Kami</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-[#FFE600] border-3 border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  V
                </div>
                <h3 className="text-2xl font-black uppercase">Visi Utama</h3>
                <p className="text-zinc-800 font-medium leading-relaxed bg-[#FFFDF9] p-4 border-2 border-black">
                  {ctx.schoolVisi}
                </p>
              </div>
            </div>

            <div className="bg-white p-8 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-[#FF3366] text-white border-3 border-black flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  M
                </div>
                <h3 className="text-2xl font-black uppercase">Misi Sekolah</h3>
                <ul className="space-y-2">
                  {ctx.schoolMisi.map((m: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-800 bg-[#FFFDF9] p-3 border-2 border-black font-medium">
                      <CheckCircle2 className="w-5 h-5 text-[#0055FF] shrink-0 mt-0.5" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Berita & Informasi */}
      <section className="border-t-4 border-black py-16 px-4 sm:px-8 bg-[#FFFDF9]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-3">
              <span className="bg-[#FF3366] text-white font-mono text-xs font-bold px-3 py-1 border-2 border-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                Warta Sekolah
              </span>
              <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">Berita & Pengumuman</h2>
            </div>
            <Link 
              href="/berita"
              className="inline-flex items-center gap-2 bg-[#FFE600] font-bold px-5 py-2.5 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all uppercase text-sm"
            >
              Semua Berita <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ctx.news?.slice(0, 3).map((item: any, idx: number) => {
              const bgColors = ["bg-[#FFE600]", "bg-[#00FF66]", "bg-[#FF3366] text-white"];
              const accentColor = bgColors[idx % bgColors.length];
              return (
                <div key={item.id || idx} className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between overflow-hidden">
                  <div className={`p-4 border-b-4 border-black ${accentColor} flex items-center justify-between font-mono text-xs font-bold uppercase`}>
                    <span>{item.category || "Informasi"}</span>
                    <span>{item.date || "Terbaru"}</span>
                  </div>
                  <div className="p-6 space-y-4">
                    <h3 className="text-xl font-black uppercase leading-snug line-clamp-2">{item.title}</h3>
                    <p className="text-zinc-600 text-sm line-clamp-3">{item.content || item.summary}</p>
                  </div>
                  <div className="p-6 pt-0">
                    <button 
                      onClick={() => ctx.setSelectedNews(item)}
                      className="w-full text-center bg-zinc-100 hover:bg-[#FFE600] text-black font-bold py-3 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all uppercase text-sm"
                    >
                      Baca Selengkapnya
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Layanan Mandiri Section */}
      <section className="border-t-4 border-black py-16 px-4 sm:px-8 bg-zinc-100">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="bg-[#0055FF] text-white font-mono text-xs font-bold px-3 py-1 border-2 border-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              Layanan Digital
            </span>
            <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">Layanan Mandiri</h2>
            <p className="text-zinc-700 font-medium">Akses cepat mutasi, cek saldo tabungan, dan informasi layanan terpadu.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/layanan/cek-saldo" className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all space-y-4">
              <div className="w-12 h-12 bg-[#FFE600] border-3 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                💰
              </div>
              <h3 className="text-xl font-black uppercase">Cek Saldo Tabungan</h3>
              <p className="text-sm text-zinc-600">Pantau tabungan siswa secara aman menggunakan NISN dan tanggal lahir.</p>
            </Link>

            <Link href="/layanan/mutasi-masuk" className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all space-y-4">
              <div className="w-12 h-12 bg-[#00FF66] border-3 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                📥
              </div>
              <h3 className="text-xl font-black uppercase">Mutasi Masuk</h3>
              <p className="text-sm text-zinc-600">Ajukan permohonan pindah masuk sekolah dengan pengisian formulir online.</p>
            </Link>

            <Link href="/layanan/mutasi-keluar" className="bg-white p-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all space-y-4">
              <div className="w-12 h-12 bg-[#FF3366] text-white border-3 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                📤
              </div>
              <h3 className="text-xl font-black uppercase">Mutasi Keluar</h3>
              <p className="text-sm text-zinc-600">Proses permohonan surat pindah sekolah keluar dengan transparan.</p>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer Neo-Brutalist */}
      <footer className="border-t-4 border-black bg-black text-white py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4 md:col-span-2">
            <h3 className="text-2xl font-black uppercase tracking-wider">{schoolName}</h3>
            <p className="text-zinc-400 text-sm max-w-sm">{schoolDescription}</p>
          </div>
          <div className="space-y-3 font-mono text-sm">
            <div className="font-bold text-[#FFE600] uppercase">Navigasi Utama</div>
            <ul className="space-y-2 text-zinc-300">
              <li><Link href="/" className="hover:underline">&gt; Beranda</Link></li>
              <li><Link href="/spmb" className="hover:underline">&gt; SPMB Online</Link></li>
              <li><Link href="/berita" className="hover:underline">&gt; Berita Sekolah</Link></li>
              <li><Link href="/kontak" className="hover:underline">&gt; Kontak Kami</Link></li>
            </ul>
          </div>
          <div className="space-y-3 font-mono text-sm">
            <div className="font-bold text-[#FFE600] uppercase">Kontak & Lokasi</div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              {ctx.settings?.school_address || "Alamat sekolah belum diatur."}
            </p>
            <p className="text-zinc-300 text-xs">Telp: {ctx.settings?.school_phone || "-"}</p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-zinc-800 text-center font-mono text-xs text-zinc-500 uppercase">
          &copy; {new Date().getFullYear()} {schoolName}. All Rights Reserved. Neo-Brutalism Theme.
        </div>
      </footer>
    </div>
  );
}
