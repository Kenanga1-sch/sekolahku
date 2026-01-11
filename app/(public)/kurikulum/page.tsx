"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    BookOpen,
    Trophy,
    Music,
    Palette,
    Footprints,
    Cpu,
    BookHeart,
    Volleyball,
    Mic2,
    Globe,
    Users,
    Calendar,
} from "lucide-react";

const kurikulumData = {
    description: `Kami menerapkan Kurikulum Merdeka yang berfokus pada pengembangan karakter,
  kompetensi, dan keterampilan abad 21. Pembelajaran dirancang untuk mengembangkan
  kreativitas, berpikir kritis, kolaborasi, dan komunikasi siswa.`,
    features: [
        "Pembelajaran berbasis proyek (Project-Based Learning)",
        "Asesmen yang berorientasi pada perkembangan siswa",
        "Penguatan literasi dan numerasi",
        "Pendidikan karakter Pancasila",
        "Integrasi teknologi dalam pembelajaran",
        "Pembelajaran yang berpusat pada siswa",
    ],
    subjects: [
        { name: "Bahasa Indonesia", icon: BookOpen },
        { name: "Matematika", icon: Cpu },
        { name: "IPA & IPS", icon: Globe },
        { name: "Pendidikan Agama", icon: BookHeart },
        { name: "PPKN", icon: Users },
        { name: "Bahasa Inggris", icon: Globe },
        { name: "Seni & Budaya", icon: Palette },
        { name: "PJOK", icon: Footprints },
    ],
};

const ekstraData = [
    {
        name: "Pramuka",
        description: "Pengembangan karakter, kepemimpinan, dan keterampilan hidup",
        icon: Trophy,
        schedule: "Jumat, 14:00 - 16:00",
        category: "Wajib",
    },
    {
        name: "Futsal",
        description: "Olahraga tim yang melatih kerjasama dan kebugaran",
        icon: Volleyball,
        schedule: "Selasa, 14:00 - 16:00",
        category: "Olahraga",
    },
    {
        name: "Seni Tari",
        description: "Melestarikan tari tradisional Indonesia",
        icon: Music,
        schedule: "Rabu, 14:00 - 16:00",
        category: "Kesenian",
    },
    {
        name: "Paduan Suara",
        description: "Mengembangkan bakat menyanyi dan musikalitas",
        icon: Mic2,
        schedule: "Kamis, 14:00 - 16:00",
        category: "Kesenian",
    },
    {
        name: "Robotik",
        description: "Belajar programming dan merakit robot",
        icon: Cpu,
        schedule: "Senin, 14:00 - 16:00",
        category: "STEM",
    },
    {
        name: "English Club",
        description: "Meningkatkan kemampuan bahasa Inggris",
        icon: Globe,
        schedule: "Selasa, 14:00 - 15:30",
        category: "Akademik",
    },
    {
        name: "Seni Lukis",
        description: "Eksplorasi kreativitas melalui lukisan",
        icon: Palette,
        schedule: "Rabu, 14:00 - 15:30",
        category: "Kesenian",
    },
    {
        name: "Tahfidz",
        description: "Program hafalan Al-Quran",
        icon: BookHeart,
        schedule: "Senin-Jumat, 06:30 - 07:00",
        category: "Keagamaan",
    },
];

const categoryColors: Record<string, string> = {
    Wajib: "bg-red-100 text-red-700",
    Olahraga: "bg-blue-100 text-blue-700",
    Kesenian: "bg-purple-100 text-purple-700",
    STEM: "bg-green-100 text-green-700",
    Akademik: "bg-amber-100 text-amber-700",
    Keagamaan: "bg-emerald-100 text-emerald-700",
};

export default function KurikulumPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="container mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                        <BookOpen className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        Kurikulum & Ekstrakurikuler
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Program pembelajaran dan kegiatan pengembangan diri yang kami tawarkan
                    </p>
                </div>

                {/* Tabs */}
                <Tabs defaultValue="kurikulum" className="max-w-5xl mx-auto">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="kurikulum">Kurikulum</TabsTrigger>
                        <TabsTrigger value="ekstrakurikuler">Ekstrakurikuler</TabsTrigger>
                    </TabsList>

                    {/* Kurikulum Tab */}
                    <TabsContent value="kurikulum" className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5 text-primary" />
                                    Kurikulum Merdeka
                                </CardTitle>
                                <CardDescription className="text-base leading-relaxed">
                                    {kurikulumData.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <h4 className="font-semibold mb-4">Fitur Utama:</h4>
                                <ul className="grid md:grid-cols-2 gap-3">
                                    {kurikulumData.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <span className="text-primary">✓</span>
                                            <span>{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Mata Pelajaran</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {kurikulumData.subjects.map((subject, index) => (
                                        <div
                                            key={index}
                                            className="flex flex-col items-center p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                                        >
                                            <div className="p-3 rounded-full bg-primary/10 text-primary mb-3">
                                                <subject.icon className="h-6 w-6" />
                                            </div>
                                            <span className="text-sm font-medium text-center">{subject.name}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Ekstrakurikuler Tab */}
                    <TabsContent value="ekstrakurikuler">
                        <div className="grid md:grid-cols-2 gap-6">
                            {ekstraData.map((ekstra, index) => (
                                <Card key={index} className="hover:shadow-lg transition-shadow">
                                    <CardHeader>
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                                                    <ekstra.icon className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-lg">{ekstra.name}</CardTitle>
                                                </div>
                                            </div>
                                            <Badge className={categoryColors[ekstra.category]}>
                                                {ekstra.category}
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-muted-foreground">{ekstra.description}</p>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Calendar className="h-4 w-4" />
                                            <span>{ekstra.schedule}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
