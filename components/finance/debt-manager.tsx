"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2, Plus, DollarSign, Calendar, User, Building2, Wallet } from "lucide-react";
import { createLoan, getLoans, addPayment, getVaults } from "@/actions/loans";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LoanApprovalDialog from "@/components/loans/loan-approval-dialog";
import { useEffect } from "react";

interface DebtManagerProps {
    receivables: any[]; // Hutang Pegawai (Piutang)
    payables: any[]; // Hutang Sekolah (Kewajiban)
    employees: any[];
    currentUserId: string;
}

export function DebtManager({ receivables, payables, employees, currentUserId }: DebtManagerProps) {
    const [createOpen, setCreateOpen] = useState(false);
    const [payOpen, setPayOpen] = useState(false);
    const [approvalOpen, setApprovalOpen] = useState(false);
    const [selectedLoan, setSelectedLoan] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [vaults, setVaults] = useState<any[]>([]);

    useEffect(() => {
        getVaults().then(res => {
            if(res.success) setVaults(res.data || []);
        });
    }, []);

    // Form States
    const [activeTab, setActiveTab] = useState("receivables"); // receivables | payables
    const [formData, setFormData] = useState({
        borrowerType: "EMPLOYEE",
        employeeId: "",
        borrowerName: "",
        description: "",
        amount: "",
        tenor: "1",
    });
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [targetVaultId, setTargetVaultId] = useState("");

    const handleCreate = async () => {
        if (!formData.amount || !formData.tenor) return;
        if (formData.borrowerType === "EMPLOYEE" && !formData.employeeId) return;
        if (formData.borrowerType !== "EMPLOYEE" && !formData.borrowerName) return;

        setLoading(true);
        try {
            const res = await createLoan({
                borrowerType: formData.borrowerType as any,
                employeeDetailId: formData.employeeId || undefined,
                borrowerName: formData.borrowerName,
                description: formData.description,
                type: Number(formData.tenor) > 1 ? "CICILAN" : "KASBON",
                amountRequested: Number(formData.amount),
                tenorMonths: Number(formData.tenor),
            });

            if (res.success) {
                showSuccess("Hutang berhasil dicatat");
                setCreateOpen(false);
                setFormData({
                    borrowerType: activeTab === "receivables" ? "EMPLOYEE" : "EXTERNAL", 
                    employeeId: "",
                    borrowerName: "",
                    description: "",
                    amount: "",
                    tenor: "1",
                });
            } else {
                showError(res.error || "Gagal");
            }
        } catch (error) {
            showError("Terjadi kesalahan sistem");
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!selectedLoan || !paymentAmount || !targetVaultId) return;
        
        setLoading(true);
        try {
            const res = await addPayment(selectedLoan.id, Number(paymentAmount), paymentNotes, targetVaultId);
            if (res.success) {
                showSuccess("Pembayaran berhasil");
                setPayOpen(false);
                setSelectedLoan(null);
                setPaymentAmount("");
                setPaymentNotes("");
            } else {
                showError(res.error || "Gagal");
            }
        } catch (error) {
           showError("Terjadi kesalahan sistem");
        } finally {
            setLoading(false);
        }
    };

    const openPayDialog = (loan: any) => {
        setSelectedLoan(loan);
        setPayOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v);
                    setFormData(prev => ({ ...prev, borrowerType: v === 'receivables' ? "EMPLOYEE" : "EXTERNAL" }));
                }} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="receivables">Piutang Pegawai</TabsTrigger>
                        <TabsTrigger value="payables">Hutang Sekolah</TabsTrigger>
                    </TabsList>
                </Tabs>
                
                <Button onClick={() => setCreateOpen(true)} className="bg-primary shadow-sm">
                    <Plus className="mr-2 h-4 w-4" /> Catat {activeTab === "receivables" ? "Piutang" : "Hutang"} Baru
                </Button>
            </div>

            {selectedLoan && (
                <LoanApprovalDialog 
                    loan={selectedLoan} 
                    open={approvalOpen} 
                    onOpenChange={(op) => {
                        setApprovalOpen(op);
                        if(!op) setSelectedLoan(null);
                    }} 
                    onSuccess={() => window.location.reload()} // Simple reload needed to refresh data properly
                />
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Catat {activeTab === "receivables" ? "Piutang Pegawai" : "Hutang Sekolah"} Baru</DialogTitle>
                        <DialogDescription>
                            {activeTab === "receivables" 
                                ? "Mencatat peminjaman uang/kasbon oleh pegawai." 
                                : "Mencatat kewajiban/hutang sekolah kepada pihak lain."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {activeTab === "receivables" ? (
                            <div className="space-y-2">
                                <Label>Pegawai</Label>
                                <Select onValueChange={(v) => setFormData({...formData, employeeId: v})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih Pegawai" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees.map(emp => (
                                            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label>Pemberi Hutang / Pihak Lain</Label>
                                <Input 
                                    placeholder="Nama Toko / Vendor / Orang" 
                                    value={formData.borrowerName}
                                    onChange={(e) => setFormData({...formData, borrowerName: e.target.value})}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Keterangan / Keperluan</Label>
                            <Input 
                                placeholder="Contoh: Renovasi Atap / Kasbon Bulanan"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nominal (Rp)</Label>
                                <Input 
                                    type="number"
                                    placeholder="0"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tenor (Bulan)</Label>
                                <Input 
                                    type="number"
                                    placeholder="1"
                                    value={formData.tenor}
                                    onChange={(e) => setFormData({...formData, tenor: e.target.value})}
                                />
                                <p className="text-[10px] text-muted-foreground">Isi 1 untuk Kasbon/Sekali Bayar.</p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreate} disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Payment Dialog */}
            <Dialog open={payOpen} onOpenChange={setPayOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Bayar {activeTab === "receivables" ? "Cicilan" : "Hutang"}</DialogTitle>
                        <DialogDescription>
                            Mencatat pembayaran untuk hutang: {selectedLoan?.description || selectedLoan?.type}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nominal Pembayaran</Label>
                            <Input 
                                type="number"
                                placeholder="0"
                                value={paymentAmount}
                                onChange={(e) => setPaymentAmount(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Sisa Hutang: {selectedLoan ? formatCurrency(selectedLoan.remainingAmount) : 0}
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                             <Label>Masuk ke (Sumber Dana Pelunasan)</Label>
                             <Select onValueChange={setTargetVaultId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Brankas Tunai (Kas)" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vaults.filter(v => v.tipe === 'cash').map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.nama} (Rp {v.saldo.toLocaleString("id-ID")})</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                             <p className="text-xs text-muted-foreground">Pembayaran hutang otomatis masuk ke Kas Tunai.</p>
                        </div>

                        <div className="space-y-2">
                        <div className="space-y-2">
                            <Label>Catatan (Opsional)</Label>
                            <Input 
                                placeholder="Contoh: Cicilan ke-1"
                                value={paymentNotes}
                                onChange={(e) => setPaymentNotes(e.target.value)}
                            />
                        </div>
                        </div>
                    </div>

                    <DialogFooter>
                         <Button onClick={handlePayment} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Konfirmasi Bayar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* LIST */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>{activeTab === "receivables" ? "Pegawai" : "Pihak"}</TableHead>
                                <TableHead>Keterangan</TableHead>
                                <TableHead>Tenor</TableHead>
                                <TableHead className="text-right">Total Hutang</TableHead>
                                <TableHead className="text-right">Sudah Bayar</TableHead>
                                <TableHead className="text-right">Sisa</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(activeTab === "receivables" ? receivables : payables).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Data tidak ditemukan.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (activeTab === "receivables" ? receivables : payables).map((loan) => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{new Date(loan.createdAt).toLocaleDateString("id-ID")}</TableCell>
                                        <TableCell className="font-medium">
                                            {loan.borrowerType === "EMPLOYEE" ? loan.employee?.user?.name : loan.borrowerName}
                                        </TableCell>
                                        <TableCell>{loan.description || "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{loan.tenorMonths} Bulan</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(loan.amountApproved || loan.amountRequested)}</TableCell>
                                        <TableCell className="text-right text-emerald-600">{formatCurrency(loan.paidAmount)}</TableCell>
                                        <TableCell className="text-right font-bold text-red-600">{formatCurrency(loan.remainingAmount)}</TableCell>
                                        <TableCell className="text-right">
                                            {loan.status === "PENDING" && (
                                                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={() => {
                                                    setSelectedLoan(loan);
                                                    setApprovalOpen(true);
                                                }}>
                                                    Setujui
                                                </Button>
                                            )}
                                            {loan.status === "APPROVED" && loan.remainingAmount > 0 && (
                                                <Button size="sm" variant="outline" className="h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => openPayDialog(loan)}>
                                                    Bayar
                                                </Button>
                                            )}
                                            {loan.remainingAmount <= 0 && loan.status === "APPROVED" && (
                                                <Badge className="bg-green-100 text-green-800 border-none">LUNAS</Badge>
                                            )}
                                            {loan.status === "REJECTED" && (
                                                 <Badge className="bg-red-100 text-red-800 border-none">DITOLAK</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
