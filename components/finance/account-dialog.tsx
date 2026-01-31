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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createAccount, updateAccount } from "@/actions/finance";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Nama akun wajib diisi"),
  accountNumber: z.string().optional(),
  description: z.string().optional(),
  initialBalance: z.coerce.number().optional(),
});

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  accountToEdit?: { id: string; name: string; accountNumber?: string | null; description?: string | null } | null;
}

export default function AccountDialog({ open, onOpenChange, onSuccess, accountToEdit }: AccountDialogProps) {
  const isEditMode = !!accountToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: "",
      accountNumber: "",
      description: "",
      initialBalance: 0,
    },
  });

  // Effect to reset form when dialog opens/closes or edit target changes
  useEffect(() => {
    if (open) {
        if (accountToEdit) {
            form.reset({
                name: accountToEdit.name,
                accountNumber: accountToEdit.accountNumber || "",
                description: accountToEdit.description || "",
                initialBalance: 0,
            });
        } else {
            form.reset({
                name: "",
                accountNumber: "",
                description: "",
                initialBalance: 0,
            });
        }
    }
  }, [open, accountToEdit, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      let res;
      if (isEditMode && accountToEdit) {
         res = await updateAccount(accountToEdit.id, {
             name: values.name,
             accountNumber: values.accountNumber,
             description: values.description
         });
      } else {
         res = await createAccount(values);
      }

      if (res.success) {
        showSuccess(res.message || "Berhasil menyimpan akun");
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        showError(res.error || "Gagal menyimpan akun");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Akun" : "Tambah Akun / Dompet"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Ubah informasi akun ini." : "Buat wadah penyimpanan uang baru (misal: Kas Tunai, Bank BRI)."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control as any}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Akun</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Contoh: Kas Tunai TU, Bank BJB BOS" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control as any}
                name="accountNumber"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Nomor Rekening</FormLabel>
                    <FormControl>
                        <Input {...field} placeholder="Opsional" />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                
                {/* Only show initial balance for NEW accounts */}
                {!isEditMode && (
                    <FormField
                    control={form.control as any}
                    name="initialBalance"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Saldo Awal (Rp)</FormLabel>
                        <FormControl>
                            <CurrencyInput 
                                value={field.value} 
                                onChange={field.onChange} 
                                placeholder="0" 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Akun
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
