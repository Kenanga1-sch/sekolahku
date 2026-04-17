"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft,
    Calendar,
    User,
    Share2,
    Facebook,
    Twitter,
    Clock,
    ArrowRight,
    Newspaper,
} from "lucide-react";
import { sanitizeHTML, sanitizeSlug } from "@/lib/security";
import type { Announcement } from "@/types";

function getCategoryColor(category: string) {
    switch (category) {
        case "spmb": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
        case "prestasi": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
        case "kegiatan": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
        case "pengumuman": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
        default: return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400";
    }
}

function getCategoryLabel(category: string) {
    const labels: Record<string, string> = {
        spmb: "SPMB",
        prestasi: "Prestasi",
        kegiatan: "Kegiatan",
        pengumuman: "Pengumuman",
    };
    return labels[category] || category;
}

export default function BeritaDetailPage() {
    const searchParams = useSearchParams();
    const slug = searchParams.get("slug");

    const [article, setArticle] = useState<Announcement | null>(null);
    const [relatedArticles, setRelatedArticles] = useState<Announcement[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (slug) {
            fetchArticle();
        } else {
            setIsLoading(false);
        }
    }, [slug]);

    const fetchArticle = async () => {
        try {
            const safeSlug = sanitizeSlug(slug || "");
            const res = await fetch(`/api/public/news/${safeSlug}`);
            
            let record: Announcement | null = null;
            if (res.ok) {
                record = await res.json();
            } else {
                setArticle(null);
                setRelatedArticles([]);
                setIsLoading(false);
                return;
            }

            setArticle(record);

            if (record?.category) {
                try {
                    const relatedRes = await fetch(`/api/public/news`);
                    if (relatedRes.ok) {
                        const all = await relatedRes.json();
                        const related = all.filter((a: any) => 
                            a.category === record!.category && a.id !== record!.id
                        ).slice(0, 3);
                        setRelatedArticles(related);
                    }
                } catch {
                    setRelatedArticles([]);
                }
            }
        } catch (error) {
            console.error("Failed to fetch article:", error);
            setArticle(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = (platform: string) => {
        const url = window.location.href;
        const title = article?.title || "";

        let shareUrl = "";
        switch (platform) {
            case "facebook":
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
            case "twitter":
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
                break;
            case "copy":
                navigator.clipboard.writeText(url);
                return;
        }
        window.open(shareUrl, "_blank", "width=600,height=400");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background">
                <div className="container max-w-4xl py-32">
                    <Skeleton className="h-8 w-24 mb-8" />
                    <Skeleton className="h-12 w-full mb-4" />
                    <Skeleton className="h-6 w-64 mb-8" />
                    <Skeleton className="h-64 w-full mb-8" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-4 w-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Newspaper className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Artikel Tidak Ditemukan</h1>
                    <p className="text-muted-foreground mb-4">Artikel yang Anda cari tidak tersedia.</p>
                    <Link href="/berita">
                        <Button>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Kembali ke Berita
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="relative pt-32 pb-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
                <div className="container max-w-4xl relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <Link href="/berita">
                            <Button variant="ghost" className="-ml-4">
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Kembali ke Berita
                            </Button>
                        </Link>

                        <Badge className={getCategoryColor(article.category || "")}>
                            {getCategoryLabel(article.category || "")}
                        </Badge>

                        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                            {article.title}
                        </h1>

                        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>
                                    {article.published_at
                                        ? new Date(article.published_at).toLocaleDateString("id-ID", {
                                            day: "numeric",
                                            month: "long",
                                            year: "numeric",
                                        })
                                        : "-"}
                                </span>
                            </div>
                            {article.author && (
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    <span>{article.author}</span>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>5 menit baca</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="container max-w-4xl py-8">
                <div className="grid lg:grid-cols-4 gap-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="lg:col-span-3"
                    >
                        {article.thumbnail ? (
                             <div className="aspect-video relative rounded-xl overflow-hidden mb-8 shadow-md border">
                                <img 
                                    src={article.thumbnail} 
                                    alt={article.title} 
                                    className="w-full h-full object-cover"
                                />
                             </div>
                        ) : (
                             <div className="aspect-video bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-xl mb-8" />
                        )}

                        {article.excerpt && (
                            <p className="text-xl text-muted-foreground mb-8 font-medium leading-relaxed">
                                {article.excerpt}
                            </p>
                        )}

                        <Separator className="mb-8" />

                        <div
                            className="prose prose-lg dark:prose-invert max-w-none
                prose-headings:font-bold prose-headings:tracking-tight
                prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
                prose-p:text-muted-foreground prose-p:leading-relaxed
                prose-li:text-muted-foreground
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
                            dangerouslySetInnerHTML={{ __html: sanitizeHTML(article.content || article.excerpt || "") }}
                        />

                        <Separator className="my-8" />

                        <div className="flex items-center gap-4">
                            <span className="text-muted-foreground">Bagikan:</span>
                            <Button variant="outline" size="icon" onClick={() => handleShare("facebook")}>
                                <Facebook className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleShare("twitter")}>
                                <Twitter className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleShare("copy")}>
                                <Share2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>

                    <div className="space-y-6">
                        {relatedArticles.length > 0 && (
                            <Card>
                                <CardContent className="p-6">
                                    <h3 className="font-bold mb-4">Artikel Terkait</h3>
                                    <div className="space-y-4">
                                        {relatedArticles.map((item) => (
                                            <Link
                                                key={item.id}
                                                href={`/berita/detail?slug=${item.slug || item.id}`}
                                                className="block group"
                                            >
                                                <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                                                    {item.title}
                                                </h4>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {item.published_at
                                                        ? new Date(item.published_at).toLocaleDateString("id-ID", {
                                                            day: "numeric",
                                                            month: "short",
                                                        })
                                                        : "-"}
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}



