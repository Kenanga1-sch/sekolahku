"use client";

import { CurrencyInput } from "@/components/ui/currency-input";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createTransaction } from "@/actions/finance";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  accountIdSource: z.string().min(1, "Akun wajib dipilih"),
  accountIdDest: z.string().optional(),
  categoryId: z.string().optional(),
  amount: z.coerce.number().min(1, "Nominal harus lebih dari 0"),
  description: z.string().optional(),
  dateStr: z.string().optional(), // HTML Input Date
});

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accounts: any[];
  categories: any[];
}

export default function TransactionDialog({ open, onOpenChange, onSuccess, accounts, categories }: TransactionDialogProps) {
  const [activeTab, setActiveTab] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      type: "EXPENSE",
      accountIdSource: "",
      accountIdDest: "",
      categoryId: "",
      amount: 0,
      description: "",
      dateStr: new Date().toISOString().split("T")[0],
    },
  });

  // Reset form when tab changes (optional, but good for UX)
  const onTabChange = (val: string) => {
      const type = val as "INCOME" | "EXPENSE" | "TRANSFER";
      setActiveTab(type);
      form.setValue("type", type);
      form.clearErrors();
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const data = {
          ...values,
          date: values.dateStr ? new Date(values.dateStr) : new Date(),
      };
      
      const res = await createTransaction(data);
      
      if (res.success) {
        showSuccess(res.message || "Berhasil menyimpan transaksi");
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        showError(res.error || "Gagal menyimpan transaksi");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  const filteredCategories = categories.filter(c => c.type === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Catat Transaksi Baru</DialogTitle>
          <DialogDescription>
            Pilih jenis transaksi dan lengkapi detailnya.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="INCOME">Pemasukan</TabsTrigger>
                <TabsTrigger value="EXPENSE">Pengeluaran</TabsTrigger>
                <TabsTrigger value="TRANSFER">Mutasi (Transfer)</TabsTrigger>
            </TabsList>
        </Tabs>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            
            <FormField
              control={form.control as any}
              name="dateStr"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="accountIdSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{activeTab === "INCOME" ? "Masuk ke Akun" : "Sumber Dana"}</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Akun..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {activeTab === "TRANSFER" && (
                <FormField
                control={form.control as any}
                name="accountIdDest"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Ke Akun (Tujuan)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Akun Tujuan..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {accounts.filter(a => a.id !== form.getValues("accountIdSource")).map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}

            {activeTab !== "TRANSFER" && (
                <FormField
                control={form.control as any}
                name="categoryId"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Kategori / Pos Anggaran</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih Kategori..." />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {filteredCategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}

            <FormField
              control={form.control as any}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal (Rp)</FormLabel>
                  <FormControl>
                    <CurrencyInput 
                        value={field.value} 
                        onChange={field.onChange} 
                        placeholder="Masukan Nominal" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Contoh: Pembayaran SPP bulan Januari..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Transaksi
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
