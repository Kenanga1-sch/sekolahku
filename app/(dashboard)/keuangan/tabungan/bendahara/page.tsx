"use client";

import React, { useState, useEffect, Suspense } from "react";
import { getSavingsTreasurer, getClassesWithReps, getPendingSetoran, getEmployees, getBrankasSummary } from "@/actions/savings-admin";
import { getLoans } from "@/actions/loans";
import { TreasurerSelector } from "@/components/finance/treasurer-selector";
import { ClassRepManager } from "@/components/finance/class-rep-manager";
import { VerificationQueue } from "@/components/finance/verification-queue";
import { BrankasManager } from "@/components/finance/brankas-manager";
import { DebtManager } from "@/components/finance/debt-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";

export default function SavingsTreasurerPage() {
    const router = useRouter();
    const [session, setSession] = useState<any>(null);
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            const cookies = document.cookie.split(";").map(c => c.trim());
            const sessionCookie = cookies.find(c => c.startsWith("session="));
            
            if (!sessionCookie) {
                router.push("/login");
                return;
            }

            try {
                const token = sessionCookie.split("=")[1];
                const payload = JSON.parse(atob(token.split(".")[1]));
                setSession({ user: payload });

                const [treasurerRes, classesRes, pendingRes, employeesRes, brankasRes, receivablesRes, payablesRes] = await Promise.all([
                    getSavingsTreasurer(),
                    getClassesWithReps(),
                    getPendingSetoran(),
                    getEmployees(),
                    getBrankasSummary(),
                    getLoans("RECEIVABLE"),
                    getLoans("PAYABLE")
                ]);

                setData({
                    treasurer: treasurerRes.data,
                    classes: classesRes.data || [],
                    pendingSetoran: pendingRes.data || [],
                    employees: employeesRes.data || [],
                    brankasData: brankasRes.data || { vaults: [], recentTransactions: [] },
                    receivables: receivablesRes.data || [],
                    payables: payablesRes.data || []
                });
            } catch (err) {
                console.error("Fetch error:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [router]);

    if (isLoading || !data) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { treasurer, classes, pendingSetoran, employees, brankasData, receivables, payables } = data;
    const isTreasurer = treasurer?.id === session.user?.id;
    const isAdmin = session.user?.role === "admin";

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/tabungan">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Manajemen Bendahara Tabungan</h1>
                    <p className="text-muted-foreground">
                        Kelola struktur bendahara, penanggung jawab kelas, dan verifikasi setoran harian.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="brankas" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
                    <TabsTrigger value="brankas">Brankas & Saldo</TabsTrigger>
                    <TabsTrigger value="verifikasi">Verifikasi Setoran</TabsTrigger>
                    <TabsTrigger value="hutang">Manajemen Hutang</TabsTrigger>
                    <TabsTrigger value="struktur">Struktur & PJ</TabsTrigger>
                </TabsList>
                
                <TabsContent value="brankas" className="space-y-4">
                    {(isTreasurer || isAdmin) ? (
                        <BrankasManager 
                            vaults={brankasData.vaults} 
                            recentTransactions={brankasData.recentTransactions} 
                            currentUserId={session.user?.id || ""} 
                        />
                    ) : (
                        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                            <CardContent className="p-8 text-center text-red-600 dark:text-red-400">
                                <p className="font-semibold">Akses Ditolak</p>
                                <p className="text-sm mt-1">Hanya Bendahara Utama yang dapat mengakses Brankas.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="verifikasi" className="space-y-4">
                    {(isTreasurer || isAdmin) ? (
                        <VerificationQueue pendingSetoran={pendingSetoran} currentUserId={session.user?.id || ""} />
                    ) : (
                        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                            <CardContent className="p-8 text-center text-red-600 dark:text-red-400">
                                <p className="font-semibold">Akses Ditolak</p>
                                <p className="text-sm mt-1">Anda tidak memiliki akses untuk melakukan verifikasi. Hanya Bendahara Utama yang dapat melakukan ini.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="hutang" className="space-y-4">
                    {(isTreasurer || isAdmin) ? (
                        <DebtManager 
                            receivables={receivables} 
                            payables={payables} 
                            employees={employees}
                            currentUserId={session.user?.id || ""} 
                        />
                    ) : (
                        <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
                            <CardContent className="p-8 text-center text-red-600 dark:text-red-400">
                                <p className="font-semibold">Akses Ditolak</p>
                                <p className="text-sm mt-1">Hanya Bendahara Utama yang dapat mengakses fitur Hutang.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="struktur" className="space-y-4">
                    {isAdmin ? (
                    <TreasurerSelector currentTreasurer={treasurer} employees={employees} />
                    ) : (
                    <Card className="relative overflow-hidden border-muted/40 dark:bg-zinc-900/50 backdrop-blur-sm group hover:border-primary/20 transition-all duration-300">
                        <CardContent className="p-6">
                            <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                                <ShieldCheck className="w-5 h-5 text-primary" />
                                Bendahara Utama
                            </h3>
                            <div className="p-3 bg-muted/50 rounded-md">
                                <span className="font-semibold">Bendahara saat ini:</span> {treasurer?.name || "Belum ditentukan"}
                            </div>
                        </CardContent>
                    </Card>
                    )}

                    <ClassRepManager classes={classes} employees={employees} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

