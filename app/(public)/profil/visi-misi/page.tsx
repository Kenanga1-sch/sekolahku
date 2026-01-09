"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Lightbulb, Users, Award, BookOpen, Sparkles } from "lucide-react";

const visiMisi = {
  visi: "Menjadi sekolah dasar unggulan yang menghasilkan generasi cerdas, berkarakter, dan berakhlak mulia yang siap menghadapi tantangan global.",
  misi: [
    "Menyelenggarakan pendidikan berkualitas berbasis Kurikulum Merdeka",
    "Mengembangkan potensi akademik dan non-akademik peserta didik secara optimal",
    "Membangun karakter siswa yang berakhlak mulia dan berbudi pekerti luhur",
    "Menciptakan lingkungan belajar yang kondusif, aman, dan menyenangkan",
    "Meningkatkan kompetensi pendidik dan tenaga kependidikan secara berkelanjutan",
    "Menjalin kemitraan dengan orang tua dan masyarakat dalam pendidikan",
  ],
};

const values = [
  { icon: Heart, title: "Integritas", description: "Kejujuran dan konsistensi dalam setiap tindakan" },
  { icon: Lightbulb, title: "Inovasi", description: "Terus berinovasi dalam metode pembelajaran" },
  { icon: Users, title: "Kolaborasi", description: "Bekerja sama untuk mencapai tujuan bersama" },
  { icon: Award, title: "Keunggulan", description: "Berusaha memberikan yang terbaik dalam segala hal" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function VisiMisiPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px]" />
        
        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center space-y-6"
          >
            <Badge variant="outline" className="px-4 py-1.5 rounded-full">
              <Sparkles className="h-3 w-3 mr-1" />
              Tentang Kami
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Visi & Misi Sekolah
            </h1>
            <p className="text-lg text-muted-foreground">
              Landasan dan arah pengembangan SD Negeri 1 dalam mewujudkan 
              pendidikan berkualitas untuk generasi masa depan.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Visi Section */}
      <section className="py-16">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <Card className="border-none shadow-xl bg-gradient-to-br from-primary to-blue-600 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <CardContent className="p-8 md:p-12 relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Eye className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-bold">Visi</h2>
                </div>
                <p className="text-xl md:text-2xl font-medium leading-relaxed text-white/90">
                  "{visiMisi.visi}"
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Misi Section */}
      <section className="py-16 bg-white dark:bg-zinc-900">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="space-y-8"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Misi</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {visiMisi.misi.map((item, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex gap-4 p-6 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700"
                >
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{item}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="space-y-12"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold">Nilai-Nilai Kami</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Prinsip yang menjadi pedoman dalam setiap kegiatan pendidikan di sekolah kami.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((value, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full border-none shadow-lg hover:shadow-xl transition-shadow bg-white dark:bg-zinc-900">
                    <CardContent className="p-6 text-center space-y-4">
                      <div className="h-14 w-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                        <value.icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="font-bold text-lg">{value.title}</h3>
                      <p className="text-sm text-muted-foreground">{value.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
