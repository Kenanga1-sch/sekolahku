"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Trophy, Users } from "lucide-react";

// Types for API response
interface TopBook {
    id: string;
    title: string;
    author?: string;
    borrowCount: number;
    cover?: string;
}

interface TopMember {
    id: string;
    name: string;
    class_name?: string;
    borrowCount: number;
}

// ==========================================
// Top Books Widget
// ==========================================

export function TopBooksWidget() {
    const [books, setBooks] = useState<TopBook[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/perpustakaan/data?type=top-books");
                if (res.ok) {
                    const data = await res.json();
                    setBooks(data);
                }
            } catch {
                // Fail silently
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        Buku Populer
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-12 w-10 rounded" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Buku Populer
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px] px-6">
                    {books.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                            <p>Belum ada data peminjaman</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {books.map((book, index) => (
                                <Link 
                                    key={book.id} 
                                    href={`/perpustakaan/buku?id=${book.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                                        {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {book.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {book.author || "Penulis tidak diketahui"}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {book.borrowCount}x
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

// ==========================================
// Top Members Widget
// ==========================================

export function TopMembersWidget() {
    const [members, setMembers] = useState<TopMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const res = await fetch("/api/perpustakaan/data?type=top-members");
                if (res.ok) {
                    const data = await res.json();
                    setMembers(data);
                }
            } catch {
                // Fail silently
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    if (loading) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        Anggota Aktif
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    Anggota Aktif
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[280px] px-6">
                    {members.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground py-8">
                            <p>Belum ada data peminjaman</p>
                        </div>
                    ) : (
                        <div className="space-y-1 pb-4">
                            {members.map((member, index) => (
                                <Link 
                                    key={member.id} 
                                    href={`/perpustakaan/anggota?id=${member.id}`}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-bold text-sm">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                            {member.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {member.class_name || "Kelas -"}
                                        </p>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {member.borrowCount} pinjam
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
