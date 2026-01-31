"use client";

import { useState, useEffect } from "react";
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
import { createLoanRequest, getEmployeeOptions } from "@/actions/loans";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
// Since we don't have a direct "getEmployees" action ready for dropdown, 
// we might need to fetch internal API or creating a quick action?
// For now let's assume we can fetch via client or use a simplified server action.
// I'll add a simple getEmployeeOptions action to actions/loans.ts or use existing.

const formSchema = z.object({
  employeeDetailId: z.string().min(1, "Pegawai harus dipilih"),
  type: z.enum(["KASBON", "CICILAN"]),
  amountRequested: z.coerce.number().min(10000, "Minimal Rp 10.000"),
  tenorMonths: z.coerce.number().min(1, "Minimal 1 bulan"),
  notes: z.string().optional(),
});

interface LoanRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function LoanRequestDialog({ open, onOpenChange, onSuccess }: LoanRequestDialogProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      employeeDetailId: "",
      type: "KASBON",
      amountRequested: 0,
      tenorMonths: 1,
      notes: "" as string, // Force string type for optional
    },
  });

  const type = form.watch("type");

  // Reset tenor if type is KASBON
  useEffect(() => {
    if (type === "KASBON") {
        form.setValue("tenorMonths", 1);
    }
  }, [type, form]);

  useEffect(() => {
      if(open) {
          // Fetch employees
          // Since we don't have a dedicated endpoint yet, I'll fetch via a new action/route or placeholder.
          // Let's create a quick helper in the component file for now or assume an API.
          // Better: Create fetchEmployeeList action in actions/loans.ts
          fetchEmployees();
      }
  }, [open]);

  const fetchEmployees = async () => {
        setIsLoadingEmployees(true);
        try {
            // fetch from API
            const res = await fetch("/api/users/employees"); // We assume this exists or create it?
            // Existing endpoints: /api/users?role=guru?
            // Let's try to hit /api/users/employees-options if I create it, or just use a Server Action.
            // Using Server Action is safer for now.
            const result = await getEmployeeOptions();
            if(result.success && result.data) {
                setEmployees(result.data as any[]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingEmployees(false);
        }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const res = await createLoanRequest(values);
      if (res.success) {
        showSuccess(res.message || "Pengajuan berhasil dikirim");
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        showError(res.error || "Gagal membuat pengajuan");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Buat Pengajuan Pinjaman</DialogTitle>
          <DialogDescription>
            Isi formulir untuk mengajukan pinjaman atau kasbon baru untuk pegawai.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control as any}
              name="employeeDetailId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pilih Pegawai</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger disabled={isLoadingEmployees}>
                        <SelectValue placeholder="Pilih nama pegawai..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                                {emp.user?.name || emp.id} - {emp.nip || "Non-NIP"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control as any}
                name="type"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tipe Pinjaman</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih tipe" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="KASBON">Kasbon (Bulan Depan Lunas)</SelectItem>
                            <SelectItem value="CICILAN">Cicilan Panjang</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />

                <FormField
                control={form.control as any}
                name="tenorMonths"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Tenor (Bulan)</FormLabel>
                    <FormControl>
                        <Input 
                            type="number" 
                            {...field} 
                            disabled={type === "KASBON"} 
                            min={1} 
                            max={24}
                        />
                    </FormControl>
                    <FormDescription>
                        {type === "KASBON" ? "Otomatis 1 bulan" : "Maksimal 24 bln"}
                    </FormDescription>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>

            <FormField
              control={form.control as any}
              name="amountRequested"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nominal Pengajuan (Rp)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control as any}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keperluan / Catatan</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Contoh: Biaya berobat, Renovasi rumah..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <div className="flex w-full justify-between items-center text-xs text-muted-foreground">
                  <span>* Persetujuan tergantung limit gaji</span>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ajukan Sekarang
                  </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// End of component
