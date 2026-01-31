"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { approveLoan, getVaults } from "@/actions/loans";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect } from "react";

const formSchema = z.object({
  approvedAmount: z.coerce.number().min(1, "Nominal harus lebih dari 0"),
  adminFee: z.coerce.number().min(0, "Biaya admin tidak boleh negatif"),
  sourceVaultId: z.string().min(1, "Sumber dana wajib dipilih"),
});

interface LoanApprovalDialogProps {
  loan: any; // Type 'Loan' from db/schema/loans technically
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function LoanApprovalDialog({ loan, open, onOpenChange, onSuccess }: LoanApprovalDialogProps) {
  const [vaults, setVaults] = useState<any[]>([]);
  
  useEffect(() => {
    if (open) {
        getVaults().then(res => {
            if(res.success) setVaults(res.data || []);
        });
    }
  }, [open]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      approvedAmount: loan?.amountRequested ?? 0,
      adminFee: 0,
      sourceVaultId: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!loan?.id) return;
      const res = await approveLoan(loan.id, values.approvedAmount, values.sourceVaultId);
      if (res.success) {
        showSuccess(res.message || "Pinjaman disetujui");
        onOpenChange(false);
        onSuccess();
      } else {
        showError(res.error || "Gagal menyetujui pinjaman");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Setujui Pinjaman</DialogTitle>
          <DialogDescription>
            Tinjau dan setujui pengajuan pinjaman ini. Anda dapat menyesuaikan nominal yang disetujui.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Pegawai:</span>
                    <span className="font-medium">{loan?.employee?.user?.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Pengajuan:</span>
                    <span className="font-medium">Rp {loan?.amountRequested?.toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Tenor:</span>
                    <span className="font-medium">{loan?.tenorMonths} Bulan</span>
                </div>
            </div>

              <FormField
                control={form.control as any}
                name="sourceVaultId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sumber Dana</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih Brankas / Bank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vaults.filter(v => v.tipe === 'cash').map((v) => (
                           <SelectItem key={v.id} value={v.id}>
                               {v.nama} (Rp {v.saldo.toLocaleString("id-ID")})
                           </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                        Pencairan dana hanya dapat diambil dari Kas Tunai. Pastikan saldo cukup.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <FormField
              control={form.control}
              name="approvedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal Disetujui (Rp)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>
                    Sesuaikan jika tidak menyetujui penuh.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="adminFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Biaya Admin (Rp)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormDescription>
                    Akan dipotong saat pencairan atau ditambahkan? (Logika saat ini: Info saja / Potongan)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Setujui & Cairkan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
