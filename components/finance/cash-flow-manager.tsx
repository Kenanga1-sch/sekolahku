"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { 
    Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowRight, Wallet, Building2, TrendingUp, TrendingDown, RefreshCcw, Loader2, Settings, Pencil, Trash2 } from "lucide-react";
import { 
    getTransactions, getAccounts, getCategories, 
    deleteAccount, deleteCategory, deleteTransaction 
} from "@/actions/finance";
import TransactionDialog from "./transaction-dialog";
import AccountDialog from "./account-dialog";
import CategoryDialog from "./category-dialog";
import FinanceReports from "./finance-reports";
import { showSuccess, showError } from "@/lib/toast";

// Helper for currency
const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
};

export default function CashFlowManager() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Dialog States
    const [isTxOpen, setIsTxOpen] = useState(false);
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);

    // Edit States
    const [accountToEdit, setAccountToEdit] = useState<any>(null);
    const [categoryToEdit, setCategoryToEdit] = useState<any>(null);
    const [transactionToEdit, setTransactionToEdit] = useState<any>(null);
    
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [txRes, accRes, catRes] = await Promise.all([
                getTransactions(),
                getAccounts(),
                getCategories()
            ]);
            
            if (txRes.success) setTransactions(txRes.data || []);
            if (accRes.success) setAccounts(accRes.data || []);
            if (catRes.success) setCategories(catRes.data || []);
            
        } catch (error) {
            console.error("Failed to fetch finance data", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchData();
    }, []);

    // --- Handlers ---

    const handleEditAccount = (acc: any) => {
        setAccountToEdit(acc);
        setIsAccountOpen(true);
    };

    const handleDeleteAccount = async (id: string, name: string) => {
        if (!confirm(`Yakin ingin menghapus akun "${name}"?`)) return;
        const res = await deleteAccount(id);
        if (res.success) {
            showSuccess(res.message);
            fetchData();
        } else {
            showError(res.error || "Gagal menghapus akun");
        }
    };

    const handleEditCategory = (cat: any) => {
        setCategoryToEdit(cat);
        setIsCategoryOpen(true);
    };

    const handleDeleteCategory = async (id: string, name: string) => {
        if (!confirm(`Yakin ingin menghapus kategori "${name}"?`)) return;
        const res = await deleteCategory(id);
        if (res.success) {
            showSuccess(res.message);
            fetchData();
        } else {
            showError(res.error || "Gagal menghapus kategori");
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        if (!confirm("Hapus transaksi ini?")) return;
        const res = await deleteTransaction(id);
        if (res.success) {
            showSuccess(res.message);
            fetchData();
        } else {
            showError(res.error || "Gagal menghapus transaksi");
        }
    };
    
    // Reset edit state when dialogs close
    const onAccountDialogChange = (open: boolean) => {
        setIsAccountOpen(open);
        if (!open) setAccountToEdit(null);
    };

    const onCategoryDialogChange = (open: boolean) => {
        setIsCategoryOpen(open);
        if (!open) setCategoryToEdit(null);
    };

    const calculateBalance = (accountId: string) => {
        let balance = 0;
        transactions.forEach(tx => {
            if (tx.status !== "APPROVED") return;
            if (tx.type === "INCOME" && tx.accountIdSource === accountId) {
                balance += tx.amount;
            } else if (tx.type === "EXPENSE" && tx.accountIdSource === accountId) {
                balance -= tx.amount;
            } else if (tx.type === "TRANSFER") {
                if (tx.accountIdSource === accountId) balance -= tx.amount;
                if (tx.accountIdDest === accountId) balance += tx.amount;
            }
        });
        return balance;
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="dashboard" className="w-full">
                <div className="flex justify-between items-center mb-4">
                    <TabsList>
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="reports">Laporan (BKU)</TabsTrigger>
                        <TabsTrigger value="settings">Pengaturan (Data Master)</TabsTrigger>
                    </TabsList>
                    <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>

                <TabsContent value="dashboard" className="space-y-6">
                    {/* Header Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {accounts.length === 0 && !isLoading && (
                            <div className="col-span-3 p-6 border border-dashed rounded-lg text-center bg-muted/30">
                                <Wallet className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
                                <h3 className="font-medium text-lg">Belum ada Akun Keuangan</h3>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Silakan buat akun (Wadah Uang) terlebih dahulu di menu Pengaturan.
                                </p>
                                <Button onClick={() => setIsAccountOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Tambah Akun
                                </Button>
                            </div>
                        )}
                        {accounts.map(acc => (
                            <Card key={acc.id}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {acc.name}
                                    </CardTitle>
                                    {acc.name.toLowerCase().includes("bank") ? (
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                        <Wallet className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatRupiah(calculateBalance(acc.id))}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {acc.accountNumber || "Kas Tunai"}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Mutasi & Transaksi</CardTitle>
                                <CardDescription>Riwayat pemasukan, pengeluaran, dan perpindahan dana.</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setIsTxOpen(true)} disabled={accounts.length === 0}>
                                <Plus className="h-4 w-4 mr-2" />
                                Catat Transaksi
                            </Button>
                        </CardHeader>
                        <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tanggal</TableHead>
                                        <TableHead>Keterangan</TableHead>
                                        <TableHead>Kategori</TableHead>
                                        <TableHead>Akun</TableHead>
                                        <TableHead className="text-right">Nominal</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                Belum ada transaksi tercatat.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        transactions.map((tx) => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="whitespace-nowrap">
                                                    {format(new Date(tx.date), "dd/MM/yyyy", { locale: idLocale })}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{tx.description || "-"}</div>
                                                    <div className="text-xs text-muted-foreground">{tx.type}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{tx.category?.name || "Umum"}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1 text-sm">
                                                        <span>{tx.accountSource?.name}</span>
                                                        {tx.type === "TRANSFER" && (
                                                            <>
                                                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                                <span>{tx.accountDest?.name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${
                                                    tx.type === "INCOME" ? "text-green-600" : 
                                                    tx.type === "EXPENSE" ? "text-red-600" : ""
                                                }`}>
                                                    {tx.type === "EXPENSE" ? "-" : "+"} {formatRupiah(tx.amount)}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={tx.status === "APPROVED" ? "default" : "secondary"} 
                                                        className={tx.status === "APPROVED" ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}>
                                                        {tx.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDeleteTransaction(tx.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Accounts Section */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Daftar Akun / Dompet</CardTitle>
                                    <CardDescription>Tempat penyimpanan uang (Kas/Bank).</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setIsAccountOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>No. Rekening</TableHead>
                                            <TableHead className="w-[100px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {accounts.map((acc) => (
                                            <TableRow key={acc.id}>
                                                <TableCell className="font-medium">{acc.name}</TableCell>
                                                <TableCell>{acc.accountNumber || "-"}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditAccount(acc)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        {!acc.isSystem && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteAccount(acc.id, acc.name)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {accounts.length === 0 && (
                                             <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                                    Belum ada akun.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        {/* Categories Section */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Kategori Anggaran</CardTitle>
                                    <CardDescription>Pos Pemasukan & Pengeluaran.</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setIsCategoryOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Tambah
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama Kategori</TableHead>
                                            <TableHead>Tipe</TableHead>
                                            <TableHead className="w-[100px]">Aksi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {categories.map((cat) => (
                                            <TableRow key={cat.id}>
                                                <TableCell className="font-medium">{cat.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={cat.type === "INCOME" ? "default" : "destructive"}>
                                                        {cat.type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleEditCategory(cat)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        {!cat.isSystem && (
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteCategory(cat.id, cat.name)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {categories.length === 0 && (
                                             <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                                    Belum ada kategori.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                     </div>
                </TabsContent>

                <TabsContent value="reports">
                    <FinanceReports accounts={accounts} />
                </TabsContent>
            </Tabs>
            
            <TransactionDialog 
                open={isTxOpen} 
                onOpenChange={setIsTxOpen} 
                onSuccess={fetchData}
                accounts={accounts}
                categories={categories}
            />
            
            <AccountDialog 
                open={isAccountOpen} 
                onOpenChange={onAccountDialogChange} 
                onSuccess={fetchData} 
                accountToEdit={accountToEdit}
            />
            
            <CategoryDialog 
                open={isCategoryOpen} 
                onOpenChange={onCategoryDialogChange} 
                onSuccess={fetchData}
                categoryToEdit={categoryToEdit} 
            />
        </div>
    );
}
