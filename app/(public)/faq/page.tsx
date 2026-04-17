"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, HelpCircle, GraduationCap, FileText, MapPin, Calendar, Phone, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { goGet } from "@/lib/api-client";

const iconMap: Record<string, any> = {
    spmb: FileText,
    akademik: GraduationCap,
    biaya: Calendar,
    lokasi: MapPin,
};

export default function FAQPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [faqCategories, setFaqCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        goGet('/api/public/faqs')
            .then((json: any) => {
                if (json.success) {
                    setFaqCategories(json.data);
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch FAQs:", err);
                setIsLoading(false);
            });
    }, []);

    const filteredCategories = faqCategories.map(category => ({
        ...category,
        questions: category.questions.filter(
            (faq: any) =>
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
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-muted-foreground">Memuat data...</p>
                        </div>
                    ) : filteredCategories.length === 0 ? (
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
                                            {(() => {
                                                const Icon = iconMap[category.id] || HelpCircle;
                                                return <Icon className="h-5 w-5" />;
                                            })()}
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

