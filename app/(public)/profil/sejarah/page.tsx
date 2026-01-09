"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { History, Award, Users, Building, BookOpen, Sparkles } from "lucide-react";

const timeline = [
  {
    year: "1970",
    title: "Pendirian Sekolah",
    description: "SD Negeri 1 didirikan sebagai salah satu sekolah dasar pertama di wilayah ini dengan 6 ruang kelas dan 120 siswa.",
  },
  {
    year: "1985",
    title: "Pengembangan Fasilitas",
    description: "Pembangunan gedung baru dengan tambahan 6 ruang kelas, perpustakaan, dan laboratorium IPA.",
  },
  {
    year: "1998",
    title: "Akreditasi A",
    description: "Sekolah berhasil meraih akreditasi A dari Badan Akreditasi Nasional Sekolah/Madrasah (BAN-S/M).",
  },
  {
    year: "2010",
    title: "Sekolah Adiwiyata",
    description: "Penghargaan sebagai Sekolah Adiwiyata tingkat nasional atas komitmen terhadap lingkungan hidup.",
  },
  {
    year: "2020",
    title: "Digitalisasi Pendidikan",
    description: "Implementasi pembelajaran digital dan sistem informasi sekolah terintegrasi.",
  },
  {
    year: "2024",
    title: "Era Baru",
    description: "Peluncuran website sekolah terpadu dengan sistem SPMB online dan zonasi digital.",
  },
];

const achievements = [
  { icon: Award, value: "50+", label: "Prestasi Akademik" },
  { icon: Users, value: "5000+", label: "Alumni" },
  { icon: Building, value: "54", label: "Tahun Berdiri" },
  { icon: BookOpen, value: "12", label: "Ekstrakurikuler" },
];

export default function SejarahPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-orange-500/5" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px]" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Badge variant="outline" className="px-4 py-1.5 rounded-full">
              <History className="h-3 w-3 mr-1" />
              Sejarah
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Perjalanan Kami
            </h1>
            <p className="text-lg text-muted-foreground">
              Lebih dari lima dekade mengabdi untuk pendidikan Indonesia, 
              mencetak generasi penerus bangsa yang berkualitas.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 -mt-8 relative z-10">
        <div className="container">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((item, index) => (
              <Card key={index} className="border-none shadow-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <item.icon className="h-6 w-6 text-amber-600" />
                  </div>
                  <p className="text-3xl font-bold">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl font-bold">Linimasa Sejarah</h2>
              <p className="text-muted-foreground">
                Tonggak penting dalam perjalanan SD Negeri 1
              </p>
            </div>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-500 via-primary to-blue-500" />

              <div className="space-y-8">
                {timeline.map((item, index) => (
                  <div
                    key={index}
                    className="relative pl-20 animate-in fade-in slide-in-from-left-4 duration-500"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Year badge */}
                    <div className="absolute left-0 top-0 h-16 w-16 rounded-full bg-white dark:bg-zinc-900 border-4 border-primary flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-primary">{item.year}</span>
                    </div>

                    <Card className="border-none shadow-md hover:shadow-lg transition-shadow bg-white dark:bg-zinc-900">
                      <CardContent className="p-6">
                        <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {item.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-16 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <Sparkles className="h-10 w-10 mx-auto text-amber-400" />
            <blockquote className="text-2xl md:text-3xl font-medium italic leading-relaxed">
              &quot;Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia.&quot;
            </blockquote>
            <p className="text-zinc-400">— Nelson Mandela</p>
          </div>
        </div>
      </section>
    </div>
  );
}
