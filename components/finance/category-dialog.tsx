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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCategory, updateCategory } from "@/actions/finance";
import { showSuccess, showError } from "@/lib/toast";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Nama kategori wajib diisi"),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string().optional(),
});

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  categoryToEdit?: { id: string; name: string; type: "INCOME" | "EXPENSE"; description?: string | null } | null;
}

export default function CategoryDialog({ open, onOpenChange, onSuccess, categoryToEdit }: CategoryDialogProps) {
  const isEditMode = !!categoryToEdit;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "EXPENSE",
      description: "",
    },
  });

  // Effect to reset form
  useEffect(() => {
    if (open) {
        if (categoryToEdit) {
            form.reset({
                name: categoryToEdit.name,
                type: categoryToEdit.type,
                description: categoryToEdit.description || "",
            });
        } else {
            form.reset({
                name: "",
                type: "EXPENSE",
                description: "",
            });
        }
    }
  }, [open, categoryToEdit, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      let res;
      if (isEditMode && categoryToEdit) {
         res = await updateCategory(categoryToEdit.id, values);
      } else {
         res = await createCategory(values);
      }

      if (res.success) {
        showSuccess(res.message);
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        showError(res.error || "Gagal menyimpan kategori");
      }
    } catch (error) {
      showError("Terjadi kesalahan sistem");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Kategori" : "Tambah Kategori Anggaran"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Ubah data kategori ini." : "Buat pos anggaran baru untuk pemasukan atau pengeluaran."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipe</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Tipe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="INCOME">Pemasukan (Income)</SelectItem>
                        <SelectItem value="EXPENSE">Pengeluaran (Expense)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Kategori</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Contoh: Gaji Guru, Listrik, SPP..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan Kategori
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
