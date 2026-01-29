"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Eye, Heart, Lightbulb, Users, Award, BookOpen, Sparkles, Leaf, Globe, HandHeart, Smile } from "lucide-react";
import { useSchoolSettings } from "@/lib/contexts/school-settings-context";
import { Meteors } from "@/components/ui/meteors";

// Updated data from user
const visiMisi = {
  visi: "Terwujudnya peserta didik yang Agamis, Kolaboratif, dan Prestasi.",
  indikator: [
    {
      title: "Berakhlak",
      icon: Heart,
      description: "Peserta didik yang berakhlak dalam hubungannya dengan Tuhan Yang Maha Esa. Memahami ajaran agama dan kepercayaannya serta menerapkan pemahaman tersebut dalam kehidupan sehari-hari.",
      details: [
        "Akhlak beragama",
        "Akhlak pribadi",
        "Akhlak kepada manusia",
        "Akhlak kepada alam",
        "Akhlak bernegara"
      ]
    },
    {
      title: "Berkebinekaan Global",
      icon: Globe,
      description: "Peserta didik memiliki sikap terbuka dan inklusif terhadap perbedaan budaya, ras, agama, dan nilai-nilai yang berbeda dalam lingkungan yang semakin heterogen. Mempertahankan budaya luhur namun tetap terbuka dengan budaya lain."
    },
    {
      title: "Bergotong Royong",
      icon: Users,
      description: "Peserta didik memiliki kemampuan untuk bekerja bersama dengan orang lain disertai perasaan senang. Terampil berkoordinasi demi mencapai tujuan bersama dengan mempertimbangkan keragaman latar belakang."
    },
    {
      title: "Berprestasi",
      icon: Award,
      description: "Peserta didik menghasilkan sesuatu bermanfaat yang membanggakan baik untuk diri sendiri, orang lain, atau lembaga.",
      details: [
        "Berorientasi pada masa depan dan cita-cita",
        "Berorientasi pada keberhasilan",
        "Berani mengambil risiko",
        "Rasa tanggung jawab besar",
        "Menerima kritik sebagai umpan balik",
        "Kreatif dan inovatif"
      ]
    },
    {
      title: "Ramah Lingkungan Hidup",
      icon: Leaf,
      description: "Peserta didik memahami bahwa lingkungan hidup adalah kesatuan ruang dengan semua makhluk hidup. Memiliki kesadaran untuk terus berupaya berperilaku ramah terhadap lingkungan, menjadikan bumi tempat tinggal yang nyaman."
    }
  ],
  misi: [
    "Membiasakan peserta didik berakhlakul karimah dengan nilai-nilai religius dalam kehidupan sehari-hari baik di sekolah, di rumah dan di masyarakat.",
    "Membudayakan sikap peserta didik terbuka dan inklusif terhadap perbedaan budaya, ras, agama, dan nilai-nilai yang berbeda dalam lingkungan yang semakin heterogen.",
    "Membudayakan perilaku peserta didik bergotong royong dalam kehidupan sehari-hari.",
    "Membina, membimbing dan melatih peserta didik dibidang ilmu pengetahuan teknologi (Iptek), kesenian, keterampilan, kerohanian dan olahraga, yang berorientasi pada perolehan prestasi baik tingkat lokal maupun nasional.",
    "Membekali peserta didik yang bersikap dan menyayangi perilaku ramah terhadap lingkungan hidup."
  ],
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function VisiMisiPage() {
  const { settings } = useSchoolSettings();
  const schoolName = settings?.school_name || "UPTD SDN 1 Kenanga";

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
              Landasan dan arah pengembangan {schoolName} dalam mewujudkan 
              pendidikan berkualitas.
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
            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-blue-500 to-teal-500 transform scale-[0.80] bg-red-500 rounded-full blur-3xl" />
            <Card className="relative border-none shadow-xl bg-gray-900 border-gray-800 px-4 py-8 h-full overflow-hidden rounded-2xl flex flex-col justify-end items-start text-white">
              <Meteors number={20} />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
              <CardContent className="p-8 md:p-12 relative z-10 text-center w-full">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm border border-white/10">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold">Visi</h2>
                </div>
                <p className="text-2xl md:text-4xl font-bold leading-relaxed text-white drop-shadow-sm">
                  "{visiMisi.visi}"
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Indikator Visi Section */}
      <section className="py-16 bg-white dark:bg-zinc-900">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="space-y-12"
          >
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-bold flex items-center justify-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                Indikator Visi
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Nilai-nilai utama yang menjadi tolak ukur pencapaian visi sekolah.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visiMisi.indikator.map((item, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="h-full border-none shadow-lg hover:shadow-xl transition-shadow bg-zinc-50 dark:bg-zinc-800/50">
                    <CardContent className="p-6 space-y-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <item.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl mb-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                          {item.description}
                        </p>
                        {item.details && (
                          <ul className="space-y-1">
                            {item.details.map((detail, idx) => (
                              <li key={idx} className="text-sm font-medium flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Misi Section */}
      <section className="py-16 bg-zinc-50 dark:bg-zinc-950">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={containerVariants}
            className="space-y-8 max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-bold">Misi Sekolah</h2>
            </div>

            <div className="space-y-4">
              {visiMisi.misi.map((item, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className="flex gap-4 p-6 rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-100 dark:border-zinc-800 hover:border-primary/50 transition-colors"
                >
                  <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                    {index + 1}
                  </div>
                  <p className="text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                    {item}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
