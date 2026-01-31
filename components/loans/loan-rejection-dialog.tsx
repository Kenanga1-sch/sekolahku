"use client";

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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { rejectLoan } from "@/actions/loans";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2, AlertTriangle } from "lucide-react";

const formSchema = z.object({
  reason: z.string().min(5, "Alasan penolakan wajib diisi (min 5 karakter)"),
});

interface LoanRejectionDialogProps {
  loan: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function LoanRejectionDialog({ loan, open, onOpenChange, onSuccess }: LoanRejectionDialogProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        reason: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (!loan?.id) return;
      const res = await rejectLoan(loan.id, values.reason);
      if (res.success) {
        showSuccess(res.message || "Pinjaman ditolak");
        onOpenChange(false);
        onSuccess();
      } else {
        showError(res.error || "Gagal menolak pinjaman");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Tolak Pinjaman
          </DialogTitle>
          <DialogDescription>
            Apakah Anda yakin ingin menolak pengajuan ini? Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <div className="bg-red-50 p-3 rounded-md text-sm border border-red-100">
                <span className="font-semibold text-red-800">Pegawai: {loan?.employee?.user?.name}</span>
                <br />
                <span className="text-red-700">Nominal: Rp {loan?.amountRequested?.toLocaleString("id-ID")}</span>
            </div>

            <FormField
              control={form.control as any}

              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alasan Penolakan</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Contoh: Limit gaji tidak mencukupi, masa kerja kurang..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tolak Pengajuan
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
