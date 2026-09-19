"use client";

import Link from "next/link";
import {
  ArrowRightLeft,
  MessageSquareHeart,
  ArrowRight,
} from "lucide-react";
import { Reveal } from "@/components/public/motion";

const categories = [
  {
    title: "Mutasi",
    desc: "Permohonan pindah masuk dan cek status permohonan.",
    href: "/layanan/mutasi",
    icon: ArrowRightLeft,
  },
  {
    title: "Kritik, Saran & Pengaduan",
    desc: "Sampaikan masukan atau laporkan perundungan. Bisa anonim.",
    href: "/layanan/kritik-saran-pengaduan",
    icon: MessageSquareHeart,
  },
];

export default function LayananPage() {
  return (
    <div className="flex flex-col bg-public-bg min-h-[70dvh]">
      <section className="py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4">
          <Reveal>
            <h1 className="text-3xl md:text-4xl font-bold text-[#1a2e1a] mb-3">Layanan Sekolah</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-[#4b6b4b] mb-10 max-w-[55ch]">
              Layanan digital untuk siswa, orang tua, dan warga sekolah. Semua bisa diakses tanpa perlu datang ke sekolah.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {categories.map((category, i) => (
              <Reveal key={category.title} delay={i * 0.05}>
                <Link
                  href={category.href}
                  className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-public-border shadow-sm hover:border-[#065F46]/30 hover:shadow-md transition-all active:scale-[0.98] h-full"
                >
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-[#A7F3D0] text-[#065F46] flex items-center justify-center group-hover:bg-[#065F46] group-hover:text-white transition-colors">
                    <category.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-[#1a2e1a] text-sm">{category.title}</h2>
                    <p className="text-xs text-[#4b6b4b] mt-1 leading-relaxed">{category.desc}</p>
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
