"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Badge not really needed
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2, Landmark, Wallet, ArrowRightLeft, History } from "lucide-react";
import { transferVaultFunds } from "@/actions/savings-admin";

interface BrankasManagerProps {
    vaults: any[];
    recentTransactions: any[];
    currentUserId: string;
}

export function BrankasManager({ vaults, recentTransactions, currentUserId }: BrankasManagerProps) {
    const [loading, setLoading] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"setor" | "tarik">("setor");
    const [nominal, setNominal] = useState("");

    const cashVault = vaults.find(v => v.tipe === 'cash');
    const bankVault = vaults.find(v => v.tipe === 'bank');

    const handleTransfer = async () => {
        if (!nominal || isNaN(Number(nominal))) return;
        setLoading(true);

        const type = activeTab === "setor" ? "setor_ke_bank" : "tarik_dari_bank";
        
        try {
            const res = await transferVaultFunds(type, Number(nominal), currentUserId);
            if (res.success) {
                showSuccess(res.message || "Berhasil");
                setDialogOpen(false);
                setNominal("");
            } else {
                showError(res.error || "Gagal");
            }
        } catch (error) {
            showError("Terjadi kesalahan sistem");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Cash Card */}
                <Card className="relative overflow-hidden border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/10">
                    <CardContent className="p-6 flex items-center justify-between">
                         <div>
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-2">
                                <Wallet className="w-4 h-4" /> Kas Tunai (Pegangan)
                            </p>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                {formatCurrency(cashVault?.saldo || 0)}
                            </h2>
                         </div>
                         <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                            <Wallet className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                         </div>
                    </CardContent>
                </Card>

                {/* Bank Card */}
                <Card className="relative overflow-hidden border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/10">
                    <CardContent className="p-6 flex items-center justify-between">
                         <div>
                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-2">
                                <Landmark className="w-4 h-4" /> Rekening Bank
                            </p>
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                {formatCurrency(bankVault?.saldo || 0)}
                            </h2>
                         </div>
                         <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                            <Landmark className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                         </div>
                    </CardContent>
                </Card>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                         <Button onClick={() => setActiveTab("setor")} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Setor ke Bank
                         </Button>
                    </DialogTrigger>
                    <DialogTrigger asChild>
                         <Button onClick={() => setActiveTab("tarik")} variant="outline" className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 shadow-sm">
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Tarik dari Bank
                         </Button>
                    </DialogTrigger>
                    
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {activeTab === "setor" ? "Setor Tunai ke Bank" : "Tarik Tunai dari Bank"}
                            </DialogTitle>
                            <DialogDescription>
                                {activeTab === "setor" 
                                    ? "Memindahkan dana dari Kas Tunai (Pegangan) ke Rekening Bank." 
                                    : "Mengambil dana dari Rekening Bank untuk Kas Tunai (Pegangan)."}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Nominal Transfer</Label>
                                <Input 
                                    type="number" 
                                    placeholder="Contoh: 1000000" 
                                    value={nominal}
                                    onChange={(e) => setNominal(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Maksimal: {activeTab === "setor" ? formatCurrency(cashVault?.saldo || 0) : formatCurrency(bankVault?.saldo || 0)}
                                </p>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleTransfer} disabled={loading} className={activeTab === 'setor' ? "bg-emerald-600" : ""}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Konfirmasi {activeTab === "setor" ? "Setor" : "Tarik"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* History Table */}
            <Card>
                <CardContent className="p-6">
                    <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                        <History className="w-5 h-5" /> Riwayat Mutasi Brankas
                    </h3>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Tipe Transaksi</TableHead>
                                    <TableHead>Nominal</TableHead>
                                    <TableHead>Oleh</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Belum ada transaksi.</TableCell>
                                    </TableRow>
                                ) : (
                                    recentTransactions.map((tx) => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{new Date(tx.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                                            <TableCell>
                                                <Badge variant={tx.tipe === 'setor_ke_bank' ? 'default' : 'outline'} className={tx.tipe === 'setor_ke_bank' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-none' : 'text-orange-600 border-orange-200'}>
                                                    {tx.tipe === 'setor_ke_bank' ? 'Setor ke Bank' : 'Tarik dari Bank'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{formatCurrency(tx.nominal)}</TableCell>
                                            <TableCell className="text-muted-foreground">{tx.user?.name || "System"}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
