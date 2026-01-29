"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  ArrowUpRight, 
  Check, 
  ChevronsUpDown, 
  User
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

export default function BarangKeluarPage() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  
  // Form State
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

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

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || !quantity) {
      toast.error("Mohon lengkapi data barang dan jumlah");
      return;
    }

    const qty = parseInt(quantity);
    if (selectedItem && qty > selectedItem.currentStock) {
       toast.error(`Stok tidak cukup! Tersedia: ${selectedItem.currentStock}`);
       return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItemId,
          type: "OUT", // OUTGOING
          quantity: qty,
          description: description || "Pemakaian Rutin",
          recipient: recipient,
          date: date,
        }),
      });

      if (!res.ok) {
         const txt = await res.text();
         throw new Error(txt);
      }
      
      toast.success("Barang keluar berhasil dicatat");
      router.push("/inventaris/stok");
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
           <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Input Barang Keluar</h1>
           <p className="text-muted-foreground">Catat pemakaian barang oleh guru atau staff.</p>
        </div>
       </div>

       <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <div className="p-2 bg-rose-100 dark:bg-rose-900/20 rounded-full text-rose-600">
                  <ArrowUpRight className="h-5 w-5" />
               </div>
               Formulir Barang Keluar
            </CardTitle>
            <CardDescription>
               Stok akan berkurang otomatis. Pastikan stok tersedia.
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
                                    <div className="flex justify-between items-center w-[200px]">
                                       <span className="text-xs text-muted-foreground">Sisa: {item.currentStock} {item.unit}</span>
                                       {item.currentStock <= 0 && <span className="text-xs text-red-500 font-bold">Habis</span>}
                                    </div>
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
                  <div className={`p-3 rounded-lg flex justify-between items-center text-sm ${
                      selectedItem.currentStock <= 0 ? 'bg-red-50 border border-red-200' : 'bg-zinc-50 dark:bg-zinc-900'
                  }`}>
                     <span className="text-muted-foreground">Stok Tersedia:</span>
                     <span className={`font-bold ${selectedItem.currentStock <= 0 ? 'text-red-600' : ''}`}>
                         {selectedItem.currentStock} {selectedItem.unit}
                     </span>
                  </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label>Jumlah Keluar <span className="text-red-500">*</span></Label>
                     <Input 
                        type="number" 
                        min="1" 
                        max={selectedItem?.currentStock}
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
                  <Label>Nama Pengambil / Penerima</Label>
                  <div className="relative">
                      <User className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-8"
                        placeholder="Nama Guru / Staff"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                      />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label>Keterangan / Keperluan</Label>
                  <Textarea 
                     placeholder="Contoh: Keperluan Kelas 1A, Ujian Sekolah, dll."
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                  />
               </div>

               <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
                  <Button type="submit" disabled={submitting} className="bg-rose-600 hover:bg-rose-700">
                     {submitting ? "Menyimpan..." : "Catat Barang Keluar"}
                  </Button>
               </div>
            </form>
         </CardContent>
       </Card>
    </div>
  );
}
