import { Suspense } from "react";
import { getSavingsTreasurer, getClassesWithReps, getPendingSetoran, getEmployees, getBrankasSummary } from "@/actions/savings-admin";
import { getLoans } from "@/actions/loans";
import { TreasurerSelector } from "@/components/finance/treasurer-selector";
import { ClassRepManager } from "@/components/finance/class-rep-manager";
import { VerificationQueue } from "@/components/finance/verification-queue";
import { BrankasManager } from "@/components/finance/brankas-manager";
import { DebtManager } from "@/components/finance/debt-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/auth"; // Assuming auth setup
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Users, Banknote, Landmark } from "lucide-react";

export const metadata = {
  title: "Bendahara Tabungan | SekolahKu",
};

export default async function SavingsTreasurerPage() {
    const session = await auth();
    if (!session) redirect("/login");

    // Fetch Data Parallel
    const [treasurerRes, classesRes, pendingRes, employeesRes, brankasRes, receivablesRes, payablesRes] = await Promise.all([
        getSavingsTreasurer(),
        getClassesWithReps(),
        getPendingSetoran(),
        getEmployees(),
        getBrankasSummary(),
        getLoans("RECEIVABLE"),
        getLoans("PAYABLE")
    ]);

    const treasurer = treasurerRes.data;
    const classes = classesRes.data || [];
    const pendingSetoran = pendingRes.data || [];
    const employees = employeesRes.data || [];
    const brankasData = brankasRes.data || { vaults: [], recentTransactions: [] };
    const receivables = receivablesRes.data || [];
    const payables = payablesRes.data || [];

    const isTreasurer = treasurer?.id === session.user?.id;
    const isAdmin = session.user?.role === "admin" || session.user?.role === "superadmin";

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Manajemen Bendahara Tabungan</h1>
                <p className="text-muted-foreground">
                    Kelola struktur bendahara, penanggung jawab kelas, dan verifikasi setoran harian.
                </p>
            </div>

            <Tabs defaultValue="structure" className="w-full">
                <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
                    <TabsTrigger value="structure">Struktur & PJ</TabsTrigger>
                    <TabsTrigger value="verification">Verifikasi Setoran</TabsTrigger>
                    <TabsTrigger value="brankas">Brankas & Saldo</TabsTrigger>
                    <TabsTrigger value="debt">Manajemen Hutang</TabsTrigger>
                </TabsList>

                <TabsContent value="structure" className="space-y-6 mt-6">
                    {/* Only Admin can likely change this? Assuming yes for safety */}
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

                <TabsContent value="verification" className="mt-6">
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

                <TabsContent value="brankas" className="mt-6">
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

                <TabsContent value="debt" className="mt-6">
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
            </Tabs>
        </div>
    );
}
