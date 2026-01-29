"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  ArrowDownRight, 
  Check, 
  ChevronsUpDown, 
  Calendar as CalendarIcon,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns"; // Make sure to use existing date-fns version
import { id } from "date-fns/locale";

export default function BarangMasukPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  
  // Form State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD
  const [proofImage, setProofImage] = useState(""); // Placeholder for file upload path

  useEffect(() => {
    fetch("/api/inventory/items?limit=100")
      .then((res) => res.json())
      .then((data) => {
        setItems(data.data);
        setLoading(false);
      })
      .catch((err) => {
        toast.error("Gagal memuat daftar barang");
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity) {
      toast.error("Mohon lengkapi data barang dan jumlah");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItemId,
          type: "IN", // INCOMING
          quantity: parseInt(quantity),
          description: description || "Restock Barang",
          date: date,
          // proofImage handled separately if implemented
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      
      toast.success("Barang masuk berhasil dicatat");
      router.push("/inventaris/stok");
    } catch (error) {
      toast.error("Terjadi kesalahan saat menyimpan data");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItem = items.find((i) => i.id === selectedItemId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
           <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Input Barang Masuk</h1>
           <p className="text-muted-foreground">Catat penambahan stok atau pembelian barang baru.</p>
        </div>
       </div>

       <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <div className="p-2 bg-emerald-100 dark:bg-emerald-900/20 rounded-full text-emerald-600">
                  <ArrowDownRight className="h-5 w-5" />
               </div>
               Formulir Barang Masuk
            </CardTitle>
            <CardDescription>
               Stok barang akan bertambah secara otomatis setelah disimpan.
            </CardDescription>
         </CardHeader>
         <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Item Selection */}
               <div className="space-y-2">
                 <Label>Pilih Barang <span className="text-red-500">*</span></Label>
                 <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCombobox}
                        className="w-full justify-between"
                      >
                        {selectedItemId
                          ? items.find((item) => item.id === selectedItemId)?.name
                          : "Cari barang..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Cari nama barang..." />
                        <CommandList>
                           <CommandEmpty>Barang tidak ditemukan.</CommandEmpty>
                           <CommandGroup>
                             {items.map((item) => (
                               <CommandItem
                                 key={item.id}
                                 value={item.name}
                                 onSelect={() => {
                                   setSelectedItemId(item.id);
                                   setOpenCombobox(false);
                                 }}
                               >
                                 <Check
                                   className={cn(
                                     "mr-2 h-4 w-4",
                                     selectedItemId === item.id ? "opacity-100" : "opacity-0"
                                   )}
                                 />
                                 <div className="flex flex-col">
                                    <span>{item.name}</span>
                                    <span className="text-xs text-muted-foreground">Stok: {item.currentStock} {item.unit}</span>
                                 </div>
                               </CommandItem>
                             ))}
                           </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                 </Popover>
               </div>

               {selectedItem && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg flex justify-between items-center text-sm">
                     <span className="text-muted-foreground">Stok Saat Ini:</span>
                     <span className="font-bold">{selectedItem.currentStock} {selectedItem.unit}</span>
                  </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label>Jumlah Masuk <span className="text-red-500">*</span></Label>
                     <Input 
                        type="number" 
                        min="1" 
                        placeholder="0" 
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        required
                     />
                  </div>
                  <div className="space-y-2">
                     <Label>Tanggal</Label>
                     <Input 
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                     />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label>Keterangan / Sumber</Label>
                  <Textarea 
                     placeholder="Contoh: Pembelian dari Toko ABC, Dana BOS, dll."
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                  />
               </div>

               {/* TODO: Add File Upload for Nota/Proof if needed */}
               
               <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
                  <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                     {submitting ? "Menyimpan..." : "Simpan Data"}
                  </Button>
               </div>
            </form>
         </CardContent>
       </Card>
    </div>
  );
}
