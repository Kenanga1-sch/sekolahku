"use client";

import Link from "next/link";
import {
  Wallet,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/public/motion";

const services = [
  {
    title: "Cek Saldo Tabungan",
    desc: "Lihat saldo tabungan siswa dengan NISN dan tanggal lahir.",
    href: "/layanan/cek-saldo",
    icon: Wallet,
  },
  {
    title: "Rekening Koran Tabungan",
    desc: "Lihat riwayat transaksi tabungan siswa.",
    href: "/tabungan/rekening-koran/verify",
    icon: BookOpen,
  },
];

export default function LayananTabunganPage() {
  return (
    <div className="flex flex-col bg-public-bg min-h-[70dvh]">
      <section className="py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a2e1a] mb-3">Layanan Tabungan</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">
              Periksa saldo dan riwayat transaksi tabungan siswa secara mandiri.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {services.map((service, i) => (
              <Reveal key={service.title} delay={i * 0.05}>
                <Link
                  href={service.href}
                  className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-public-border shadow-sm hover:border-[#065F46]/30 hover:shadow-md transition-all active:scale-[0.98] h-full"
                >
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#A7F3D0] text-[#065F46] flex items-center justify-center group-hover:bg-[#065F46] group-hover:text-white transition-colors">
                    <service.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-[#1a2e1a] text-sm">{service.title}</h2>
                    <p className="text-xs text-[#4b6b4b] mt-1 leading-relaxed">{service.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-[#4b6b4b] shrink-0 mt-1 group-hover:translate-x-1 group-hover:text-[#065F46] transition-all" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
