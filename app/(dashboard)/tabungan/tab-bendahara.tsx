"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getSavingsTreasurer, getClassesWithReps, getPendingSetoran, getEmployees, getBrankasSummary } from "@/actions/savings-admin";
import { getLoans } from "@/actions/loans";
import { TreasurerSelector } from "@/components/finance/treasurer-selector";
import { ClassRepManager } from "@/components/finance/class-rep-manager";
import { VerificationQueue } from "@/components/finance/verification-queue";
import { BrankasManager } from "@/components/finance/brankas-manager";
import { DebtManager } from "@/components/finance/debt-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";

const emptyBrankasData = { vaults: [], recentTransactions: [] };

function unwrapData(value: any, fallback: any = null) {
    const payload = value?.data ?? value;
    if (payload == null) return fallback;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.vaults)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (payload?.data != null) return payload.data;
    return payload;
}

function unwrapList(value: any) {
    const data = unwrapData(value, []);
    return Array.isArray(data) ? data : [];
}

interface TabBendaharaProps {
    onChanged?: () => void;
}

export default function TabBendahara({ onChanged }: TabBendaharaProps) {
    const { user } = useAuthStore();
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
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
                treasurer: unwrapData(treasurerRes),
                classes: unwrapList(classesRes),
                pendingSetoran: unwrapList(pendingRes),
                employees: unwrapList(employeesRes),
                brankasData: unwrapData(brankasRes, emptyBrankasData) || emptyBrankasData,
                receivables: unwrapList(receivablesRes),
                payables: unwrapList(payablesRes)
            });
            if (onChanged) onChanged();
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [onChanged]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading || !data) {
        return (
            <div className="flex h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const { treasurer, classes, pendingSetoran, employees, brankasData, receivables, payables } = data;
    const isTreasurer = treasurer?.id === user?.id;
    const isAdmin = user?.role === "admin" || user?.role === "superadmin";

    return (
        <Tabs defaultValue="brankas" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 bg-slate-100 dark:bg-zinc-900 p-1 rounded-xl">
                <TabsTrigger value="brankas" className="rounded-lg">Brankas & Saldo</TabsTrigger>
                <TabsTrigger value="verifikasi" className="rounded-lg">Verifikasi Setoran</TabsTrigger>
                <TabsTrigger value="hutang" className="rounded-lg">Manajemen Hutang</TabsTrigger>
                <TabsTrigger value="struktur" className="rounded-lg">Struktur & PJ</TabsTrigger>
            </TabsList>
            
            <TabsContent value="brankas" className="space-y-4">
                {(isTreasurer || isAdmin) ? (
                    <BrankasManager 
                        vaults={brankasData.vaults || []} 
                        recentTransactions={brankasData.recentTransactions || []} 
                        currentUserId={user?.id || ""} 
                        onChanged={fetchData}
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
                    <VerificationQueue pendingSetoran={pendingSetoran} currentUserId={user?.id || ""} onChanged={fetchData} />
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
                        currentUserId={user?.id || ""} 
                        onChanged={fetchData}
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
                    <TreasurerSelector currentTreasurer={treasurer} employees={employees} onChanged={fetchData} />
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
    );
}
