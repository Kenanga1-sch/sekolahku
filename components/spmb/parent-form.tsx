"use client";

import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Home } from "lucide-react";
import type { ParentFormValues } from "@/lib/validations/spmb";
import { LabelInputContainer, BottomGradient } from "@/components/ui/label-input-container";

interface ParentFormProps {
  form: UseFormReturn<ParentFormValues>;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

// Common options
const EDUCATION_OPTIONS = ["SD", "SMP", "SMA/SMK", "D1", "D2", "D3", "S1", "S2", "S3", "Tidak Sekolah"];
const JOB_OPTIONS = ["PNS", "TNI/Polri", "Pegawai Swasta", "Wiraswasta", "Petani", "Nelayan", "Buruh", "Pedagang", "Ibu Rumah Tangga", "Tidak Bekerja", "Lainnya"];
const INCOME_OPTIONS = ["< 500.000", "500.000 - 999.999", "1.000.000 - 1.999.999", "2.000.000 - 4.999.999", "5.000.000 - 20.000.000", "> 20.000.000", "Tidak Berpenghasilan"];

const inputClass = "h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-amber-500 transition-all duration-300 placeholder:text-zinc-400";
const selectTriggerClass = "h-11 bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:ring-0 focus:border-amber-500 transition-all duration-300";

export default function ParentForm({ form, activeTab, onTabChange }: ParentFormProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4 box-content h-auto p-1 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-xl mb-6">
        <TabsTrigger value="father" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Ayah</TabsTrigger>
        <TabsTrigger value="mother" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Ibu</TabsTrigger>
        <TabsTrigger value="guardian" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Wali</TabsTrigger>
        <TabsTrigger value="contact" className="rounded-lg py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">Kontak</TabsTrigger>
      </TabsList>

      {/* --- FORM AYAH --- */}
      <TabsContent value="father" className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900 mb-6">
          <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            Data Ayah Kandung
          </h3>
        </div>

         <FormField
          control={form.control}
          name="father_name"
          render={({ field }) => (
            <FormItem>
              <LabelInputContainer>
                <FormLabel>Nama Lengkap Ayah</FormLabel>
                <FormControl>
                  <div className="relative group/btn">
                    <Input placeholder="Sesuai KTP/KK" {...field} className={inputClass} />
                    <BottomGradient />
                  </div>
                </FormControl>
                <FormMessage />
              </LabelInputContainer>
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* NIK */}
          <FormField
            control={form.control}
            name="father_nik"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>NIK Ayah</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="16 digit NIK" maxLength={16} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Tahun Lahir */}
           <FormField
            control={form.control}
            name="father_birth_year"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Tahun Lahir</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="Contoh: 1980" maxLength={4} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Pendidikan */}
           <FormField
            control={form.control}
            name="father_education"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Pendidikan Terakhir</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EDUCATION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Pekerjaan */}
           <FormField
            control={form.control}
            name="father_job"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Pekerjaan Utama</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {JOB_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Penghasilan */}
           <FormField
            control={form.control}
            name="father_income"
            render={({ field }) => (
              <FormItem>
               <LabelInputContainer>
                    <FormLabel>Penghasilan Bulanan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {INCOME_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>
      </TabsContent>

      {/* --- FORM IBU --- */}
      <TabsContent value="mother" className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="bg-pink-50 dark:bg-pink-900/10 p-4 rounded-xl border border-pink-100 dark:border-pink-900 mb-6">
          <h3 className="font-semibold text-pink-700 dark:text-pink-300">Data Ibu Kandung</h3>
        </div>

         <FormField
          control={form.control}
          name="mother_name"
          render={({ field }) => (
            <FormItem>
               <LabelInputContainer>
                    <FormLabel>Nama Lengkap Ibu</FormLabel>
                    <FormControl>
                        <div className="relative group/btn">
                            <Input placeholder="Sesuai KTP/KK" {...field} className={inputClass} />
                            <BottomGradient />
                        </div>
                    </FormControl>
                    <FormMessage />
               </LabelInputContainer>
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* NIK */}
          <FormField
            control={form.control}
            name="mother_nik"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>NIK Ibu</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="16 digit NIK" maxLength={16} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Tahun Lahir */}
           <FormField
            control={form.control}
            name="mother_birth_year"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                  <FormLabel>Tahun Lahir</FormLabel>
                  <FormControl>
                    <div className="relative group/btn">
                      <Input placeholder="Contoh: 1985" maxLength={4} {...field} className={inputClass} />
                      <BottomGradient />
                    </div>
                  </FormControl>
                  <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Pendidikan */}
           <FormField
            control={form.control}
            name="mother_education"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Pendidikan Terakhir</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {EDUCATION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Pekerjaan */}
           <FormField
            control={form.control}
            name="mother_job"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Pekerjaan Utama</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {JOB_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Penghasilan */}
           <FormField
            control={form.control}
            name="mother_income"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Penghasilan Bulanan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {INCOME_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>
      </TabsContent>

      {/* --- FORM WALI --- */}
      <TabsContent value="guardian" className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2">
        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900 mb-6 text-amber-800 dark:text-amber-200 text-sm">
          <strong>Catatan:</strong> Bagian ini <strong>OPSIONAL</strong>. Isi hanya jika siswa tinggal bersama Wali, bukan orang tua kandung.
        </div>

        <FormField
          control={form.control}
          name="guardian_name"
          render={({ field }) => (
            <FormItem>
                <LabelInputContainer>
                    <FormLabel>Nama Lengkap Wali</FormLabel>
                    <FormControl>
                        <div className="relative group/btn">
                         <Input placeholder="Kosongkan jika tidak ada" {...field} className={inputClass} />
                         <BottomGradient />
                        </div>
                    </FormControl>
                    <FormMessage />
                </LabelInputContainer>
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* NIK */}
          <FormField
            control={form.control}
            name="guardian_nik"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>NIK Wali</FormLabel>
                    <FormControl>
                        <div className="relative group/btn">
                            <Input placeholder="16 digit NIK" maxLength={16} {...field} className={inputClass} />
                            <BottomGradient />
                        </div>
                    </FormControl>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Tahun Lahir */}
           <FormField
            control={form.control}
            name="guardian_birth_year"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Tahun Lahir</FormLabel>
                    <FormControl>
                        <div className="relative group/btn">
                            <Input placeholder="Contoh: 1980" maxLength={4} {...field} className={inputClass} />
                            <BottomGradient />
                        </div>
                    </FormControl>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Pendidikan */}
           <FormField
            control={form.control}
            name="guardian_education"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Pendidikan Terakhir</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {EDUCATION_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Pekerjaan */}
           <FormField
            control={form.control}
            name="guardian_job"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Pekerjaan Utama</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {JOB_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
           {/* Penghasilan */}
           <FormField
            control={form.control}
            name="guardian_income"
            render={({ field }) => (
              <FormItem>
                <LabelInputContainer>
                    <FormLabel>Penghasilan Bulanan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                    <FormControl>
                        <SelectTrigger className={selectTriggerClass}>
                        <SelectValue placeholder="Pilih..." />
                        </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {INCOME_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                    </Select>
                    <FormMessage />
                </LabelInputContainer>
              </FormItem>
            )}
          />
        </div>
      </TabsContent>

      {/* --- FORM KONTAK & ALAMAT --- */}
      <TabsContent value="contact" className="space-y-8 pt-2 animate-in fade-in slide-in-from-bottom-2">
         <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-4 mb-6">
            <Phone className="h-5 w-5 text-primary" /> Kontak Orang Tua/Wali
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="parent_phone"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>Nomor WhatsApp Aktif</FormLabel>
                        <FormControl>
                            <div className="relative group/btn">
                                <Input type="tel" placeholder="08xxxxxxxxxx" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="parent_email"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>Email <span className="text-muted-foreground font-normal">(Opsional)</span></FormLabel>
                        <FormControl>
                             <div className="relative group/btn">
                                <Input type="email" placeholder="example@email.com" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900/50 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-lg font-semibold flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-4 mb-6">
            <Home className="h-5 w-5 text-primary" /> Alamat Domisili
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Jalan */}
            <FormField
                control={form.control}
                name="address_street"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>Jalan / Dusun</FormLabel>
                        <FormControl>
                            <div className="relative group/btn">
                                <Input placeholder="Nama jalan, gang, atau dusun" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            {/* Desa */}
            <FormField
                control={form.control}
                name="address_village"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>Desa / Kelurahan</FormLabel>
                        <FormControl>
                            <div className="relative group/btn">
                                <Input placeholder="Nama desa" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            </div>

            <div className="grid grid-cols-3 gap-6">
            <FormField
                control={form.control}
                name="address_rt"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>RT</FormLabel>
                         <FormControl>
                            <div className="relative group/btn">
                                <Input placeholder="001" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="address_rw"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>RW</FormLabel>
                        <FormControl>
                            <div className="relative group/btn">
                                <Input placeholder="001" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                <FormItem>
                    <LabelInputContainer>
                        <FormLabel>Kode Pos</FormLabel>
                         <FormControl>
                            <div className="relative group/btn">
                                <Input placeholder="xxxxx" {...field} className={inputClass} />
                                <BottomGradient />
                            </div>
                        </FormControl>
                        <FormMessage />
                    </LabelInputContainer>
                </FormItem>
                )}
            />
            </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
