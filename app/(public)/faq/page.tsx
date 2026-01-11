"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, HelpCircle, GraduationCap, FileText, MapPin, Calendar, Phone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const faqCategories = [
    {
        id: "spmb",
        title: "Pendaftaran SPMB",
        icon: FileText,
        questions: [
            {
                q: "Bagaimana cara mendaftar siswa baru?",
                a: "Kunjungi halaman SPMB dan klik tombol 'Daftar Sekarang'. Isi formulir pendaftaran dengan lengkap, unggah dokumen yang diperlukan, dan submit. Anda akan mendapatkan nomor pendaftaran untuk tracking status."
            },
            {
                q: "Dokumen apa saja yang diperlukan untuk pendaftaran?",
                a: "Dokumen yang diperlukan: 1) Scan/foto KK (Kartu Keluarga), 2) Scan/foto Akta Kelahiran, 3) Pas foto terbaru ukuran 3x4, 4) Rapor semester terakhir jika ada. Dokumen harus dalam format JPG, PNG, atau PDF dengan ukuran maksimal 2MB."
            },
            {
                q: "Kapan periode pendaftaran dibuka?",
                a: "Periode pendaftaran biasanya dibuka sekitar bulan Januari-Maret setiap tahun ajaran baru. Pantau terus website kami atau ikuti akun sosial media sekolah untuk informasi terbaru."
            },
            {
                q: "Bagaimana cara mengecek status pendaftaran?",
                a: "Buka halaman 'Cek Status' di menu SPMB, masukkan nomor pendaftaran Anda. Status akan ditampilkan: Pending, Terverifikasi, Diterima, atau Ditolak."
            },
            {
                q: "Apakah ada sistem zonasi?",
                a: "Ya, kami menerapkan sistem zonasi. Calon siswa yang berdomisili dalam radius tertentu dari sekolah akan mendapat prioritas. Jarak dihitung otomatis berdasarkan alamat yang diinput saat pendaftaran."
            }
        ]
    },
    {
        id: "akademik",
        title: "Akademik & Kurikulum",
        icon: GraduationCap,
        questions: [
            {
                q: "Kurikulum apa yang digunakan?",
                a: "Kami menggunakan Kurikulum Merdeka yang mengutamakan pembelajaran berbasis proyek, pengembangan karakter, dan keterampilan abad 21."
            },
            {
                q: "Apa saja kegiatan ekstrakurikuler yang tersedia?",
                a: "Tersedia berbagai ekskul: Pramuka, Seni Tari, Seni Musik, Futsal, Bulu Tangkis, Renang, Robotik, English Club, dan Tahfidz Quran."
            },
            {
                q: "Bagaimana jam belajar di sekolah?",
                a: "Jam belajar dimulai pukul 07:00 - 14:00 WIB untuk hari Senin-Kamis, dan 07:00 - 11:30 WIB untuk hari Jumat."
            }
        ]
    },
    {
        id: "biaya",
        title: "Biaya & Pembayaran",
        icon: Calendar,
        questions: [
            {
                q: "Berapa biaya pendaftaran?",
                a: "Pendaftaran online melalui website GRATIS tanpa biaya. Biaya hanya dikenakan setelah siswa diterima."
            },
            {
                q: "Bagaimana sistem pembayaran SPP?",
                a: "Pembayaran SPP dilakukan setiap bulan melalui transfer bank atau payment gateway. Detail rekening akan diberikan setelah siswa diterima."
            },
            {
                q: "Apakah ada program beasiswa?",
                a: "Ya, kami menyediakan beasiswa untuk siswa berprestasi dan siswa dari keluarga kurang mampu. Informasi lebih lanjut hubungi bagian Tata Usaha."
            }
        ]
    },
    {
        id: "lokasi",
        title: "Lokasi & Kontak",
        icon: MapPin,
        questions: [
            {
                q: "Dimana lokasi sekolah?",
                a: "Anda dapat melihat lokasi lengkap di halaman Kontak. Silakan kunjungi untuk melihat peta dan petunjuk arah."
            },
            {
                q: "Bagaimana cara menghubungi sekolah?",
                a: "Hubungi kami melalui telepon di jam kerja (07:00-15:00), atau kirim email. Informasi kontak lengkap tersedia di halaman Kontak."
            }
        ]
    }
];

export default function FAQPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredCategories = faqCategories.map(category => ({
        ...category,
        questions: category.questions.filter(
            faq =>
                faq.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
                faq.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(category => category.questions.length > 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            <div className="container max-w-4xl mx-auto px-4 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
                        <HelpCircle className="h-8 w-8" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight mb-4">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Temukan jawaban untuk pertanyaan yang sering diajukan tentang pendaftaran, akademik, dan informasi sekolah lainnya.
                    </p>
                </div>

                {/* Search */}
                <div className="relative max-w-xl mx-auto mb-12">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        placeholder="Cari pertanyaan..."
                        className="pl-12 h-14 text-lg rounded-xl"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* FAQ Categories */}
                <div className="space-y-8">
                    {filteredCategories.length === 0 ? (
                        <Card className="text-center py-12">
                            <CardContent>
                                <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                                <p className="text-lg font-medium mb-2">Tidak ada hasil</p>
                                <p className="text-muted-foreground">
                                    Coba kata kunci lain atau lihat semua pertanyaan
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        filteredCategories.map((category) => (
                            <Card key={category.id}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <category.icon className="h-5 w-5" />
                                        </div>
                                        {category.title}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Accordion type="single" collapsible className="space-y-2">
                                        {category.questions.map((faq, index) => (
                                            <AccordionItem
                                                key={index}
                                                value={`${category.id}-${index}`}
                                                className="border rounded-lg px-4"
                                            >
                                                <AccordionTrigger className="text-left hover:no-underline">
                                                    {faq.q}
                                                </AccordionTrigger>
                                                <AccordionContent className="text-muted-foreground pb-4">
                                                    {faq.a}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                {/* CTA */}
                <Card className="mt-12 bg-primary text-primary-foreground border-none">
                    <CardContent className="text-center py-10">
                        <Phone className="h-10 w-10 mx-auto mb-4 opacity-90" />
                        <h3 className="text-2xl font-bold mb-2">Masih ada pertanyaan?</h3>
                        <p className="text-primary-foreground/80 mb-6">
                            Tim kami siap membantu menjawab pertanyaan Anda
                        </p>
                        <div className="flex gap-4 justify-center">
                            <Link href="/kontak">
                                <Button variant="secondary" size="lg">
                                    Hubungi Kami
                                </Button>
                            </Link>
                            <Link href="/spmb">
                                <Button variant="outline" size="lg" className="bg-transparent border-white/30 text-white hover:bg-white/10">
                                    Daftar SPMB
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
